import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireAuthenticatedUser } from "@/modules/auth/application/authorization";
import { CustomerAddressActions } from "@/modules/customers/components/customer-address-actions";
import { CustomerAddressForm } from "@/modules/customers/components/customer-address-form";
import { listCustomerAddresses } from "@/modules/customers/queries/customer-addresses";
import { loadCustomerAddressSearchParams } from "@/modules/customers/search-params";

export default async function CustomerAddressesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireAuthenticatedUser("/account/addresses");
  const params = await loadCustomerAddressSearchParams(searchParams);
  const addresses = await listCustomerAddresses(session.user.id, { query: params.addressQ });

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-10 sm:px-6">
      <div>
        <Badge variant="secondary">Minha conta</Badge>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-5xl">Endereços salvos</h1>
        <p className="text-muted-foreground mt-3">Deixe o próximo checkout mais rápido.</p>
      </div>

      <form className="flex flex-wrap items-end gap-3 rounded-xl border p-4" method="get">
        <label className="flex min-w-64 flex-col gap-2 text-sm font-medium">
          Buscar endereço
          <input
            className="border-input bg-background h-10 rounded-md border px-3 text-sm"
            name="addressQ"
            defaultValue={params.addressQ ?? ""}
            placeholder="Rótulo, destinatário, cidade ou CEP"
          />
        </label>
        <button className="bg-primary text-primary-foreground h-10 rounded-md px-4 text-sm font-medium">Buscar</button>
      </form>

      {addresses.length > 0 ? (
        <section className="grid gap-4 sm:grid-cols-2" aria-label="Endereços cadastrados">
          {addresses.map((address) => (
            <Card key={address.id}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between gap-3 text-lg">
                  {address.label}
                  {address.isDefault ? <Badge variant="secondary">Padrão</Badge> : null}
                </CardTitle>
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
                <CustomerAddressActions addressId={address.id} isDefault={address.isDefault} />
              </CardContent>
            </Card>
          ))}
        </section>
      ) : null}

      <CustomerAddressForm />
    </main>
  );
}
