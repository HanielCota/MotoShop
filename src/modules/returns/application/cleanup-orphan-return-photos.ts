import "server-only";

import { db } from "@/lib/database";
import { logger } from "@/lib/logger";
import { ImageKitStorageProvider, type StoredFile } from "@/lib/storage/imagekit-storage-provider";

/**
 * Switch for the real removal. It ships off: the job only logs what it would delete, and turning it on
 * takes a reviewed PR after the owner has seen that log.
 */
export const ORPHAN_RETURN_PHOTO_CLEANUP_DELETES_FILES = false;

const RETURN_PHOTO_FOLDER = "returns";
// returns/<order item id>/<random uuid>.<jpg|png|webp>, the only shape a return photo upload gets.
const RETURN_PHOTO_PATH =
  /^\/returns\/[a-z0-9]{20,40}\/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\.(jpg|png|webp)$/;
// An upload becomes part of a return within minutes; a day leaves plenty of margin for slow forms.
const ORPHAN_AGE_IN_MS = 24 * 60 * 60 * 1000;
const PAGE_SIZE = 100;
// At most 10 listing calls per run (1,000 files), so a daily run stays far from the API limits.
const MAX_PAGES_PER_RUN = 10;

export type OrphanCleanupDependencies = {
  listFiles: (input: { folder: string; createdBefore: Date; skip: number; limit: number }) => Promise<StoredFile[]>;
  deleteFiles: (fileIds: readonly string[]) => Promise<void>;
  findAttachedStorageKeys: (storageKeys: readonly string[]) => Promise<Set<string>>;
  deletesFiles: boolean;
  now: Date;
};

export type OrphanCleanupSummary = {
  scanned: number;
  orphans: number;
  deleted: number;
  apiCalls: number;
  orphanPaths: string[];
};

/** Finds the return photo uploads that never joined a return and, when switched on, deletes them. */
export async function cleanupOrphanReturnPhotos(deps: OrphanCleanupDependencies): Promise<OrphanCleanupSummary> {
  const createdBefore = new Date(deps.now.getTime() - ORPHAN_AGE_IN_MS);
  const summary: OrphanCleanupSummary = { scanned: 0, orphans: 0, deleted: 0, apiCalls: 0, orphanPaths: [] };

  for (let page = 0; page < MAX_PAGES_PER_RUN; page += 1) {
    // Deleted files leave the listing, so the next page starts that many files earlier.
    const skip = page * PAGE_SIZE - summary.deleted;
    const files = await deps.listFiles({ folder: RETURN_PHOTO_FOLDER, createdBefore, skip, limit: PAGE_SIZE });
    summary.apiCalls += 1;
    summary.scanned += files.length;

    await handleOrphans(await findOrphans(files, deps), deps, summary);

    if (files.length < PAGE_SIZE) break;
  }

  return summary;
}

async function findOrphans(files: readonly StoredFile[], deps: OrphanCleanupDependencies): Promise<StoredFile[]> {
  const candidates = files.filter((file) => RETURN_PHOTO_PATH.test(file.filePath));
  if (candidates.length === 0) return [];

  const attached = await deps.findAttachedStorageKeys(candidates.map((file) => storageKeyOf(file)));

  return candidates.filter((file) => !attached.has(storageKeyOf(file)));
}

async function handleOrphans(
  orphans: readonly StoredFile[],
  deps: OrphanCleanupDependencies,
  summary: OrphanCleanupSummary,
) {
  summary.orphans += orphans.length;
  summary.orphanPaths.push(...orphans.map((file) => file.filePath));
  if (!deps.deletesFiles || orphans.length === 0) return;

  await deps.deleteFiles(orphans.map((file) => file.fileId));
  summary.apiCalls += 1;
  summary.deleted += orphans.length;
}

function storageKeyOf(file: StoredFile): string {
  return file.filePath.replace(/^\//, "");
}

/** Production wiring: ImageKit, the return photos table and the switch above. Logs paths and counts only. */
export async function runOrphanReturnPhotoCleanup(now: Date): Promise<OrphanCleanupSummary> {
  const provider = new ImageKitStorageProvider();
  const summary = await cleanupOrphanReturnPhotos({
    listFiles: (input) => provider.listFilesCreatedBefore(input),
    deleteFiles: (fileIds) => provider.deleteFilesById(fileIds),
    findAttachedStorageKeys: async (storageKeys) => {
      const photos = await db.returnRequestPhoto.findMany({
        where: { storageKey: { in: [...storageKeys] } },
        select: { storageKey: true },
      });

      return new Set(photos.map((photo) => photo.storageKey));
    },
    deletesFiles: ORPHAN_RETURN_PHOTO_CLEANUP_DELETES_FILES,
    now,
  });

  logger.info({
    event: ORPHAN_RETURN_PHOTO_CLEANUP_DELETES_FILES
      ? "return_photos.orphans_deleted"
      : "return_photos.orphans_dry_run",
    scanned: summary.scanned,
    orphans: summary.orphans,
    deleted: summary.deleted,
    apiCalls: summary.apiCalls,
    orphanPaths: summary.orphanPaths,
  });

  return summary;
}
