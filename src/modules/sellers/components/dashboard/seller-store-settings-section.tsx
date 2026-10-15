import type { ComponentProps } from "react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ShippingOriginForm } from "@/modules/sellers/components/shipping-origin-form";
import { StoreBrandingManager } from "@/modules/sellers/components/store-branding-manager";
import { StoreProfileForm } from "@/modules/sellers/components/store-profile-form";
import { getPublicStorageUrl } from "@/shared/storage/public-storage-url";

type Store = ComponentProps<typeof ShippingOriginForm>["store"] & {
  name: string;
  slug: string;
  description: string | null;
  instagramUrl: string | null;
  youtubeUrl: string | null;
  whatsappUrl: string | null;
  facebookUrl: string | null;
  logoStorageKey: string | null;
  bannerStorageKey: string | null;
};

/**
 * Perfil público, identidade visual (apenas quem gerencia a loja) e dados de remetente.
 * O gating replica o painel original: dados de envio ficam visíveis para todos os membros.
 */
export function SellerStoreSettingsSection({ store, canManageStore }: { store: Store; canManageStore: boolean }) {
  return (
    <>
      {canManageStore ? (
        <Card id="seller-profile" className="scroll-mt-24">
          <CardHeader>
            <CardTitle>Perfil público da loja</CardTitle>
            <CardDescription>
              Nome, endereço público e apresentação exibidos na vitrine do Moto Shop. Dados de origem ficam em uma seção
              separada e não são publicados.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <StoreProfileForm
              store={{
                name: store.name,
                slug: store.slug,
                description: store.description,
                instagramUrl: store.instagramUrl,
                youtubeUrl: store.youtubeUrl,
                whatsappUrl: store.whatsappUrl,
                facebookUrl: store.facebookUrl,
              }}
            />
          </CardContent>
        </Card>
      ) : null}
      {canManageStore ? (
        <Card id="seller-branding" className="scroll-mt-24">
          <CardHeader>
            <CardTitle>Identidade visual</CardTitle>
            <CardDescription>Adicione a logo e o banner que serão exibidos na vitrine pública da loja.</CardDescription>
          </CardHeader>
          <CardContent>
            <StoreBrandingManager
              initialImages={{
                logoUrl: store.logoStorageKey ? getPublicStorageUrl(store.logoStorageKey) : null,
                bannerUrl: store.bannerStorageKey ? getPublicStorageUrl(store.bannerStorageKey) : null,
              }}
            />
          </CardContent>
        </Card>
      ) : null}
      <Card id="seller-shipping" className="scroll-mt-24">
        <CardHeader>
          <CardTitle>Dados de envio</CardTitle>
          <CardDescription>
            Preencha o remetente usado nas etiquetas do Melhor Envio. O endereço do cliente vem de cada pedido.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ShippingOriginForm store={store} />
        </CardContent>
      </Card>
    </>
  );
}
