"use client";

import { useRef, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { Route } from "next";
import Link from "next/link";

import { Button, buttonVariants } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { FormMessage } from "@/components/ui/form-message";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { cn } from "@/lib/utils";
import { authClient } from "@/modules/auth/infrastructure/auth-client";

import { getAuthErrorMessage, isEmailNotVerifiedError, isInvalidCredentialsError } from "../domain/auth-error-message";
import { parseAuthUserName } from "../domain/auth-user-name";
import { getSafeRedirectPath } from "../domain/safe-redirect";

type Mode = "sign-in" | "sign-up";
type Field = "name" | "email" | "password";
type FieldErrors = Partial<Record<Field, string>>;

/** `?modo=cadastro` torna o cadastro linkável; ausência do parâmetro = entrar. */
const MODE_PARAM = "modo";
const SIGN_UP_VALUE = "cadastro";

const fieldIds: Record<Field, string> = { name: "auth-name", email: "auth-email", password: "auth-password" };

function validate(mode: Mode, values: Record<Field, string>): FieldErrors {
  const errors: FieldErrors = {};
  if (mode === "sign-up") {
    const name = parseAuthUserName(values.name);
    if (!name.ok) errors.name = name.message;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) errors.email = "Informe um e-mail válido.";
  if (values.password.length < 8) errors.password = "A senha precisa ter pelo menos 8 caracteres.";
  return errors;
}

export function AuthForm({
  emailEnabled,
  verificationRequired,
}: {
  emailEnabled: boolean;
  verificationRequired: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const formRef = useRef<HTMLFormElement>(null);
  const [mode, setModeState] = useState<Mode>(searchParams.get(MODE_PARAM) === SIGN_UP_VALUE ? "sign-up" : "sign-in");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string>();
  const [showCredentialsHelp, setShowCredentialsHelp] = useState(false);
  // E-mail whose sign-in hit EMAIL_NOT_VERIFIED; the resend link is offered only for it.
  const [unverifiedEmail, setUnverifiedEmail] = useState<string>();
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [notice, setNotice] = useState<string>();
  const [pending, setPending] = useState(false);

  function setMode(next: Mode) {
    setModeState(next);
    setPassword("");
    setError(undefined);
    setShowCredentialsHelp(false);
    setUnverifiedEmail(undefined);
    setFieldErrors({});
    // A History API nativa é integrada ao roteador do Next.js e não refaz a navegação.
    const params = new URLSearchParams(window.location.search);
    if (next === "sign-up") params.set(MODE_PARAM, SIGN_UP_VALUE);
    if (next !== "sign-up") params.delete(MODE_PARAM);
    const query = params.toString();
    window.history.replaceState(null, "", `${window.location.pathname}${query ? `?${query}` : ""}`);
  }

  function clearFieldError(field: Field) {
    setFieldErrors((current) => (current[field] ? { ...current, [field]: undefined } : current));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    setShowCredentialsHelp(false);
    setUnverifiedEmail(undefined);
    setNotice(undefined);

    const errors = validate(mode, { name, email, password });
    setFieldErrors(errors);
    const firstInvalid = (["name", "email", "password"] as const).find((field) => errors[field]);
    if (firstInvalid) {
      formRef.current?.querySelector<HTMLInputElement>(`#${fieldIds[firstInvalid]}`)?.focus();
      return;
    }
    setPending(true);

    try {
      const result =
        mode === "sign-in"
          ? await authClient.signIn.email({ email, password })
          : await authClient.signUp.email({ name, email, password, callbackURL: "/login?verified=1" });

      if (result.error) {
        setError(getAuthErrorMessage(result.error.code, result.error.status));
        setShowCredentialsHelp(mode === "sign-in" && isInvalidCredentialsError(result.error.code, result.error.status));
        if (mode === "sign-in" && isEmailNotVerifiedError(result.error.code, result.error.status))
          setUnverifiedEmail(email);
        return;
      }

      if (mode === "sign-up" && verificationRequired) {
        setMode("sign-in");
        setNotice("Enviamos um e-mail para você. Siga as instruções da mensagem para entrar.");
        return;
      }

      const safeNext = getSafeRedirectPath(searchParams.get("next"), "");
      // Shoppers are the default audience; the seller entry points pass ?next=/seller explicitly.
      router.push((safeNext || "/products") as Route);
      router.refresh();
    } catch {
      setError("Não foi possível conectar. Verifique sua conexão e tente novamente.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
      <div className="mb-1">
        <h1 className="text-foreground text-3xl font-bold tracking-tight uppercase sm:text-4xl">
          {mode === "sign-in" ? "Acesse sua conta" : "Crie sua conta"}
        </h1>
        <p className="text-muted-foreground mt-2 text-sm leading-6">
          {mode === "sign-in"
            ? "Entre para acompanhar seus pedidos e cuidar da sua loja."
            : "Uma conta para comprar e vender no Moto Shop."}
        </p>
      </div>
      {mode === "sign-up" ? (
        <FormField id={fieldIds.name} label="Nome" error={fieldErrors.name}>
          {(control) => (
            <Input
              {...control}
              value={name}
              onChange={(event) => {
                setName(event.target.value);
                clearFieldError("name");
              }}
              autoComplete="name"
              maxLength={120}
              placeholder="Como podemos chamar você?"
              className="bg-card h-12 px-4"
              required
            />
          )}
        </FormField>
      ) : null}
      <FormField id={fieldIds.email} label="E-mail" error={fieldErrors.email}>
        {(control) => (
          <Input
            {...control}
            type="email"
            inputMode="email"
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
              clearFieldError("email");
            }}
            autoComplete="email"
            placeholder="voce@exemplo.com"
            className="bg-card h-12 px-4"
            required
          />
        )}
      </FormField>
      <FormField
        id={fieldIds.password}
        label="Senha"
        error={fieldErrors.password}
        hint={mode === "sign-up" ? "Use pelo menos 8 caracteres." : undefined}
      >
        {(control) => (
          <PasswordInput
            {...control}
            minLength={8}
            value={password}
            onChange={(event) => {
              setPassword(event.target.value);
              clearFieldError("password");
            }}
            autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
            placeholder="Pelo menos 8 caracteres"
            className="bg-card h-12 px-4 pr-12"
            required
          />
        )}
      </FormField>
      {searchParams.has("error") ? (
        <FormMessage error="Não foi possível confirmar o e-mail. Entre com seu e-mail e senha para receber outro link." />
      ) : searchParams.get("verified") === "1" ? (
        <FormMessage success="E-mail confirmado. Entre com sua senha." />
      ) : null}
      <FormMessage error={error ?? null} success={notice ?? null} />
      <Button type="submit" size="lg" className="font-bold tracking-wide uppercase" disabled={pending}>
        {pending ? "Aguarde..." : mode === "sign-in" ? "Entrar" : "Criar conta"}
      </Button>
      {showCredentialsHelp ? (
        <CredentialsHelp
          emailEnabled={emailEnabled}
          disabled={pending}
          onCreateAccount={() => {
            setMode("sign-up");
            setNotice(undefined);
          }}
        />
      ) : null}
      {emailEnabled && mode === "sign-in" ? (
        <div className="flex flex-wrap justify-between gap-3 text-sm">
          {showCredentialsHelp ? null : (
            <Link className={buttonVariants({ variant: "link", size: "link" })} href="/forgot-password">
              Esqueci minha senha
            </Link>
          )}
          {unverifiedEmail ? (
            <button
              type="button"
              className={buttonVariants({ variant: "link", size: "link" })}
              disabled={pending}
              onClick={async () => {
                setPending(true);
                setError(undefined);
                setNotice(undefined);
                try {
                  const result = await authClient.sendVerificationEmail({
                    email: unverifiedEmail,
                    callbackURL: "/login?verified=1",
                  });
                  setNotice(
                    result.error ? undefined : "Se esta conta precisar de confirmação, enviaremos um novo link.",
                  );
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
          ) : null}
        </div>
      ) : null}
      {showCredentialsHelp ? null : (
        <div className="border-border text-muted-foreground mt-1 border-t pt-5 text-center text-sm">
          {mode === "sign-in" ? "Novo por aqui?" : "Já faz parte do Moto Shop?"}{" "}
          <button
            type="button"
            className="text-foreground hover:text-brand-strong inline-flex min-h-11 items-center font-semibold underline underline-offset-4 disabled:opacity-50"
            disabled={pending}
            onClick={() => {
              setMode(mode === "sign-in" ? "sign-up" : "sign-in");
              setNotice(undefined);
            }}
          >
            {mode === "sign-in" ? "Ainda não tenho conta" : "Já tenho uma conta"}
          </button>
        </div>
      )}
    </form>
  );
}

/**
 * Shown next to "E-mail ou senha incorretos.": the two ways forward, without revealing whether
 * the account exists. Password recovery only appears when e-mail sending is configured.
 */
function CredentialsHelp({
  emailEnabled,
  disabled,
  onCreateAccount,
}: {
  emailEnabled: boolean;
  disabled: boolean;
  onCreateAccount: () => void;
}) {
  return (
    <div className="border-moto-brand/40 bg-moto-brand-surface flex flex-col gap-3 rounded-xl border p-4">
      <p className="text-foreground text-sm font-semibold">Não consegue entrar?</p>
      {emailEnabled ? (
        <Link href="/forgot-password" className={cn(buttonVariants({ variant: "outline" }), "bg-card w-full")}>
          Esqueci minha senha
        </Link>
      ) : null}
      <Button type="button" variant="outline" className="bg-card w-full" disabled={disabled} onClick={onCreateAccount}>
        Ainda não tenho conta? <span className="font-semibold">Criar conta</span>
      </Button>
    </div>
  );
}
