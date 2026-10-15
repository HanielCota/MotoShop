import { z } from "zod";

/** True when the URL host is one of `hosts` or a subdomain of it (www., m.). */
export function isAllowedSocialHost(value: string, hosts: readonly string[]): boolean {
  try {
    const url = new URL(value);
    if (url.username || url.password) return false;
    const hostname = url.hostname.toLowerCase();
    return hosts.some((host) => hostname === host || hostname.endsWith(`.${host}`));
  } catch {
    return false;
  }
}

export const socialNetworkHosts = {
  instagram: ["instagram.com"],
  youtube: ["youtube.com", "youtu.be"],
  facebook: ["facebook.com"],
  // M-09: only WhatsApp itself (wa.me, api./chat.whatsapp.com); never an outside store or a fake page.
  whatsapp: ["wa.me", "whatsapp.com"],
} as const;

const optionalHttpsUrl = (label: string, hosts?: readonly string[]) =>
  z
    .string()
    .trim()
    .url(`Informe um link válido para ${label}.`)
    .refine((url) => url.startsWith("https://"), "Use um link seguro iniciado por https://.")
    .refine((url) => !hosts || isAllowedSocialHost(url, hosts), `Informe um link de ${label}.`)
    .or(z.literal(""));

export const storeProfileSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome da loja.").max(120),
  slug: z
    .string()
    .trim()
    .min(3, "Informe um identificador para a loja.")
    .max(120)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use apenas letras minúsculas, números e hífens."),
  description: z.string().trim().max(500, "A descrição deve ter no máximo 500 caracteres."),
  instagramUrl: optionalHttpsUrl("o Instagram", socialNetworkHosts.instagram),
  youtubeUrl: optionalHttpsUrl("o YouTube", socialNetworkHosts.youtube),
  whatsappUrl: optionalHttpsUrl("o WhatsApp", socialNetworkHosts.whatsapp),
  facebookUrl: optionalHttpsUrl("o Facebook", socialNetworkHosts.facebook),
});

export type StoreProfileInput = z.infer<typeof storeProfileSchema>;
