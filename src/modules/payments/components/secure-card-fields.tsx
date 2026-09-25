"use client";

import Script from "next/script";
import { useEffect, useImperativeHandle, useRef, useState, type Ref } from "react";
import { isValidCpf } from "@/modules/checkout/domain/cpf";

type SecureField = {
  mount(id: string): SecureField;
  unmount(): void;
  on(event: string, callback: (event: { bin?: string | null }) => void): void;
  update(options: { settings: Record<string, unknown> }): void;
};
type Method = {
  id: string;
  payment_type_id: string;
  settings: { card_number: Record<string, unknown>; security_code: Record<string, unknown> }[];
};
type CardSdk = {
  fields: {
    create(type: string, options: Record<string, unknown>): SecureField;
    createCardToken(data: {
      cardholderName: string;
      identificationType: string;
      identificationNumber: string;
    }): Promise<{ id: string } | undefined>;
  };
  getPaymentMethods(data: { bin: string }): Promise<{ results: Method[] }>;
  getIssuers(data: { bin: string; paymentMethodId: string }): Promise<{ id: string | number; name: string }[]>;
};
type CardWindow = Window & { MercadoPago?: new (key: string, options: { locale: string }) => CardSdk };
export type CardPaymentData = { paymentMethodId: string; paymentToken: string; issuerId?: string };
export type SecureCardHandle = { tokenize(): Promise<CardPaymentData> };
const supportedMethods = ["visa", "master", "amex", "elo", "hipercard", "diners", "cabal"];
const fieldClass = "border-input h-11 w-full rounded-md border bg-white px-3 text-sm text-black";

export function SecureCardFields({ publicKey, ref }: { publicKey: string; ref: Ref<SecureCardHandle> }) {
  const [loaded, setLoaded] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string>();
  const [name, setName] = useState("");
  const [document, setDocument] = useState("");
  const [issuers, setIssuers] = useState<{ id: string; name: string }[]>([]);
  const [issuer, setIssuer] = useState("");
  const sdk = useRef<CardSdk | null>(null);
  const method = useRef<string | null>(null);
  const cardVersion = useRef(0);

  useEffect(() => {
    if (!loaded) return;
    const Constructor = (window as CardWindow).MercadoPago;
    if (!Constructor) return;
    let disposed = false;
    let generation = 0;
    let readyCount = 0;
    const fields: SecureField[] = [];
    const fail = () => {
      if (!disposed) {
        setError("Não foi possível carregar o cartão. Tente novamente ou escolha Pix.");
        setReady(false);
      }
    };
    try {
      const client = new Constructor(publicKey, { locale: "pt-BR" });
      sdk.current = client;
      for (const [type, label] of [
        ["cardNumber", "Número do cartão"],
        ["expirationDate", "Validade (MM/AA)"],
        ["securityCode", "Código de segurança"],
      ]) {
        const field = client.fields.create(type!, {
          placeholder: label,
          srLabel: label,
          ariaRequired: true,
          style: { fontSize: "16px", height: "44px", color: "#111111" },
        });
        fields.push(field);
        field.on("ready", () => {
          if (!disposed && ++readyCount === 3) setReady(true);
        });
        field.on("error", fail);
        field.mount(`motoshop-${type}`);
      }
      fields[0]!.on("binChange", ({ bin }) => {
        cardVersion.current++;
        const current = ++generation;
        method.current = null;
        setIssuers([]);
        setIssuer("");
        setError(undefined);
        if (!bin) return;
        void (async () => {
          try {
            const response = await client.getPaymentMethods({ bin });
            if (disposed || current !== generation) return;
            const selected = response.results.find(
              (item) => item.payment_type_id === "credit_card" && supportedMethods.includes(item.id),
            );
            if (!selected) throw new Error("Unsupported card");
            const settings = selected.settings[0];
            if (settings) {
              fields[0]!.update({ settings: settings.card_number });
              fields[2]!.update({ settings: settings.security_code });
            }
            const available = await client.getIssuers({ bin, paymentMethodId: selected.id });
            if (disposed || current !== generation) return;
            method.current = selected.id;
            setIssuers(available.map((item) => ({ id: String(item.id), name: item.name })));
            setIssuer(available[0] ? String(available[0].id) : "");
          } catch {
            if (!disposed && current === generation)
              setError("Não foi possível identificar um cartão de crédito aceito. Confira o número ou use Pix.");
          }
        })();
      });
    } catch {
      fail();
    }
    const timeout = window.setTimeout(() => {
      if (!disposed && readyCount < 3) fail();
    }, 20000);
    return () => {
      disposed = true;
      generation++;
      window.clearTimeout(timeout);
      sdk.current = null;
      method.current = null;
      fields.forEach((field) => field.unmount());
    };
  }, [loaded, publicKey]);

  useImperativeHandle(ref, () => ({
    async tokenize() {
      const client = sdk.current;
      const paymentMethodId = method.current;
      const version = cardVersion.current;
      if (!ready || !client || !paymentMethodId || error)
        throw new Error("Aguarde a validação do cartão ou escolha Pix.");
      const cpf = document.replace(/\D/g, "");
      if (name.trim().length < 2 || !isValidCpf(cpf)) throw new Error("Confira o nome e o CPF do titular do cartão.");
      try {
        const token = await client.fields.createCardToken({
          cardholderName: name.trim(),
          identificationType: "CPF",
          identificationNumber: cpf,
        });
        if (!token?.id || method.current !== paymentMethodId || version !== cardVersion.current)
          throw new Error("Invalid token");
        return { paymentMethodId, paymentToken: token.id, ...(issuer ? { issuerId: issuer } : {}) };
      } catch {
        throw new Error("Não foi possível validar o cartão. Confira os dados protegidos e tente novamente.");
      }
    },
  }));

  return (
    <div className="mt-4 space-y-3">
      <Script
        src="https://sdk.mercadopago.com/js/v2"
        strategy="afterInteractive"
        onReady={() => setLoaded(true)}
        onError={() => setError("Não foi possível carregar o Mercado Pago. Recarregue a página ou use Pix.")}
      />
      <p className="text-muted-foreground text-xs">
        Crédito em 1 parcela. Dados protegidos diretamente pelo Mercado Pago.
      </p>
      <label className="grid gap-1 text-sm">
        Nome no cartão
        <input
          className={fieldClass}
          value={name}
          onChange={(event) => setName(event.target.value)}
          autoComplete="cc-name"
          maxLength={120}
          required
        />
      </label>
      <label className="grid gap-1 text-sm">
        CPF do titular
        <input
          className={fieldClass}
          value={document}
          onChange={(event) => setDocument(event.target.value)}
          inputMode="numeric"
          maxLength={14}
          required
        />
      </label>
      {[
        ["cardNumber", "Número do cartão"],
        ["expirationDate", "Validade (MM/AA)"],
        ["securityCode", "Código de segurança"],
      ].map(([type, label]) => (
        <div key={type} className="grid gap-1 text-sm">
          <span>{label}</span>
          <div id={`motoshop-${type}`} className={fieldClass} />
        </div>
      ))}
      {issuers.length > 1 ? (
        <label className="grid gap-1 text-sm">
          Banco emissor
          <select className={fieldClass} value={issuer} onChange={(event) => setIssuer(event.target.value)}>
            {issuers.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      {!ready && !error ? (
        <p role="status" className="text-sm">
          Carregando campos protegidos…
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      ) : null}
    </div>
  );
}
