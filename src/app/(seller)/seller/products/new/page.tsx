import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/lib/database";
import { requireSellerAccess } from "@/modules/auth/application/authorization";
import { listActiveMotorcycleFitmentsForProduct } from "@/modules/catalog/queries/admin-catalog";
import { ProductForm } from "@/modules/products/components/product-form";

export default async function NewProductPage() {
  await requireSellerAccess("PRODUCT_CREATE");
  const [categories, brands, fitments] = await Promise.all([
    db.category.findMany({ where: { active: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
    db.brand.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    listActiveMotorcycleFitmentsForProduct(),
  ]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Novo produto</CardTitle>
        <CardDescription>Crie um rascunho. A publicação depende da aprovação da Moto Shop.</CardDescription>
      </CardHeader>
      <CardContent>
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
  );
}
