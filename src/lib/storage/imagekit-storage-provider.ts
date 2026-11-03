import "server-only";

import { createHmac } from "node:crypto";
import { z } from "zod";

import { env } from "@/config/env";
import { ApplicationError } from "@/shared/errors/application-error";
import type {
  CreateUploadUrlInput,
  CreateUploadUrlResult,
  DeleteObjectInput,
  StorageProvider,
} from "@/shared/storage/storage-provider";

const assetSchema = z.object({
  fileId: z.string(),
  filePath: z.string(),
  fileType: z.string(),
  mime: z.string(),
  size: z.number().int().positive(),
  isPrivateFile: z.boolean().optional(),
});

const storedFileSchema = z.object({ fileId: z.string(), filePath: z.string(), createdAt: z.coerce.date() });

export type StoredFile = z.infer<typeof storedFileSchema>;

const MAX_FILES_PER_BULK_DELETE = 100;

const uploadEndpoint = "https://upload.imagekit.io/api/v2/files/upload";
const managementEndpoint = "https://api.imagekit.io/v1/files";

const uploadContentTypeSchema = z.enum([
  "image/jpeg",
  "image/png",
  "image/webp",
  "video/mp4",
  "video/webm",
  "video/quicktime",
]);

type UploadContentType = z.infer<typeof uploadContentTypeSchema>;

const expectedExtensionByContentType: Record<UploadContentType, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov",
};

type UploadRequest = {
  maxSizeInBytes: number;
  contentType: UploadContentType;
  expiresInSeconds: number;
  separator: number;
  isPrivate: boolean;
};

/** Validates size, type, expiry and key in that order, so error precedence is stable. */
function parseUploadRequest(input: CreateUploadUrlInput): UploadRequest {
  const maxSizeInBytes = z
    .number()
    .int()
    .positive()
    .max(20 * 1024 * 1024)
    .parse(input.maxSizeInBytes);
  const contentType = uploadContentTypeSchema.parse(input.contentType);
  const expiresInSeconds = z
    .number()
    .int()
    .positive()
    .max(3599)
    .parse(input.expiresInSeconds ?? 300);
  const separator = assertUploadKey(input.key, contentType);
  return { maxSizeInBytes, contentType, expiresInSeconds, separator, isPrivate: input.isPrivate === true };
}

/** Returns the position of the last "/" that splits folder and file name. */
function assertUploadKey(key: string, contentType: UploadContentType) {
  const separator = key.lastIndexOf("/");
  if (separator < 0 || !/^[a-zA-Z0-9_/-]+\/[a-zA-Z0-9_-]+\.(jpg|png|webp|mp4|webm|mov)$/.test(key))
    throw new ApplicationError({ code: "VALIDATION_ERROR", message: "Caminho de arquivo inválido." });
  if (!key.endsWith(`.${expectedExtensionByContentType[contentType]}`))
    throw new ApplicationError({
      code: "VALIDATION_ERROR",
      message: "A extensão não corresponde ao tipo do arquivo.",
    });
  return separator;
}

/**
 * The upload form fields, which are also the signed claims: ImageKit V2 rejects the upload unless
 * the token carries exactly the same parameters, with every value as a string (only iat and exp
 * are numbers). https://imagekit.io/docs/api-reference/upload-file/upload-file-v2
 */
function buildUploadFields(key: string, request: UploadRequest): Record<string, string> {
  return {
    fileName: key.slice(request.separator + 1),
    folder: `/${key.slice(0, request.separator)}`,
    useUniqueFileName: "false",
    overwriteFile: "false",
    checks: `"file.mime" IN ["${request.contentType}"] AND "file.size" <= ${request.maxSizeInBytes}`,
    // Assinado no token V2: o navegador não consegue trocar um upload privado por público.
    ...(request.isPrivate ? { isPrivateFile: "true" } : {}),
  };
}

/**
 * V1 signs only token/expiry, allowing a client to change the destination or
 * overwrite flag. V2 authenticates the upload parameters as well.
 */
function signUploadToken(config: { publicKey: string; privateKey: string }, claims: Record<string, unknown>) {
  const encodedHeader = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT", kid: config.publicKey })).toString(
    "base64url",
  );
  const encodedClaims = Buffer.from(JSON.stringify(claims)).toString("base64url");
  const signingInput = `${encodedHeader}.${encodedClaims}`;
  const signature = createHmac("sha256", config.privateKey).update(signingInput).digest("base64url");
  return `${signingInput}.${signature}`;
}

const MAX_SIGNED_LINK_SECONDS = 3600;
const MAX_SIGNED_IMAGE_WIDTH = 2000;
const MILLISECONDS_PER_SECOND = 1000;

const signedPathSchema = z.string().regex(/^[a-zA-Z0-9_/-]+\/[a-zA-Z0-9_-]+\.(jpg|png|webp)$/);

/**
 * Assinatura de URL do ImageKit: HMAC-SHA1, em hexadecimal, do caminho depois do endpoint seguido
 * do instante de expiração (segundos UTC); vai na URL como ik-t e ik-s.
 * https://imagekit.io/docs/media-delivery-basic-security
 */
export function signImageKitUrl(input: {
  endpoint: string;
  privateKey: string;
  key: string;
  expiresInSeconds: number;
  width?: number | undefined;
  now: Date;
}): string {
  const key = signedPathSchema.parse(input.key);
  const expiresInSeconds = z.number().int().positive().max(MAX_SIGNED_LINK_SECONDS).parse(input.expiresInSeconds);
  const path =
    input.width != null
      ? `tr:w-${z.number().int().positive().max(MAX_SIGNED_IMAGE_WIDTH).parse(input.width)}/${key}`
      : key;
  const expiresAt = Math.floor(input.now.getTime() / MILLISECONDS_PER_SECOND) + expiresInSeconds;
  const signature = createHmac("sha1", input.privateKey).update(`${path}${expiresAt}`).digest("hex");

  return `${input.endpoint.replace(/\/$/, "")}/${path}?ik-t=${expiresAt}&ik-s=${signature}`;
}

function getUrlEndpoint(): string {
  if (env.IMAGEKIT_URL_ENDPOINT == null || env.IMAGEKIT_URL_ENDPOINT.trim().length === 0) {
    throw new ApplicationError({
      code: "CONFIGURATION_ERROR",
      message: "O armazenamento de imagens ainda não está configurado.",
    });
  }

  return env.IMAGEKIT_URL_ENDPOINT;
}

export class ImageKitStorageProvider implements StorageProvider {
  async createUploadUrl(input: CreateUploadUrlInput): Promise<CreateUploadUrlResult> {
    const config = this.getConfig();
    const request = parseUploadRequest(input);
    const issuedAt = Math.floor(Date.now() / 1000);
    const expire = issuedAt + request.expiresInSeconds;
    const fields = buildUploadFields(input.key, request);
    const token = signUploadToken(config, { ...fields, iat: issuedAt, exp: expire });

    return {
      key: input.key,
      url: uploadEndpoint,
      expiresAt: new Date(expire * 1000),
      fields: { token, ...fields },
    };
  }

  async verifyImage(input: {
    key: string;
    fileId: string;
    maxSizeInBytes: number;
    contentTypes: readonly string[];
  }): Promise<void> {
    const response = await this.managementRequest(`${managementEndpoint}/${encodeURIComponent(input.fileId)}/details`);
    if (!response.ok)
      throw new ApplicationError({ code: "VALIDATION_ERROR", message: "Não foi possível confirmar a imagem enviada." });
    const parsed = assetSchema.safeParse(await response.json());
    if (
      !parsed.success ||
      parsed.data.filePath !== `/${input.key}` ||
      parsed.data.fileType !== "image" ||
      !input.contentTypes.includes(parsed.data.mime) ||
      parsed.data.size > input.maxSizeInBytes
    ) {
      throw new ApplicationError({
        code: "VALIDATION_ERROR",
        message: "A imagem enviada não corresponde ao arquivo autorizado.",
      });
    }
  }

  async verifyAsset(input: {
    key: string;
    fileId: string;
    maxSizeInBytes: number;
    contentTypes: readonly string[];
    /** Recusa o arquivo se o ImageKit não o marcou como privado. */
    requirePrivate?: boolean;
  }): Promise<{ mediaType: "image" | "video"; contentType: string; sizeInBytes: number }> {
    const response = await this.managementRequest(`${managementEndpoint}/${encodeURIComponent(input.fileId)}/details`);
    if (!response.ok)
      throw new ApplicationError({
        code: "VALIDATION_ERROR",
        message: "Não foi possível confirmar o arquivo enviado.",
      });
    const parsed = assetSchema.safeParse(await response.json());
    if (
      !parsed.success ||
      parsed.data.filePath !== `/${input.key}` ||
      !input.contentTypes.includes(parsed.data.mime) ||
      parsed.data.size > input.maxSizeInBytes ||
      (parsed.data.mime.startsWith("image/") && parsed.data.fileType !== "image") ||
      (parsed.data.mime.startsWith("video/") && parsed.data.fileType === "image") ||
      (!parsed.data.mime.startsWith("image/") && !parsed.data.mime.startsWith("video/")) ||
      (input.requirePrivate === true && parsed.data.isPrivateFile !== true)
    ) {
      throw new ApplicationError({
        code: "VALIDATION_ERROR",
        message: "O arquivo enviado não corresponde ao tipo, caminho ou tamanho autorizado.",
      });
    }
    return {
      mediaType: parsed.data.mime.startsWith("image/") ? "image" : "video",
      contentType: parsed.data.mime,
      sizeInBytes: parsed.data.size,
    };
  }

  /**
   * Link assinado de um arquivo privado, válido por `expiresInSeconds`. Com `width`, a imagem vem
   * redimensionada pela transformação no caminho (tr:w-N), que também entra na assinatura.
   */
  createSignedUrl(input: { key: string; expiresInSeconds: number; width?: number }): string {
    const { privateKey } = this.getConfig();
    const endpoint = getUrlEndpoint();

    return signImageKitUrl({ ...input, endpoint, privateKey, now: new Date() });
  }

  /**
   * One page of the files under `folder` created before `createdBefore`, oldest first. The caller
   * filters the paths again: the search is a convenience, never the only check before a deletion.
   */
  async listFilesCreatedBefore(input: {
    folder: string;
    createdBefore: Date;
    skip: number;
    limit: number;
  }): Promise<StoredFile[]> {
    // The `path` parameter only looks one level deep; the `path :` operator of searchQuery takes the
    // folder and every subfolder. With searchQuery, `type` is ignored, so folders may come back too.
    const folder = `/${input.folder.replace(/^\/+|\/+$/g, "")}/`;
    const query = new URLSearchParams({
      searchQuery: `path : "${folder}" AND createdAt < "${input.createdBefore.toISOString()}"`,
      sort: "ASC_CREATED",
      skip: String(input.skip),
      limit: String(input.limit),
    });
    const response = await this.managementRequest(`${managementEndpoint}?${query}`);
    if (response.ok === false) throw new Error(`ImageKit file listing failed with status ${response.status}`);

    const items = z.array(z.unknown()).parse(await response.json());

    return items.flatMap((item) => {
      const file = storedFileSchema.safeParse(item);

      return file.success ? [file.data] : [];
    });
  }

  /** Deletes up to 100 files in one call (ImageKit bulk delete). */
  async deleteFilesById(fileIds: readonly string[]): Promise<void> {
    if (fileIds.length === 0) return;

    const ids = z.array(z.string().min(1)).max(MAX_FILES_PER_BULK_DELETE).parse(fileIds);
    const response = await this.managementRequest(`${managementEndpoint}/batch/deleteByFileIds`, {
      method: "POST",
      body: JSON.stringify({ fileIds: ids }),
    });
    if (response.ok === false) throw new Error(`ImageKit bulk deletion failed with status ${response.status}`);
  }

  async deleteObject(input: DeleteObjectInput): Promise<void> {
    const separator = input.key.lastIndexOf("/");
    if (separator < 0) return;
    const query = new URLSearchParams({
      path: `/${input.key.slice(0, separator)}`,
      name: input.key.slice(separator + 1),
      limit: "10",
    });
    const listResponse = await this.managementRequest(`${managementEndpoint}?${query}`);
    if (!listResponse.ok) throw new Error("ImageKit asset lookup failed");
    const assets = z.array(assetSchema).parse(await listResponse.json());
    const asset = assets.find((item) => item.filePath === `/${input.key}`);
    if (!asset) return;
    const deleteResponse = await this.managementRequest(`${managementEndpoint}/${encodeURIComponent(asset.fileId)}`, {
      method: "DELETE",
    });
    if (!deleteResponse.ok) throw new Error("ImageKit asset deletion failed");
  }

  private async managementRequest(url: string, init?: RequestInit) {
    const { privateKey } = this.getConfig();
    return fetch(url, {
      ...init,
      headers: {
        Authorization: `Basic ${Buffer.from(`${privateKey}:`).toString("base64")}`,
        ...(init?.body == null ? {} : { "Content-Type": "application/json" }),
      },
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
  }

  private getConfig() {
    if (!env.IMAGEKIT_PUBLIC_KEY || !env.IMAGEKIT_PRIVATE_KEY || !env.IMAGEKIT_URL_ENDPOINT) {
      throw new ApplicationError({
        code: "CONFIGURATION_ERROR",
        message: "O armazenamento de imagens ainda não está configurado.",
      });
    }
    return { publicKey: env.IMAGEKIT_PUBLIC_KEY, privateKey: env.IMAGEKIT_PRIVATE_KEY };
  }
}
