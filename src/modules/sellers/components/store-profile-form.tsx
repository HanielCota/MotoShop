"use client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";

import { useActionState } from "react";

import { updateStoreProfileAction, type StoreProfileActionState } from "../actions/store-profile-actions";

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

  return (
    <form action={action} className="grid gap-4">
      <label className="flex flex-col gap-2 text-sm font-medium">
        Nome público
        <Input name="name" defaultValue={store.name} required maxLength={120} />
      </label>
      <label className="flex flex-col gap-2 text-sm font-medium">
        Identificador da loja
        <Input
          name="slug"
          defaultValue={store.slug}
          pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
          maxLength={120}
          required
          aria-describedby="store-slug-help"
        />
        <span id="store-slug-help" className="text-muted-foreground text-xs font-normal">
          URL pública: /loja/{store.slug}. Acentos e espaços são convertidos automaticamente.
        </span>
      </label>
      <label className="flex flex-col gap-2 text-sm font-medium">
        Descrição pública
        <Textarea
          className="border-input bg-background focus:ring-ring/40 min-h-24 w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-3"
          name="description"
          defaultValue={store.description ?? ""}
          maxLength={500}
          placeholder="Apresente sua loja para os clientes do Moto Shop."
        />
      </label>
      <fieldset className="grid gap-4 rounded-lg border p-4 sm:grid-cols-2">
        <legend className="px-1 text-sm font-semibold">Redes sociais e contato</legend>
        <label className="flex flex-col gap-2 text-sm font-medium">
          Instagram
          <Input name="instagramUrl" type="url" defaultValue={store.instagramUrl ?? ""} placeholder="https://instagram.com/sualoja" />
        </label>
        <label className="flex flex-col gap-2 text-sm font-medium">
          YouTube
          <Input name="youtubeUrl" type="url" defaultValue={store.youtubeUrl ?? ""} placeholder="https://youtube.com/@sualoja" />
        </label>
        <label className="flex flex-col gap-2 text-sm font-medium">
          WhatsApp
          <Input name="whatsappUrl" type="url" defaultValue={store.whatsappUrl ?? ""} placeholder="https://wa.me/5511999999999" />
        </label>
        <label className="flex flex-col gap-2 text-sm font-medium">
          Facebook
          <Input name="facebookUrl" type="url" defaultValue={store.facebookUrl ?? ""} placeholder="https://facebook.com/sualoja" />
        </label>
        <p className="text-muted-foreground text-xs sm:col-span-2">Os links preenchidos ficam visíveis na vitrine pública da loja.</p>
      </fieldset>
      {state.error ? (
        <p className="text-destructive text-sm" role="alert">
          {state.error}
        </p>
      ) : null}
      {state.success ? (
        <p className="text-sm text-emerald-600" role="status">
          {state.success}
        </p>
      ) : null}
      <Button type="submit" className="rounded-md px-4" disabled={pending}>
        {pending ? "Salvando..." : "Salvar perfil público"}
      </Button>
    </form>
  );
}
