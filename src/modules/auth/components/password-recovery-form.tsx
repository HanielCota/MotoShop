"use client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { useState, type FormEvent } from "react";
import Link from "next/link";

import { FormMessage } from "@/components/ui/form-message";

import { authClient } from "@/modules/auth/infrastructure/auth-client";

export function PasswordRecoveryForm() {
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string>();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError("Informe um e-mail válido.");
      return;
    }
    setPending(true);
    setError(undefined);
    try {
      const result = await authClient.requestPasswordReset({ email: email.trim(), redirectTo: "/reset-password" });
      if (result.error) {
        setError("Não foi possível solicitar a recuperação agora. Tente novamente em instantes.");
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
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      {done ? (
        <FormMessage success="Se este e-mail estiver cadastrado, você receberá um link para criar uma nova senha." />
      ) : (
        <>
          <label className="flex flex-col gap-2 text-sm font-medium">
            E-mail da conta
            <Input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="bg-card h-12 rounded-lg px-4"
            />
          </label>
          <FormMessage error={error ?? null} />
          <Button
            type="submit"
            disabled={pending}
            className="h-12 rounded-lg px-4 font-semibold"
          >
            {pending ? "Aguarde..." : "Enviar link de recuperação"}
          </Button>
        </>
      )}
      <Link href="/login" className="text-brand-strong inline-flex min-h-10 items-center text-sm font-medium underline-offset-4 hover:underline">
        Voltar para entrar
      </Link>
    </form>
  );
}
