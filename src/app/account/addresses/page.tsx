import type { Metadata } from "next";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MapPin, SearchX } from "lucide-react";

import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { requireAuthenticatedUser } from "@/modules/auth/application/authorization";
import { CustomerAddressActions } from "@/modules/customers/components/customer-address-actions";
import { CustomerAddressForm } from "@/modules/customers/components/customer-address-form";
import { listCustomerAddresses } from "@/modules/customers/queries/customer-addresses";
import { loadCustomerAddressSearchParams } from "@/modules/customers/search-params";
import { CustomerAccountShell } from "@/modules/customers/components/customer-account-shell";

export const metadata: Metadata = {
  title: "Meus endereços",
  robots: { index: false, follow: false },
};

export default async function CustomerAddressesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireAuthenticatedUser("/account/addresses");
  const params = await loadCustomerAddressSearchParams(searchParams);
  const addresses = await listCustomerAddresses(session.user.id, { query: params.addressQ });

  return (
    <CustomerAccountShell pathname="/account/addresses" userName={session.user.name}>
      <PageHeader eyebrow="Minha conta" title="Meus endereços" description="Deixe o próximo checkout mais rápido." />

      {/* No address yet: only the empty state and the form to add one, without a search for nothing. */}
      {addresses.length > 0 || Boolean(params.addressQ?.trim()) ? (
        <>
          <form
            className="border-border bg-card flex flex-wrap items-end gap-3 rounded-xl border p-4"
            method="get"
            role="search"
          >
            <label className="flex min-w-0 flex-1 flex-col gap-2 text-sm font-medium sm:min-w-64 sm:flex-none">
              Buscar endereço
              <Input
                type="search"
                className="h-11"
                name="addressQ"
                defaultValue={params.addressQ ?? ""}
                placeholder="Rótulo, destinatário, cidade ou CEP"
              />
            </label>
            <Button type="submit" size="lg" className="px-4">
              Buscar
            </Button>
          </form>
        </>
      ) : null}

      {addresses.length > 0 ? (
        <section aria-label="Endereços cadastrados">
          <ul className="grid gap-4 sm:grid-cols-2">
            {addresses.map((address) => (
              <li key={address.id} className="flex min-w-0">
                <Card className="w-full">
                  <CardHeader>
                    <div className="flex items-center justify-between gap-3">
                      <CardTitle>{address.label}</CardTitle>
                      {address.isDefault ? <Badge variant="brand">Padrão</Badge> : null}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-sm">
                      {address.recipient}
                      <br />
                      {address.street}, {address.number}
                      {address.complement ? ` · ${address.complement}` : ""}
                      <br />
                      {address.neighborhood} · {address.city}/{address.state}
                      <br />
                      CEP {address.postalCode}
                    </p>
                    <CustomerAddressActions
                      addressId={address.id}
                      label={address.label}
                      isDefault={address.isDefault}
                    />
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        </section>
      ) : params.addressQ?.trim() ? (
        <EmptyState
          icon={SearchX}
          title="Nenhum endereço encontrado"
          description="Nenhum endereço corresponde à busca."
          action={{ label: "Limpar busca", href: "/account/addresses" }}
        />
      ) : (
        <EmptyState
          icon={MapPin}
          title="Nenhum endereço salvo"
          description="Use o formulário abaixo para cadastrar o primeiro e agilizar o checkout."
        />
      )}

      <CustomerAddressForm />
    </CustomerAccountShell>
  );
}
