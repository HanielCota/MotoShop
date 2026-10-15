"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { Button, buttonVariants } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { FormMessage } from "@/components/ui/form-message";
import { PasswordInput } from "@/components/ui/password-input";
import { authClient } from "@/modules/auth/infrastructure/auth-client";

import {
  changePasswordSchema,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  type ChangePasswordInput,
} from "../schemas/customer-account";

const emptyValues: ChangePasswordInput = { currentPassword: "", newPassword: "", confirmation: "" };

const changePasswordErrors: Record<string, string> = {
  INVALID_PASSWORD: "A senha atual está incorreta.",
  PASSWORD_TOO_SHORT: `A nova senha precisa ter pelo menos ${PASSWORD_MIN_LENGTH} caracteres.`,
  PASSWORD_TOO_LONG: `Use no máximo ${PASSWORD_MAX_LENGTH} caracteres.`,
  CREDENTIAL_ACCOUNT_NOT_FOUND: "Esta conta não usa senha para entrar.",
};

function changePasswordErrorMessage(error: { code?: string | undefined; status?: number | undefined }) {
  if (error.status === 429) return "Muitas tentativas em pouco tempo. Aguarde alguns instantes e tente novamente.";
  return (
    (error.code ? changePasswordErrors[error.code] : undefined) ??
    "Não foi possível alterar a senha. Confira os dados e tente novamente."
  );
}

export function ChangePasswordForm() {
  const [message, setMessage] = useState<{ error?: string; success?: string }>({});
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ChangePasswordInput>({ resolver: zodResolver(changePasswordSchema), defaultValues: emptyValues });

  const submit = handleSubmit(async ({ currentPassword, newPassword }) => {
    setMessage({});
    try {
      const result = await authClient.changePassword({ currentPassword, newPassword, revokeOtherSessions: true });
      if (result.error) {
        const error = changePasswordErrorMessage(result.error);
        if (result.error.code === "INVALID_PASSWORD") setError("currentPassword", { message: error });
        setMessage({ error });
        return;
      }
      reset(emptyValues);
      setMessage({
        success: "Senha alterada. Por segurança, encerramos o acesso nos outros aparelhos conectados à sua conta.",
      });
    } catch {
      setMessage({ error: "Não foi possível conectar. Verifique sua conexão e tente novamente." });
    }
  });

  return (
    <form onSubmit={submit} noValidate className="flex max-w-md flex-col gap-5">
      <FormField
        id="current-password"
        label="Senha atual"
        error={errors.currentPassword?.message}
        labelClassName="text-base"
        required
      >
        {(field) => (
          <PasswordInput
            {...field}
            {...register("currentPassword")}
            autoComplete="current-password"
            maxLength={PASSWORD_MAX_LENGTH}
            className="h-12 text-base"
          />
        )}
      </FormField>
      <FormField
        id="new-password"
        label="Nova senha"
        hint={`Use pelo menos ${PASSWORD_MIN_LENGTH} caracteres.`}
        error={errors.newPassword?.message}
        labelClassName="text-base"
        required
      >
        {(field) => (
          <PasswordInput
            {...field}
            {...register("newPassword")}
            autoComplete="new-password"
            maxLength={PASSWORD_MAX_LENGTH}
            className="h-12 text-base"
          />
        )}
      </FormField>
      <FormField
        id="new-password-confirmation"
        label="Confirme a nova senha"
        error={errors.confirmation?.message}
        labelClassName="text-base"
        required
      >
        {(field) => (
          <PasswordInput
            {...field}
            {...register("confirmation")}
            autoComplete="new-password"
            maxLength={PASSWORD_MAX_LENGTH}
            className="h-12 text-base"
          />
        )}
      </FormField>
      <FormMessage error={message.error ?? null} success={message.success ?? null} />
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
        <Button pending={isSubmitting} pendingLabel="Salvando…" type="submit" size="lg" className="h-12 px-5 text-base">
          Salvar nova senha
        </Button>
        <Link href="/forgot-password" className={buttonVariants({ variant: "link", size: "link" })}>
          Esqueci minha senha atual
        </Link>
      </div>
    </form>
  );
}
