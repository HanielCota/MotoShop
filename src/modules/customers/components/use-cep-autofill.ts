"use client";

import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";

import {
  applyCepAutofill,
  normalizeCep,
  parseViaCepResponse,
  type CepAutofillField,
  type CepAutofillMemory,
} from "../domain/brazilian-address";

export type CepLookupStatus = "idle" | "loading" | "found" | "not-found" | "error";

const hints: Record<CepLookupStatus, string | undefined> = {
  idle: undefined,
  loading: "Buscando endereço pelo CEP…",
  found: "Endereço preenchido pelo CEP. Confira os dados.",
  "not-found": "CEP não encontrado na busca automática. Preencha o endereço manualmente.",
  error: "Não foi possível buscar o endereço automaticamente. Preencha manualmente.",
};

/**
 * Busca o endereço no ViaCEP quando o CEP fica completo e preenche rua, bairro,
 * cidade e UF sem sobrescrever o que a pessoa digitou. Falhas são silenciosas: só
 * exibem uma dica, nunca bloqueiam o formulário.
 */
export function useCepAutofill<T extends Record<CepAutofillField, string>>(
  setValues: Dispatch<SetStateAction<T>>,
  { timeoutMs = 6000 }: { timeoutMs?: number } = {},
) {
  const [status, setStatus] = useState<CepLookupStatus>("idle");
  const controllerRef = useRef<AbortController | null>(null);
  const autofilledRef = useRef<CepAutofillMemory>({});
  const lastCepRef = useRef<string | null>(null);

  const cancel = useCallback(() => {
    controllerRef.current?.abort();
    controllerRef.current = null;
  }, []);

  const lookup = useCallback(
    (rawCep: string) => {
      const cep = normalizeCep(rawCep);
      if (cep.length !== 8) {
        cancel();
        lastCepRef.current = null;
        setStatus("idle");
        return;
      }
      if (cep === lastCepRef.current) return;
      cancel();
      lastCepRef.current = cep;
      const controller = new AbortController();
      controllerRef.current = controller;
      const timeout = setTimeout(() => controller.abort(), timeoutMs);
      setStatus("loading");

      fetch(`https://viacep.com.br/ws/${cep}/json/`, {
        signal: controller.signal,
        headers: { Accept: "application/json" },
      })
        .then((response) => (response.ok ? response.json() : null))
        .then((payload: unknown) => {
          if (controllerRef.current !== controller) return;
          const address = parseViaCepResponse(payload);
          if (!address) {
            setStatus("not-found");
            return;
          }
          setValues((current) => {
            const result = applyCepAutofill(current, address, autofilledRef.current);
            autofilledRef.current = result.autofilled;
            return result.values;
          });
          setStatus("found");
        })
        .catch(() => {
          if (controllerRef.current !== controller) return;
          setStatus("error");
        })
        .finally(() => {
          clearTimeout(timeout);
          if (controllerRef.current === controller) controllerRef.current = null;
        });
    },
    [cancel, setValues, timeoutMs],
  );

  /** Esquece o CEP consultado (ex.: ao escolher um endereço salvo). */
  const reset = useCallback(() => {
    cancel();
    lastCepRef.current = null;
    autofilledRef.current = {};
    setStatus("idle");
  }, [cancel]);

  useEffect(() => cancel, [cancel]);

  return { status, hint: hints[status], lookup, reset };
}
