"use client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { useState, type FormEvent } from "react";
import Link from "next/link";

import { FormMessage } from "@/components/ui/form-message";

import { authClient } from "@/modules/auth/infrastructure/auth-client";

export function ResetPasswordForm({ token }: { token: string }) {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string>();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (password !== confirmation) {
      setError("As senhas não coincidem.");
      return;
    }
    setPending(true);
    setError(undefined);
    try {
      const result = await authClient.resetPassword({ newPassword: password, token });
      if (result.error) {
        setError("Este link expirou ou já foi utilizado. Solicite um novo link.");
        return;
      }
      setDone(true);
    } catch {
      setError("Não foi possível conectar. Verifique sua conexão e tente novamente.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      {done ? (
        <FormMessage success="Senha atualizada. Entre novamente com sua nova senha." />
      ) : (
        <>
          <label className="flex flex-col gap-2 text-sm font-medium">
            Nova senha
            <Input
              type="password"
              autoComplete="new-password"
              minLength={8}
              maxLength={128}
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="bg-card h-12 rounded-lg px-4"
            />
          </label>
          <label className="flex flex-col gap-2 text-sm font-medium">
            Confirme a nova senha
            <Input
              type="password"
              autoComplete="new-password"
              minLength={8}
              maxLength={128}
              required
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              className="bg-card h-12 rounded-lg px-4"
            />
          </label>
          <FormMessage error={error ?? null} />
          <Button
            type="submit"
            disabled={pending}
            className="h-12 rounded-lg px-4 font-semibold"
          >
            {pending ? "Aguarde..." : "Salvar nova senha"}
          </Button>
        </>
      )}
      <Link href="/login" className="text-brand-strong inline-flex min-h-10 items-center text-sm font-medium underline-offset-4 hover:underline">
        Ir para o login
      </Link>
    </form>
  );
}
