const ALLOWED_IMAGE_TYPES: readonly string[] = ["image/jpeg", "image/png", "image/webp"];
const MAX_IMAGE_SIZE_IN_BYTES = 5 * 1024 * 1024;

/** The file already passed the type and size check, so a refusal here does not blame it. */
export const IMAGE_SERVICE_REFUSED_MESSAGE =
  "O serviço de imagens não aceitou o envio. Tente de novo; se o erro continuar, tente com outra imagem.";
export const IMAGE_SERVICE_UNREACHABLE_MESSAGE =
  "Não foi possível conectar ao serviço de imagens. Confira sua internet e tente de novo.";

/** Names the file, so a selection of several photos shows which one breaks the rule. */
export function imageFileRulesMessage(fileName: string): string {
  return `A imagem "${fileName}" precisa ser JPG, PNG ou WebP e ter até 5 MB.`;
}

/** Checked in the browser before asking the server for an upload authorization. */
export function findImageFileProblem(file: File): string | null {
  const isAllowed = ALLOWED_IMAGE_TYPES.includes(file.type) && file.size <= MAX_IMAGE_SIZE_IN_BYTES;
  if (isAllowed) return null;

  return imageFileRulesMessage(file.name);
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
