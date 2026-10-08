import { Card, CardContent } from "@/components/ui/card";
import { InlineNotice } from "@/components/ui/inline-notice";
import { PageHeader } from "@/components/ui/page-header";
import { requireSellerAccess } from "@/modules/auth/application/authorization";
import { listActiveMotorcycleFitmentsForProduct } from "@/modules/catalog/queries/admin-catalog";
import { ProductForm } from "@/modules/products/components/product-form";
import { listProductBrands, listProductCategories } from "@/modules/products/queries/products";

export default async function NewProductPage() {
  await requireSellerAccess("PRODUCT_CREATE");
  const [categories, brands, fitments] = await Promise.all([
    listProductCategories(),
    listProductBrands(),
    listActiveMotorcycleFitmentsForProduct(),
  ]);

  return (
    <>
      <PageHeader
        back={{ href: "/seller/products", label: "Voltar para produtos" }}
        eyebrow="Catálogo"
        title="Novo produto"
        description="Os campos obrigatórios criam o rascunho. A publicação depende da aprovação pelo Moto Shop."
      />
      <Card>
        <CardContent className="space-y-5">
          <InlineNotice tone="info">
            Ao salvar, o rascunho é criado e você segue direto para a edição, onde adiciona as fotos antes de enviar
            para aprovação.
          </InlineNotice>
          <ProductForm
            categories={categories}
            brands={brands}
            fitments={fitments.map((fitment) => ({
              id: fitment.id,
              label: `${fitment.motorcycleModel.manufacturer.name} ${fitment.motorcycleModel.name} · ${fitment.version || "padrão"} · ${fitment.year}`,
            }))}
          />
        </CardContent>
      </Card>
    </>
  );
}
