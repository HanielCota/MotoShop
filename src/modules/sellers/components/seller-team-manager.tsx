"use client";
import { ActionForm } from "@/components/ui/action-form";
import { FormMessage } from "@/components/ui/form-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { DesignSelect } from "@/components/ui/design-select";

import {
  addSellerMemberAction,
  removeSellerMemberAction,
  updateSellerMemberRoleAction,
  type SellerMemberActionState,
} from "@/modules/sellers/actions/seller-member-actions";
import { useServerActionState } from "@/shared/forms/server-action-submit";

type Member = { id: string; name: string; email: string; role: string };
const initialState: SellerMemberActionState = {};

function roleLabel(role: string) {
  return (
    { OWNER: "Proprietário", ADMIN: "Administrador", CATALOG: "Catálogo", ORDERS: "Pedidos", FINANCE: "Financeiro" }[
      role
    ] ?? role
  );
}

export function SellerTeamManager({ members }: { members: Member[] }) {
  const [state, formAction, pending] = useServerActionState(addSellerMemberAction, initialState);

  return (
    <div className="space-y-4">
      <form action={formAction} className="grid gap-3 rounded-lg border p-4 sm:grid-cols-[1fr_180px_auto] sm:items-end">
        <label className="flex flex-col gap-2 text-sm font-medium">
          E-mail de uma conta existente
          <Input name="email" type="email" required placeholder="pessoa@empresa.com" />
        </label>
        <label className="flex flex-col gap-2 text-sm font-medium">
          Perfil
          <DesignSelect aria-label="Perfil" name="role" defaultValue="CATALOG">
            <option value="ADMIN">Administrador</option>
            <option value="CATALOG">Catálogo</option>
            <option value="ORDERS">Pedidos</option>
            <option value="FINANCE">Financeiro</option>
          </DesignSelect>
        </label>
        <Button pending={pending} pendingLabel="Adicionando…" type="submit" className="rounded-md font-semibold">
          Adicionar membro
        </Button>
        <FormMessage error={state.error ?? null} success={state.success ?? null} className="sm:col-span-3" />
      </form>

      <div className="divide-border divide-y">
        {members.map((member) => (
          <div key={member.id} className="flex flex-col gap-3 py-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="font-medium">{member.name}</p>
              <p className="text-muted-foreground text-sm">
                {member.email} · {roleLabel(member.role)}
              </p>
            </div>
            {member.role === "OWNER" ? (
              <span className="text-muted-foreground text-xs">Responsável principal</span>
            ) : (
              <div className="flex flex-wrap gap-2">
                <ActionForm action={updateSellerMemberRoleAction.bind(null, member.id)} className="flex gap-2">
                  <DesignSelect
                    aria-label={`Perfil de ${member.name || member.email}`}
                    name="role"
                    defaultValue={member.role}
                    className="h-9"
                  >
                    <option value="ADMIN">Administrador</option>
                    <option value="CATALOG">Catálogo</option>
                    <option value="ORDERS">Pedidos</option>
                    <option value="FINANCE">Financeiro</option>
                  </DesignSelect>
                  <Button type="submit" variant="outline" size="sm">
                    Salvar perfil
                  </Button>
                </ActionForm>
                <ActionForm action={removeSellerMemberAction.bind(null, member.id)}>
                  <Button type="submit" variant="outline" size="sm" className="text-destructive">
                    Remover
                  </Button>
                </ActionForm>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
