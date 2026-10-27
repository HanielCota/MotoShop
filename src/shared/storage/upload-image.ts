const ALLOWED_IMAGE_TYPES: readonly string[] = ["image/jpeg", "image/png", "image/webp"];
const MAX_IMAGE_SIZE_IN_BYTES = 5 * 1024 * 1024;

export const IMAGE_FILE_RULES_MESSAGE = "A imagem precisa ser JPG, PNG ou WebP e ter até 5 MB.";
/** The file already passed the type and size check, so a refusal here is not the person's fault. */
export const IMAGE_SERVICE_REFUSED_MESSAGE =
  "O serviço de imagens não aceitou o envio agora. Tente de novo em alguns minutos.";

/** Checked in the browser before asking the server for an upload authorization. */
export function imageFileProblem(file: File): string | null {
  if (ALLOWED_IMAGE_TYPES.includes(file.type) === false) return IMAGE_FILE_RULES_MESSAGE;
  if (file.size > MAX_IMAGE_SIZE_IN_BYTES) return IMAGE_FILE_RULES_MESSAGE;

  return null;
}

export async function uploadFileToImageKit(input: {
  url: string;
  fields: Record<string, string>;
  file: File;
}): Promise<string> {
  const formData = new FormData();
  for (const [key, value] of Object.entries(input.fields)) formData.append(key, value);
  formData.append("file", input.file);

  const response = await fetch(input.url, { method: "POST", body: formData });
  if (!response.ok) throw new Error(IMAGE_SERVICE_REFUSED_MESSAGE);
  const result: unknown = await response.json();
  if (!result || typeof result !== "object" || !("fileId" in result) || typeof result.fileId !== "string") {
    throw new Error("O serviço de imagens retornou uma resposta inválida.");
  }
  return result.fileId;
}

export const uploadImageToImageKit = uploadFileToImageKit;
