"use client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { useState, type FormEvent } from "react";
import Link from "next/link";

import { authClient } from "@/modules/auth/infrastructure/auth-client";

export function PasswordRecoveryForm() {
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string>();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(undefined);
    try {
      const result = await authClient.requestPasswordReset({ email, redirectTo: "/reset-password" });
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
    <form onSubmit={submit} className="flex flex-col gap-4">
      {done ? (
        <p role="status" className="text-sm">
          Se este e-mail estiver cadastrado, você receberá um link para criar uma nova senha.
        </p>
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
            {pending ? "Aguarde..." : "Enviar link de recuperação"}
          </Button>
        </>
      )}
      <Link href="/login" className="text-primary text-sm underline-offset-4 hover:underline">
        Voltar para entrar
      </Link>
    </form>
  );
}
