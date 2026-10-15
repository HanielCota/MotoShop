"use client";
import { FormMessage } from "@/components/ui/form-message";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";

import { useActionState } from "react";

import { updateStoreProfileAction, type StoreProfileActionState } from "../actions/store-profile-actions";
import { validateStoreProfileForm } from "../schemas/store-profile";
import { STORE_SLUG_EXAMPLE } from "../schemas/store-slug";
import { useClientValidation } from "@/shared/forms/client-validation";

type StoreProfileFormProps = {
  store: {
    name: string;
    slug: string;
    description: string | null;
    instagramUrl: string | null;
    youtubeUrl: string | null;
    whatsappUrl: string | null;
    facebookUrl: string | null;
  };
};

const initialState: StoreProfileActionState = {};

export function StoreProfileForm({ store }: StoreProfileFormProps) {
  const [state, action, pending] = useActionState(updateStoreProfileAction, initialState);
  const { clientError, onSubmit } = useClientValidation(validateStoreProfileForm);
  const slugError = clientError ? clientError.slugError : state.slugError;
  const formError = clientError ? (clientError.error ?? null) : (state.error ?? null);
  const values = state.values ?? storeFormValues(store);

  return (
    <form action={action} onSubmit={onSubmit} noValidate className="grid gap-4">
      <label className="flex flex-col gap-2 text-sm font-medium">
        Nome público
        <Input name="name" defaultValue={values.name} required maxLength={120} />
      </label>
      <FormField
        id="store-slug"
        label="Identificador da loja"
        error={slugError}
        hint={
          <>
            {STORE_SLUG_EXAMPLE}
            <br />
            URL pública: /loja/{store.slug}. Acentos e espaços são convertidos automaticamente.
          </>
        }
      >
        {(field) => <Input {...field} name="slug" defaultValue={values.slug} maxLength={120} autoComplete="off" />}
      </FormField>
      <label className="flex flex-col gap-2 text-sm font-medium">
        Descrição pública
        <Textarea
          className="border-input bg-background focus:ring-ring/40 min-h-24 w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-3"
          name="description"
          defaultValue={values.description}
          maxLength={500}
          placeholder="Apresente sua loja para os clientes do Moto Shop."
        />
      </label>
      <fieldset className="grid gap-4 rounded-lg border p-4 sm:grid-cols-2">
        <legend className="px-1 text-sm font-semibold">Redes sociais e contato</legend>
        <label className="flex flex-col gap-2 text-sm font-medium">
          Instagram
          <Input
            name="instagramUrl"
            type="url"
            defaultValue={values.instagramUrl}
            placeholder="https://instagram.com/sualoja"
          />
        </label>
        <label className="flex flex-col gap-2 text-sm font-medium">
          YouTube
          <Input
            name="youtubeUrl"
            type="url"
            defaultValue={values.youtubeUrl}
            placeholder="https://youtube.com/@sualoja"
          />
        </label>
        <label className="flex flex-col gap-2 text-sm font-medium">
          WhatsApp
          <Input
            name="whatsappUrl"
            type="url"
            defaultValue={values.whatsappUrl}
            placeholder="https://wa.me/5511999999999"
          />
        </label>
        <label className="flex flex-col gap-2 text-sm font-medium">
          Facebook
          <Input
            name="facebookUrl"
            type="url"
            defaultValue={values.facebookUrl}
            placeholder="https://facebook.com/sualoja"
          />
        </label>
        <p className="text-muted-foreground text-xs sm:col-span-2">
          Os links preenchidos ficam visíveis na vitrine pública da loja.
        </p>
      </fieldset>
      <FormMessage error={formError} success={clientError ? null : (state.success ?? null)} />
      <Button type="submit" className="rounded-md px-4" disabled={pending}>
        {pending ? "Salvando..." : "Salvar perfil público"}
      </Button>
    </form>
  );
}

function storeFormValues(store: StoreProfileFormProps["store"]) {
  return {
    name: store.name,
    slug: store.slug,
    description: store.description ?? "",
    instagramUrl: store.instagramUrl ?? "",
    youtubeUrl: store.youtubeUrl ?? "",
    whatsappUrl: store.whatsappUrl ?? "",
    facebookUrl: store.facebookUrl ?? "",
  };
}
