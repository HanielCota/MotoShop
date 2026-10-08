"use client";

import Script from "next/script";
import { useEffect, useImperativeHandle, useRef, useState, type Ref } from "react";

import { DesignSelect } from "@/components/ui/design-select";
import { FormField, formFieldIds } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { isValidCpf } from "@/modules/checkout/domain/cpf";
import { formatCpf, normalizeCpf } from "@/modules/customers/domain/brazilian-address";

type SecureField = {
  mount(id: string): SecureField;
  unmount(): void;
  on(event: string, callback: (event: SecureFieldEvent) => void): void;
  update(options: { settings: Record<string, unknown> }): void;
};
type SecureFieldEvent = { bin?: string | null; errorMessages?: unknown[] };
type HostedFieldType = "cardNumber" | "expirationDate" | "securityCode";
type HolderField = "name" | "document";
type CardFieldErrors = Partial<Record<HostedFieldType | HolderField, string | undefined>>;
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
const hostedFields: { type: HostedFieldType; label: string; error: string }[] = [
  { type: "cardNumber", label: "Número do cartão", error: "Confira o número do cartão." },
  { type: "expirationDate", label: "Validade (MM/AA)", error: "Confira a validade do cartão." },
  { type: "securityCode", label: "Código de segurança", error: "Confira o código de segurança." },
];
/** Contêiner do iframe do Mercado Pago com a mesma aparência do <Input>. */
const hostedFieldClass =
  "border-input bg-background h-11 w-full rounded-md border px-3 transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/40 data-invalid:border-destructive data-invalid:ring-3 data-invalid:ring-destructive/20";

export function SecureCardFields({ publicKey, ref }: { publicKey: string; ref: Ref<SecureCardHandle> }) {
  const [loaded, setLoaded] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string>();
  const [fieldErrors, setFieldErrors] = useState<CardFieldErrors>({});
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
      for (const { type, label, error: invalidMessage } of hostedFields) {
        const field = client.fields.create(type, {
          placeholder: label,
          srLabel: label,
          ariaRequired: true,
          // Estilo aplicado dentro do iframe do Mercado Pago: o SDK exige cor literal (não lê tokens CSS).
          style: { fontSize: "16px", height: "44px", color: "#111111" },
        });
        fields.push(field);
        field.on("ready", () => {
          if (!disposed && ++readyCount === 3) setReady(true);
        });
        field.on("error", fail);
        // O SDK informa a validade de cada campo protegido; exibimos o erro junto ao campo.
        field.on("validityChange", ({ errorMessages }) => {
          if (disposed) return;
          const invalid = Array.isArray(errorMessages) && errorMessages.length > 0;
          setFieldErrors((current) =>
            Boolean(current[type]) === invalid ? current : { ...current, [type]: invalid ? invalidMessage : undefined },
          );
        });
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
      const cpf = normalizeCpf(document);
      const holderErrors: CardFieldErrors = {
        name: name.trim().length < 2 ? "Informe o nome impresso no cartão." : undefined,
        document: isValidCpf(cpf) ? undefined : "Informe um CPF válido.",
      };
      setFieldErrors((current) => ({ ...current, ...holderErrors }));
      if (holderErrors.name || holderErrors.document) throw new Error("Confira o nome e o CPF do titular do cartão.");
      if (hostedFields.some(({ type }) => fieldErrors[type])) throw new Error("Confira os dados do cartão.");
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
      <FormField id="card-holder-name" label="Nome no cartão" error={fieldErrors.name}>
        {(control) => (
          <Input
            {...control}
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              setFieldErrors((current) => ({ ...current, name: undefined }));
            }}
            autoComplete="cc-name"
            maxLength={120}
            required
          />
        )}
      </FormField>
      <FormField id="card-holder-document" label="CPF do titular" error={fieldErrors.document}>
        {(control) => (
          <Input
            {...control}
            value={document}
            onChange={(event) => {
              setDocument(formatCpf(event.target.value));
              setFieldErrors((current) => ({ ...current, document: undefined }));
            }}
            placeholder="000.000.000-00"
            inputMode="numeric"
            autoComplete="off"
            maxLength={14}
            required
          />
        )}
      </FormField>
      {hostedFields.map(({ type, label }) => {
        const labelId = `motoshop-${type}-label`;
        const fieldError = fieldErrors[type];
        const { errorId, describedBy } = formFieldIds(`motoshop-${type}`, { error: fieldError });
        return (
          // O controle real é um iframe do Mercado Pago; o grupo nomeado associa rótulo e erro a ele.
          <div
            key={type}
            role="group"
            aria-labelledby={labelId}
            aria-describedby={describedBy}
            className="flex flex-col gap-2"
          >
            <span id={labelId} className="text-sm font-medium">
              {label}
            </span>
            <div id={`motoshop-${type}`} data-invalid={fieldError ? "" : undefined} className={hostedFieldClass} />
            {fieldError ? (
              <p id={errorId} className="text-destructive text-xs font-medium">
                {fieldError}
              </p>
            ) : null}
          </div>
        );
      })}
      {issuers.length > 1 ? (
        <FormField id="card-issuer" label="Banco emissor">
          {(control) => (
            <DesignSelect {...control} value={issuer} onValueChange={(value) => setIssuer(String(value))}>
              {issuers.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </DesignSelect>
          )}
        </FormField>
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
