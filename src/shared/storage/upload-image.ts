export async function uploadFileToImageKit(input: {
  url: string;
  fields: Record<string, string>;
  file: File;
}): Promise<string> {
  const formData = new FormData();
  for (const [key, value] of Object.entries(input.fields)) formData.append(key, value);
  formData.append("file", input.file);

  const response = await fetch(input.url, { method: "POST", body: formData });
  if (!response.ok) throw new Error("Não foi possível enviar o arquivo. Verifique o formato e o limite permitido.");
  const result: unknown = await response.json();
  if (!result || typeof result !== "object" || !("fileId" in result) || typeof result.fileId !== "string") {
    throw new Error("O serviço de imagens retornou uma resposta inválida.");
  }
  return result.fileId;
}

export const uploadImageToImageKit = uploadFileToImageKit;
