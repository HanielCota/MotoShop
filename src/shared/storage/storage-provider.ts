export type CreateUploadUrlInput = {
  key: string;
  contentType: string;
  expiresInSeconds?: number;
};

export type CreateUploadUrlResult = {
  key: string;
  url: string;
  expiresAt: Date;
};

export type DeleteObjectInput = { key: string };

export interface StorageProvider {
  createUploadUrl(input: CreateUploadUrlInput): Promise<CreateUploadUrlResult>;
  deleteObject(input: DeleteObjectInput): Promise<void>;
}
