"use client";

import { useActionState } from "react";

import {
  addSellerMemberAction,
  removeSellerMemberAction,
  updateSellerMemberRoleAction,
  type SellerMemberActionState,
} from "@/modules/sellers/actions/seller-member-actions";

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
  const [state, formAction, pending] = useActionState(addSellerMemberAction, initialState);

  return (
    <div className="space-y-4">
      <form action={formAction} className="grid gap-3 rounded-lg border p-4 sm:grid-cols-[1fr_180px_auto] sm:items-end">
        <label className="flex flex-col gap-2 text-sm font-medium">
          E-mail de uma conta existente
          <input
            name="email"
            type="email"
            required
            placeholder="pessoa@empresa.com"
            className="h-10 rounded-md border px-3 text-sm"
          />
        </label>
        <label className="flex flex-col gap-2 text-sm font-medium">
          Perfil
          <select name="role" defaultValue="CATALOG" className="h-10 rounded-md border px-3 text-sm">
            <option value="ADMIN">Administrador</option>
            <option value="CATALOG">Catálogo</option>
            <option value="ORDERS">Pedidos</option>
            <option value="FINANCE">Financeiro</option>
          </select>
        </label>
        <button
          type="submit"
          disabled={pending}
          className="bg-primary text-primary-foreground h-10 rounded-md px-3 text-sm font-semibold disabled:opacity-60"
        >
          {pending ? "Adicionando..." : "Adicionar membro"}
        </button>
        {state.error ? <p className="text-destructive text-sm sm:col-span-3">{state.error}</p> : null}
        {state.success ? <p className="text-sm text-emerald-700 sm:col-span-3">{state.success}</p> : null}
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
                <form action={updateSellerMemberRoleAction.bind(null, member.id)} className="flex gap-2">
                  <select name="role" defaultValue={member.role} className="h-9 rounded-md border px-2 text-xs">
                    <option value="ADMIN">Administrador</option>
                    <option value="CATALOG">Catálogo</option>
                    <option value="ORDERS">Pedidos</option>
                    <option value="FINANCE">Financeiro</option>
                  </select>
                  <button className="h-9 rounded-md border px-3 text-xs font-medium">Salvar perfil</button>
                </form>
                <form action={removeSellerMemberAction.bind(null, member.id)}>
                  <button className="text-destructive h-9 rounded-md border px-3 text-xs font-medium">Remover</button>
                </form>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
