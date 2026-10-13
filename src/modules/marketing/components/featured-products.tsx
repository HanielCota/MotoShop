import { PackageSearch } from "lucide-react";

import { ProductCard, type ProductCardData } from "@/components/storefront/product-card";
import { EmptyState } from "@/components/ui/empty-state";

import { SectionHeading } from "./section-heading";

export function FeaturedProducts({ products }: { products: ProductCardData[] }) {
  return (
    <section className="mx-auto w-full max-w-6xl px-4 pb-14 sm:px-6 sm:pb-20" aria-labelledby="featured-products-title">
      <SectionHeading
        kicker="Destaques"
        title="Produtos em destaque"
        titleId="featured-products-title"
        link={{ label: "Ver catálogo completo", href: "/products" }}
      />
      {products.length === 0 ? (
        <EmptyState
          icon={PackageSearch}
          title="Seleção em preparação"
          description="Estamos preparando a primeira seleção de produtos das lojas aprovadas."
          action={{ label: "Explorar o catálogo", href: "/products" }}
        />
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
          {products.map((product, index) => (
            <li key={product.id} className="flex min-w-0">
              <ProductCard product={product} eager={index === 0} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
