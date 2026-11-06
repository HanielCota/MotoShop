const ALLOWED_IMAGE_TYPES: readonly string[] = ["image/jpeg", "image/png", "image/webp"];
export const BYTES_PER_MEGABYTE = 1024 * 1024;
const megabyteFormatter = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });

/** The file already passed the type and size check, so a refusal here does not blame it. */
export const IMAGE_SERVICE_REFUSED_MESSAGE =
  "O serviço de imagens não aceitou o envio. Tente de novo; se o erro continuar, tente com outra imagem.";
export const IMAGE_SERVICE_UNREACHABLE_MESSAGE =
  "Não foi possível conectar ao serviço de imagens. Confira sua internet e tente de novo.";

/** Size limit as people read it, e.g. "5 MB". */
export function formatImageSizeLimit(maxSizeInBytes: number): string {
  return `${megabyteFormatter.format(maxSizeInBytes / BYTES_PER_MEGABYTE)} MB`;
}

/** Server message for an image over the configured size. */
export function imageTooLargeMessage(maxSizeInBytes: number): string {
  return `Cada imagem pode ter até ${formatImageSizeLimit(maxSizeInBytes)}.`;
}

/** Names the file, so a selection of several photos shows which one breaks the rule. */
function imageFileRulesMessage(fileName: string, maxSizeInBytes: number): string {
  return `A imagem "${fileName}" precisa ser JPG, PNG ou WebP e ter até ${formatImageSizeLimit(maxSizeInBytes)}.`;
}

/**
 * Checked in the browser before asking the server for an upload authorization.
 *
 * @param maxSizeInBytes - Largest accepted file; the server checks the same limit again.
 * @returns A message in Portuguese naming the file, or null when it can be sent.
 */
export function findImageFileProblem(file: File, maxSizeInBytes: number): string | null {
  const isAllowed = ALLOWED_IMAGE_TYPES.includes(file.type) && file.size <= maxSizeInBytes;
  if (isAllowed) return null;

  return imageFileRulesMessage(file.name, maxSizeInBytes);
}

async function postToImageKit(url: string, body: FormData): Promise<Response> {
  try {
    return await fetch(url, { method: "POST", body });
  } catch (error) {
    throw new Error(IMAGE_SERVICE_UNREACHABLE_MESSAGE, { cause: error });
  }
}

export async function uploadFileToImageKit(input: {
  url: string;
  fields: Record<string, string>;
  file: File;
}): Promise<string> {
  const formData = new FormData();
  for (const [key, value] of Object.entries(input.fields)) formData.append(key, value);
  formData.append("file", input.file);

  const response = await postToImageKit(input.url, formData);
  if (response.ok === false) throw new Error(IMAGE_SERVICE_REFUSED_MESSAGE);
  const result: unknown = await response.json();
  if (!result || typeof result !== "object" || !("fileId" in result) || typeof result.fileId !== "string") {
    throw new Error("O serviço de imagens retornou uma resposta inválida.");
  }
  return result.fileId;
}

export const uploadImageToImageKit = uploadFileToImageKit;
