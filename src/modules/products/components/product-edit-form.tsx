"use client";

import { updateProductAction, type ProductActionState } from "@/modules/products/actions/product-actions";

import { type Measurements } from "../domain/product-commercial-fields";
import { ProductFormFields, type ProductFormOptions } from "./product-form";
import { toProductFormValues, type VariantDraft } from "./product-form-model";
import { useServerActionState } from "@/shared/forms/server-action-submit";

type ProductValues = Measurements & {
  id: string;
  /** Versão lida (updatedAt ISO); enviada como `revision` para controle de concorrência otimista. */
  revision: string;
  name: string;
  slug: string;
  description: string;
  categoryId: string;
  brandId: string;
  variants: (VariantDraft & { id: string })[];
  motorcycleFitmentIds: string[];
};

const initialState: ProductActionState = {};

export function ProductEditForm({
  product,
  categories,
  brands,
  fitments,
}: {
  product: ProductValues;
} & ProductFormOptions) {
  const [state, action, pending] = useServerActionState(updateProductAction.bind(null, product.id), initialState);

  return (
    <ProductFormFields
      // Nova revisão salva no servidor => reinicia o formulário com os valores persistidos.
      key={product.revision}
      defaultValues={toProductFormValues(product)}
      options={{ categories, brands, fitments }}
      dispatch={action}
      pending={pending}
      state={state}
      submitLabel="Salvar alterações"
      slugLocked
      hiddenFields={{ revision: product.revision }}
    />
  );
}
