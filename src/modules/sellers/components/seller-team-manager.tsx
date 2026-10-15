"use client";

import { useState, useTransition } from "react";

import { ActionForm } from "@/components/ui/action-form";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DesignSelect } from "@/components/ui/design-select";
import { FormMessage } from "@/components/ui/form-message";
import { Input } from "@/components/ui/input";
import {
  inviteSellerMemberAction,
  removeSellerMemberAction,
  renewSellerInviteLinkAction,
  revokeSellerInviteAction,
  updateSellerMemberRoleAction,
  type SellerMemberActionState,
} from "@/modules/sellers/actions/seller-member-actions";
import { getSellerMemberRoleLabel } from "@/modules/sellers/domain/member-roles";
import { validateSellerInviteForm } from "@/modules/sellers/schemas/member-invite";
import { useClientValidation } from "@/shared/forms/client-validation";
import { useServerActionState } from "@/shared/forms/server-action-submit";

type Member = { id: string; name: string; email: string; role: string };
type PendingInvite = { id: string; email: string; role: string; daysLeft: number };

const initialState: SellerMemberActionState = {};
const COPY_FAILED_MESSAGE = "Não foi possível copiar. Selecione o link abaixo e copie.";

function RoleOptions() {
  return (
    <>
      <option value="ADMIN">Administrador</option>
      <option value="CATALOG">Catálogo</option>
      <option value="ORDERS">Pedidos</option>
      <option value="FINANCE">Financeiro</option>
    </>
  );
}

/** Copia o link; se o navegador recusar, mostra o link para a pessoa copiar à mão. */
function useCopyLink() {
  const [copied, setCopied] = useState<string | null>(null);
  const [manualUrl, setManualUrl] = useState<string | null>(null);

  async function copy(url: string, key: string) {
    try {
      await navigator.clipboard.writeText(url);
      setManualUrl(null);
      setCopied(key);
    } catch {
      setCopied(null);
      setManualUrl(url);
    }
  }

  return { copied, manualUrl, copy };
}

function ManualLink({ url }: { url: string | null }) {
  if (!url) return null;
  return (
    <div className="space-y-1">
      <FormMessage error={COPY_FAILED_MESSAGE} />
      <Input readOnly value={url} aria-label="Link do convite" onFocus={(event) => event.currentTarget.select()} />
    </div>
  );
}

function InviteForm() {
  const [state, formAction, pending] = useServerActionState(inviteSellerMemberAction, initialState);
  const { clientError, onSubmit } = useClientValidation(validateSellerInviteForm);
  const { copied, manualUrl, copy } = useCopyLink();
  const inviteUrl = clientError ? undefined : state.inviteUrl;

  return (
    <form
      action={formAction}
      onSubmit={onSubmit}
      noValidate
      className="grid gap-3 rounded-lg border p-4 sm:grid-cols-[1fr_180px_auto] sm:items-end"
    >
      <label className="flex flex-col gap-2 text-sm font-medium">
        E-mail
        <Input name="email" type="email" autoComplete="off" placeholder="pessoa@empresa.com" />
      </label>
      <label className="flex flex-col gap-2 text-sm font-medium">
        Perfil
        <DesignSelect aria-label="Perfil" name="role" defaultValue="CATALOG">
          <RoleOptions />
        </DesignSelect>
      </label>
      <Button type="submit" disabled={pending} className="rounded-md font-semibold">
        {pending ? "Enviando..." : "Enviar convite"}
      </Button>
      <div className="space-y-2 sm:col-span-3">
        <FormMessage
          error={clientError ?? state.error ?? null}
          success={clientError ? null : (state.success ?? null)}
        />
        {inviteUrl ? (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Button type="button" variant="outline" size="sm" onClick={() => void copy(inviteUrl, "new")}>
              {copied === "new" ? "Link copiado" : "Copiar link"}
            </Button>
            <span className="text-muted-foreground text-xs">
              Envie o link só para a pessoa convidada. Ele vale por 7 dias.
            </span>
          </div>
        ) : null}
        <ManualLink url={manualUrl} />
      </div>
    </form>
  );
}

function PendingInvites({ invites }: { invites: PendingInvite[] }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const { copied, manualUrl, copy } = useCopyLink();

  if (invites.length === 0) return null;

  function copyNewLink(inviteId: string) {
    startTransition(async () => {
      const result = await renewSellerInviteLinkAction(inviteId);
      setError(result.error ?? null);
      if (result.url) await copy(result.url, inviteId);
    });
  }

  return (
    <section aria-label="Convites pendentes" className="space-y-2 rounded-lg border p-4">
      <h3 className="text-sm font-semibold">Convites pendentes</h3>
      <p className="text-muted-foreground text-xs">
        &quot;Copiar link&quot; gera um link novo: o anterior, inclusive o do e-mail, deixa de valer.
      </p>
      <ul className="divide-border divide-y">
        {invites.map((invite) => (
          <li
            key={invite.id}
            className="flex flex-col gap-2 py-2 text-sm md:flex-row md:items-center md:justify-between"
          >
            <span className="min-w-0 break-all">
              {invite.email} · {getSellerMemberRoleLabel(invite.role)} · vence em {invite.daysLeft}{" "}
              {invite.daysLeft === 1 ? "dia" : "dias"}
            </span>
            <span className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={pending}
                onClick={() => copyNewLink(invite.id)}
              >
                {copied === invite.id ? "Link copiado" : "Copiar link"}
              </Button>
              <ActionForm action={revokeSellerInviteAction.bind(null, invite.id)}>
                <Button type="submit" variant="outline" size="sm" className="text-destructive">
                  Cancelar convite
                </Button>
              </ActionForm>
            </span>
          </li>
        ))}
      </ul>
      <FormMessage error={error} />
      <ManualLink url={manualUrl} />
    </section>
  );
}

export function SellerTeamManager({ members, invites }: { members: Member[]; invites: PendingInvite[] }) {
  return (
    <div className="space-y-4">
      <InviteForm />
      <PendingInvites invites={invites} />

      <div className="divide-border divide-y">
        {members.map((member) => (
          <div key={member.id} className="flex flex-col gap-3 py-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="font-medium">{member.name}</p>
              <p className="text-muted-foreground text-sm">
                {member.email} · {getSellerMemberRoleLabel(member.role)}
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
                    size="sm"
                  >
                    <RoleOptions />
                  </DesignSelect>
                  <Button type="submit" variant="outline" size="sm">
                    Salvar perfil
                  </Button>
                </ActionForm>
                {/* Tira o acesso da pessoa à Central: pede confirmação (BUG-004). */}
                <ConfirmDialog
                  trigger={
                    <Button type="button" variant="outline" size="sm" className="text-destructive">
                      Remover
                    </Button>
                  }
                  title={`Remover ${member.name || member.email} da equipe?`}
                  description="A pessoa perde o acesso à Central do Lojista desta loja. Para voltar, é preciso um novo convite."
                  confirmLabel="Remover"
                  tone="destructive"
                  onConfirm={() => removeSellerMemberAction(member.id)}
                />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
