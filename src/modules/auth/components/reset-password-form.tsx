"use client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { useState, type FormEvent } from "react";
import Link from "next/link";

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
        <p role="status" className="text-sm">
          Senha atualizada. Entre novamente com sua nova senha.
        </p>
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
              className="h-12 rounded-lg border-[#cfd2d5] bg-white px-4"
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
              className="h-12 rounded-lg border-[#cfd2d5] bg-white px-4"
            />
          </label>
          {error ? (
            <p role="alert" className="text-destructive text-sm">
              {error}
            </p>
          ) : null}
          <Button
            type="submit"
            disabled={pending}
            className="h-12 rounded-lg bg-[#242527] px-4 font-semibold text-white hover:bg-[#353638]"
          >
            {pending ? "Aguarde..." : "Salvar nova senha"}
          </Button>
        </>
      )}
      <Link href="/login" className="text-primary text-sm underline-offset-4 hover:underline">
        Ir para o login
      </Link>
    </form>
  );
}
