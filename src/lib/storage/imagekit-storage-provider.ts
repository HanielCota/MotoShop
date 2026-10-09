import "server-only";

import { createHmac, randomUUID } from "node:crypto";
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
});

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
  return { maxSizeInBytes, contentType, expiresInSeconds, separator };
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

function buildUploadPayload(key: string, request: UploadRequest) {
  return {
    fileName: key.slice(request.separator + 1),
    folder: `/${key.slice(0, request.separator)}`,
    useUniqueFileName: false,
    overwriteFile: false,
    checks: `"file.mime" IN ["${request.contentType}"] AND "file.size" <= ${request.maxSizeInBytes}`,
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

export class ImageKitStorageProvider implements StorageProvider {
  async createUploadUrl(input: CreateUploadUrlInput): Promise<CreateUploadUrlResult> {
    const config = this.getConfig();
    const request = parseUploadRequest(input);
    const issuedAt = Math.floor(Date.now() / 1000);
    const expire = issuedAt + request.expiresInSeconds;
    const payload = buildUploadPayload(input.key, request);
    const token = signUploadToken(config, { ...payload, iat: issuedAt, exp: expire, jti: randomUUID() });

    return {
      key: input.key,
      url: uploadEndpoint,
      expiresAt: new Date(expire * 1000),
      fields: {
        token,
        fileName: payload.fileName,
        folder: payload.folder,
        useUniqueFileName: "false",
        overwriteFile: "false",
        checks: payload.checks,
      },
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
      (!parsed.data.mime.startsWith("image/") && !parsed.data.mime.startsWith("video/"))
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
      headers: { Authorization: `Basic ${Buffer.from(`${privateKey}:`).toString("base64")}` },
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
