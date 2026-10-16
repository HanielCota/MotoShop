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

import { resetPasswordSchema, type ResetPasswordInput } from "../schemas/reset-password";

export function ResetPasswordForm({ token }: { token: string }) {
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string>();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordInput>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { newPassword: "", confirmation: "" },
  });

  const submit = handleSubmit(async ({ newPassword }) => {
    setError(undefined);
    try {
      const result = await authClient.resetPassword({ newPassword, token });
      if (result.error) {
        setError("Este link expirou ou já foi utilizado. Solicite um novo link.");
        return;
      }
      setDone(true);
    } catch {
      setError("Não foi possível conectar. Verifique sua conexão e tente novamente.");
    }
  });

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      {done ? (
        <FormMessage success="Senha atualizada. Entre novamente com sua nova senha." />
      ) : (
        <>
          <FormField
            id="reset-new-password"
            label="Nova senha"
            required
            hint="Pelo menos 8 caracteres."
            error={errors.newPassword?.message}
          >
            {(field) => (
              <PasswordInput {...field} {...register("newPassword")} autoComplete="new-password" maxLength={128} />
            )}
          </FormField>
          <FormField
            id="reset-confirmation"
            label="Confirme a nova senha"
            required
            error={errors.confirmation?.message}
          >
            {(field) => (
              <PasswordInput {...field} {...register("confirmation")} autoComplete="new-password" maxLength={128} />
            )}
          </FormField>
          <FormMessage error={error ?? null} />
          <Button pending={isSubmitting} pendingLabel="Aguarde…" type="submit" size="lg">
            Salvar nova senha
          </Button>
        </>
      )}
      <Link href="/login" className={buttonVariants({ variant: "link", size: "link" })}>
        Ir para o login
      </Link>
    </form>
  );
}
