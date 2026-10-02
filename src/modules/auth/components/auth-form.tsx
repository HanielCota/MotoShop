"use client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { FormEvent, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { Route } from "next";
import Link from "next/link";

import { authClient } from "@/modules/auth/infrastructure/auth-client";
import { getAuthErrorMessage } from "../domain/auth-error-message";

export function AuthForm({
  emailEnabled,
  verificationRequired,
}: {
  emailEnabled: boolean;
  verificationRequired: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    setNotice(undefined);

    if (mode === "sign-up" && !name.trim()) {
      setError("Informe seu nome.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError("Informe um e-mail válido.");
      return;
    }
    if (password.length < 8) {
      setError("A senha precisa ter pelo menos 8 caracteres.");
      return;
    }
    setPending(true);

    try {
      const result =
        mode === "sign-in"
          ? await authClient.signIn.email({ email, password })
          : await authClient.signUp.email({ name, email, password, callbackURL: "/login?verified=1" });

      if (result.error) {
        setError(getAuthErrorMessage(result.error.code));
        return;
      }

      if (mode === "sign-up" && verificationRequired) {
        setMode("sign-in");
        setPassword("");
        setNotice("Conta criada. Enviamos um link para confirmar seu e-mail antes de entrar.");
        return;
      }

      const next = searchParams.get("next");
      const safeNext = next?.startsWith("/") && !next.startsWith("//") && !next.includes("\\") ? next : undefined;
      router.push((safeNext || (mode === "sign-up" ? "/seller" : "/products")) as Route);
      router.refresh();
    } catch {
      setError("Não foi possível conectar. Verifique sua conexão e tente novamente.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
      <div className="mb-1">
        <h1 className="text-3xl font-bold tracking-tight text-[#1b1a18] uppercase sm:text-4xl">
          {mode === "sign-in" ? "Acesse sua conta" : "Crie sua conta"}
        </h1>
        <p className="mt-2 text-sm leading-6 text-[#626365]">
          {mode === "sign-in"
            ? "Entre para acompanhar seus pedidos e cuidar da sua loja."
            : "Uma conta para comprar e vender no Moto Shop."}
        </p>
      </div>
      {mode === "sign-up" ? (
        <label className="flex flex-col gap-2 text-sm font-medium">
          Nome
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
            autoComplete="name"
            placeholder="Como podemos chamar você?"
            className="h-12 rounded-lg border-[#cfd2d5] bg-white px-4"
            required
          />
        </label>
      ) : null}
      <label className="flex flex-col gap-2 text-sm font-medium">
        E-mail
        <Input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          autoComplete="email"
          placeholder="voce@exemplo.com"
          className="h-12 rounded-lg border-[#cfd2d5] bg-white px-4"
          required
        />
      </label>
      <label className="flex flex-col gap-2 text-sm font-medium">
        Senha
        <Input
          type="password"
          minLength={8}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
          placeholder="Pelo menos 8 caracteres"
          className="h-12 rounded-lg border-[#cfd2d5] bg-white px-4"
          required
        />
      </label>
      {searchParams.has("error") ? (
        <p className="text-destructive text-sm" role="alert">
          Não foi possível confirmar o e-mail. Solicite outro link de confirmação.
        </p>
      ) : searchParams.get("verified") === "1" ? (
        <p className="text-sm text-green-700" role="status">
          E-mail confirmado. Entre com sua senha.
        </p>
      ) : null}
      {notice ? (
        <p className="text-sm text-green-700" role="status">
          {notice}
        </p>
      ) : null}
      {error ? (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      ) : null}
      <Button type="submit" className="h-12 rounded-sm px-4 font-bold tracking-wide uppercase" disabled={pending}>
        {pending ? "Aguarde..." : mode === "sign-in" ? "Entrar" : "Criar conta"}
      </Button>
      {emailEnabled && mode === "sign-in" ? (
        <div className="flex flex-wrap justify-between gap-3 text-sm">
          <Link className="text-primary underline-offset-4 hover:underline" href="/forgot-password">
            Esqueci minha senha
          </Link>
          <button
            type="button"
            className="text-primary underline-offset-4 hover:underline disabled:opacity-50"
            disabled={pending || !email}
            onClick={async () => {
              setPending(true);
              setError(undefined);
              setNotice(undefined);
              try {
                const result = await authClient.sendVerificationEmail({ email, callbackURL: "/login?verified=1" });
                setNotice(result.error ? undefined : "Se esta conta precisar de confirmação, enviaremos um novo link.");
                if (result.error) setError("Não foi possível solicitar o link agora. Tente novamente em instantes.");
              } catch {
                setError("Não foi possível conectar. Verifique sua conexão e tente novamente.");
              } finally {
                setPending(false);
              }
            }}
          >
            Reenviar confirmação
          </button>
        </div>
      ) : null}
      <div className="mt-1 border-t border-[#e1e3e5] pt-5 text-center text-sm text-[#626365]">
        {mode === "sign-in" ? "Novo por aqui?" : "Já faz parte do Moto Shop?"}{" "}
        <button
          type="button"
          className="font-semibold text-[#222326] underline underline-offset-4 hover:text-[#bd4618] disabled:opacity-50"
          disabled={pending}
          onClick={() => {
            setMode(mode === "sign-in" ? "sign-up" : "sign-in");
            setPassword("");
            setError(undefined);
            setNotice(undefined);
          }}
        >
          {mode === "sign-in" ? "Ainda não tenho conta" : "Já tenho uma conta"}
        </button>
      </div>
    </form>
  );
}
