import type { ReactNode } from "react";

import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ActionForm } from "@/components/ui/action-form";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import {
  BrandForm,
  CategoryForm,
  MotorcycleFitmentForm,
  MotorcycleManufacturerForm,
  MotorcycleModelForm,
} from "@/modules/catalog/components/catalog-admin-forms";
import {
  setCategoryUniversalAction,
  toggleBrandAction,
  toggleCategoryAction,
  toggleMotorcycleManufacturerAction,
  toggleMotorcycleModelAction,
} from "@/modules/catalog/actions/admin-catalog-actions";
import { getCategoryLabel } from "@/modules/catalog/category-labels";
import { getAdminCatalogData } from "@/modules/catalog/queries/admin-catalog";

import { AdminCard } from "../admin-ui";
import { formatCount } from "@/lib/format";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function CatalogColumn({ title, form, children }: { title: string; form: ReactNode; children: ReactNode }) {
  return (
    <section className="min-w-0 space-y-3" aria-label={title}>
      <h3 className="font-semibold">{title}</h3>
      {form}
      {children}
    </section>
  );
}

function CatalogRow({
  label,
  count,
  active,
  toggle,
  badge,
  extraAction,
}: {
  label: ReactNode;
  count?: string;
  active: boolean;
  toggle: () => Promise<void>;
  badge?: ReactNode;
  extraAction?: ReactNode;
}) {
  return (
    <li className="flex items-center justify-between gap-2 py-2 text-sm">
      <span className="min-w-0 break-words">
        {label} {count ? <span className="text-muted-foreground">({count})</span> : null}
        {badge}
        {!active ? (
          <Badge variant="neutral" className="ml-2">
            Inativo
          </Badge>
        ) : null}
      </span>
      <span className="flex shrink-0 flex-col items-end gap-1">
        {extraAction}
        <StatusToggle label={label} active={active} toggle={toggle} />
      </span>
    </li>
  );
}

function StatusToggle({ label, active, toggle }: { label: ReactNode; active: boolean; toggle: () => Promise<void> }) {
  return active ? (
    // Desativar some com a referência dos filtros e do cadastro: pede confirmação (BUG-004).
    <ConfirmDialog
      trigger={
        <button type="button" className={cn(buttonVariants({ variant: "link", size: "link-xs" }), "shrink-0")}>
          Desativar
        </button>
      }
      title={`Desativar ${typeof label === "string" ? label : "este item"}?`}
      description="Ele deixa de aparecer para lojistas e no site até ser reativado. Produtos já cadastrados não são apagados."
      confirmLabel="Desativar"
      tone="destructive"
      onConfirm={toggle}
    />
  ) : (
    <ActionForm action={toggle}>
      <button type="submit" className={cn(buttonVariants({ variant: "link", size: "link-xs" }), "shrink-0")}>
        Ativar
      </button>
    </ActionForm>
  );
}

/** Universal categories skip the motorcycle filter, so changing it is reversible and needs no dialog. */
function UniversalToggle({ universal, toggle }: { universal: boolean; toggle: () => Promise<void> }) {
  return (
    <ActionForm action={toggle}>
      <button type="submit" className={cn(buttonVariants({ variant: "link", size: "link-xs" }), "shrink-0")}>
        {universal ? "Tirar universal" : "Marcar como universal"}
      </button>
    </ActionForm>
  );
}

function EmptyCatalogList({ title }: { title: string }) {
  return <EmptyState variant="inline" title={title} />;
}

export async function AdminCatalogSection() {
  const catalog = await getAdminCatalogData();

  const categoryOptions = catalog.categories.map((category) => ({
    id: category.id,
    label: category.parent
      ? `${getCategoryLabel(category.parent)} / ${getCategoryLabel(category)}`
      : getCategoryLabel(category),
  }));
  const manufacturerOptions = catalog.manufacturers.map((manufacturer) => ({
    id: manufacturer.id,
    label: manufacturer.name,
  }));
  const modelOptions = catalog.manufacturers.flatMap((manufacturer) =>
    manufacturer.models.map((model) => ({ id: model.id, label: `${manufacturer.name} ${model.name}` })),
  );
  const models = catalog.manufacturers.flatMap((manufacturer) =>
    manufacturer.models.map((model) => ({ manufacturer, model })),
  );
  const fitments = models.flatMap(({ manufacturer, model }) =>
    model.fitments.slice(0, 8).map((fitment) => ({ manufacturer, model, fitment })),
  );

  return (
    <AdminCard
      id="admin-catalog"
      title="Catálogo controlado pelo Moto Shop"
      description="Lojistas usam estas categorias, marcas e motos aprovadas. Desativar preserva o histórico e impede novos usos. Categoria universal (e as subcategorias dela) aparece com qualquer moto escolhida no catálogo."
      contentClassName="space-y-8"
    >
      <div className="grid gap-6 lg:grid-cols-3">
        <CatalogColumn title="Categorias" form={<CategoryForm categories={categoryOptions} />}>
          {catalog.categories.length === 0 ? (
            <EmptyCatalogList title="Nenhuma categoria cadastrada" />
          ) : (
            <ul className="divide-border divide-y">
              {catalog.categories.map((category) => (
                <CatalogRow
                  key={category.id}
                  label={categoryOptions.find((option) => option.id === category.id)?.label}
                  count={formatCount(category._count.products, "produto", "produtos")}
                  active={category.active}
                  toggle={toggleCategoryAction.bind(null, category.id, !category.active)}
                  badge={
                    category.universal ? (
                      <Badge variant="info" className="ml-2">
                        Universal
                      </Badge>
                    ) : null
                  }
                  extraAction={
                    <UniversalToggle
                      universal={category.universal}
                      toggle={setCategoryUniversalAction.bind(null, category.id, !category.universal)}
                    />
                  }
                />
              ))}
            </ul>
          )}
        </CatalogColumn>
        <CatalogColumn title="Marcas" form={<BrandForm />}>
          {catalog.brands.length === 0 ? (
            <EmptyCatalogList title="Nenhuma marca cadastrada" />
          ) : (
            <ul className="divide-border divide-y">
              {catalog.brands.map((brand) => (
                <CatalogRow
                  key={brand.id}
                  label={brand.name}
                  count={formatCount(brand._count.products, "produto", "produtos")}
                  active={brand.active}
                  toggle={toggleBrandAction.bind(null, brand.id, !brand.active)}
                />
              ))}
            </ul>
          )}
        </CatalogColumn>
        <CatalogColumn title="Fabricantes" form={<MotorcycleManufacturerForm />}>
          {catalog.manufacturers.length === 0 ? (
            <EmptyCatalogList title="Nenhum fabricante cadastrado" />
          ) : (
            <ul className="divide-border divide-y">
              {catalog.manufacturers.map((manufacturer) => (
                <CatalogRow
                  key={manufacturer.id}
                  label={manufacturer.name}
                  active={manufacturer.active}
                  toggle={toggleMotorcycleManufacturerAction.bind(null, manufacturer.id, !manufacturer.active)}
                />
              ))}
            </ul>
          )}
        </CatalogColumn>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <CatalogColumn title="Modelos" form={<MotorcycleModelForm manufacturers={manufacturerOptions} />}>
          {models.length === 0 ? (
            <EmptyCatalogList title="Nenhum modelo cadastrado" />
          ) : (
            <ul className="divide-border divide-y">
              {models.map(({ manufacturer, model }) => (
                <CatalogRow
                  key={model.id}
                  label={`${manufacturer.name} ${model.name}`}
                  count={formatCount(model._count.fitments, "compatibilidade", "compatibilidades")}
                  active={model.active}
                  toggle={toggleMotorcycleModelAction.bind(null, model.id, !model.active)}
                />
              ))}
            </ul>
          )}
        </CatalogColumn>
        <CatalogColumn title="Compatibilidades de motos" form={<MotorcycleFitmentForm models={modelOptions} />}>
          {fitments.length === 0 ? (
            <EmptyCatalogList title="Nenhuma compatibilidade cadastrada" />
          ) : (
            <ul className="divide-border divide-y">
              {fitments.map(({ manufacturer, model, fitment }) => (
                <li key={fitment.id} className="py-2 text-sm">
                  {manufacturer.name} {model.name} · {fitment.version || "padrão"} · {fitment.displacementCc}cc ·{" "}
                  {fitment.year}
                </li>
              ))}
            </ul>
          )}
        </CatalogColumn>
      </div>
    </AdminCard>
  );
}
