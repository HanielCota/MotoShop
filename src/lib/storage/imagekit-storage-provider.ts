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

export class ImageKitStorageProvider implements StorageProvider {
  async createUploadUrl(input: CreateUploadUrlInput): Promise<CreateUploadUrlResult> {
    const config = this.getConfig();
    const expiresInSeconds = z
      .number()
      .int()
      .positive()
      .max(3599)
      .parse(input.expiresInSeconds ?? 300);
    const issuedAt = Math.floor(Date.now() / 1000);
    const expire = issuedAt + expiresInSeconds;
    const separator = input.key.lastIndexOf("/");
    if (separator < 0 || !/^[a-zA-Z0-9_/-]+\/[a-zA-Z0-9_-]+\.(jpg|png|webp)$/.test(input.key))
      throw new ApplicationError({ code: "VALIDATION_ERROR", message: "Caminho de imagem inválido." });
    const payload = {
      fileName: input.key.slice(separator + 1),
      folder: `/${input.key.slice(0, separator)}`,
      useUniqueFileName: false,
      overwriteFile: false,
    };
    // V1 signs only token/expiry, allowing a client to change the destination or
    // overwrite flag. V2 authenticates the upload parameters as well.
    const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT", kid: config.publicKey })).toString(
      "base64url",
    );
    const claims = Buffer.from(JSON.stringify({ ...payload, iat: issuedAt, exp: expire, jti: randomUUID() })).toString(
      "base64url",
    );
    const signingInput = `${header}.${claims}`;
    const signature = createHmac("sha256", config.privateKey).update(signingInput).digest("base64url");
    const token = `${signingInput}.${signature}`;

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
