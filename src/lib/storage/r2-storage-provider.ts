import "server-only";

import { DeleteObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import { env } from "@/config/env";
import { ApplicationError } from "@/shared/errors/application-error";
import type {
  CreateUploadUrlInput,
  CreateUploadUrlResult,
  DeleteObjectInput,
  StorageProvider,
} from "@/shared/storage/storage-provider";

const DEFAULT_UPLOAD_EXPIRATION_SECONDS = 300;

export class R2StorageProvider implements StorageProvider {
  async createUploadUrl(input: CreateUploadUrlInput): Promise<CreateUploadUrlResult> {
    const config = this.getConfig();
    const expiresInSeconds = input.expiresInSeconds ?? DEFAULT_UPLOAD_EXPIRATION_SECONDS;
    const client = new S3Client({
      region: "auto",
      endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
    });
    const command = new PutObjectCommand({
      Bucket: config.bucketName,
      Key: input.key,
      ContentType: input.contentType,
    });
    const url = await getSignedUrl(client, command, { expiresIn: expiresInSeconds });

    return { key: input.key, url, expiresAt: new Date(Date.now() + expiresInSeconds * 1_000) };
  }

  async deleteObject(input: DeleteObjectInput): Promise<void> {
    const config = this.getConfig();
    const client = new S3Client({
      region: "auto",
      endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
    });
    await client.send(new DeleteObjectCommand({ Bucket: config.bucketName, Key: input.key }));
  }

  private getConfig() {
    if (!env.R2_ACCOUNT_ID || !env.R2_ACCESS_KEY_ID || !env.R2_SECRET_ACCESS_KEY || !env.R2_BUCKET_NAME) {
      throw new ApplicationError({ code: "CONFIGURATION_ERROR", message: "Cloudflare R2 is not configured." });
    }

    return {
      accountId: env.R2_ACCOUNT_ID,
      accessKeyId: env.R2_ACCESS_KEY_ID,
      secretAccessKey: env.R2_SECRET_ACCESS_KEY,
      bucketName: env.R2_BUCKET_NAME,
    };
  }
}
