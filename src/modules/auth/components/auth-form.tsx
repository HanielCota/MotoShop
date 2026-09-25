"use client";

import { FormEvent, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { Route } from "next";

import { authClient } from "@/modules/auth/infrastructure/auth-client";

const inputClassName =
  "border-input bg-background focus:ring-ring/40 h-10 w-full rounded-md border px-3 text-sm outline-none focus:ring-3";

export function AuthForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(undefined);

    const result =
      mode === "sign-in"
        ? await authClient.signIn.email({ email, password })
        : await authClient.signUp.email({ name, email, password });

    setPending(false);
    if (result.error) {
      setError(result.error.message ?? "Não foi possível concluir a autenticação.");
      return;
    }

    const next = searchParams.get("next");
    const safeNext = next?.startsWith("/") && !next.startsWith("//") && !next.includes("\\") ? next : undefined;
    router.push((safeNext || (mode === "sign-up" ? "/seller" : "/products")) as Route);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {mode === "sign-up" ? (
        <label className="flex flex-col gap-2 text-sm font-medium">
          Nome
          <input className={inputClassName} value={name} onChange={(event) => setName(event.target.value)} required />
        </label>
      ) : null}
      <label className="flex flex-col gap-2 text-sm font-medium">
        E-mail
        <input
          className={inputClassName}
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />
      </label>
      <label className="flex flex-col gap-2 text-sm font-medium">
        Senha
        <input
          className={inputClassName}
          type="password"
          minLength={8}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />
      </label>
      {error ? (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      ) : null}
      <button
        className="bg-primary text-primary-foreground hover:bg-primary/80 h-10 rounded-md px-4 text-sm font-medium disabled:opacity-50"
        disabled={pending}
      >
        {pending ? "Aguarde..." : mode === "sign-in" ? "Entrar" : "Criar conta"}
      </button>
      <button
        type="button"
        className="text-muted-foreground hover:text-foreground text-sm underline-offset-4 hover:underline"
        onClick={() => {
          setMode(mode === "sign-in" ? "sign-up" : "sign-in");
          setError(undefined);
        }}
      >
        {mode === "sign-in" ? "Ainda não tenho conta" : "Já tenho uma conta"}
      </button>
    </form>
  );
}
