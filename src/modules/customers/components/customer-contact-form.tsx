"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { FormMessage } from "@/components/ui/form-message";
import { Input } from "@/components/ui/input";

import { updateCustomerContactAction, type CustomerProfileActionState } from "../actions/customer-profile-actions";
import { formatPhone, formatTaxId } from "../domain/tax-id";
import {
  customerContactSchema,
  type CustomerContactFormInput,
  type CustomerContactInput,
} from "../schemas/customer-account";

/** Optional CPF/CNPJ and phone; saved values prefill the checkout. */
export function CustomerContactForm({ taxId, phone }: { taxId: string | null; phone: string | null }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState<CustomerProfileActionState>({});
  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<CustomerContactFormInput, unknown, CustomerContactInput>({
    resolver: zodResolver(customerContactSchema),
    defaultValues: { taxId: formatTaxId(taxId ?? ""), phone: formatPhone(phone ?? "") },
  });

  const submit = handleSubmit((values) => {
    setState({});
    startTransition(async () => {
      try {
        const result = await updateCustomerContactAction(values);
        setState(result);
        if (result.success) router.refresh();
      } catch {
        setState({ error: "Não foi possível conectar. Verifique sua conexão e tente novamente." });
      }
    });
  });

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      <FormField
        id="profile-tax-id"
        label="CPF ou CNPJ (opcional)"
        error={errors.taxId?.message}
        hint="Preenche o checkout automaticamente quando for um CPF."
        labelClassName="text-base"
      >
        {(field) => (
          <Input
            {...field}
            {...register("taxId", {
              onChange: (event) => setValue("taxId", formatTaxId(event.target.value)),
            })}
            inputMode="numeric"
            autoComplete="off"
            maxLength={18}
            placeholder="000.000.000-00"
            className="h-12 text-base"
          />
        )}
      </FormField>
      <FormField
        id="profile-phone"
        label="Telefone com DDD (opcional)"
        error={errors.phone?.message}
        labelClassName="text-base"
      >
        {(field) => (
          <Input
            {...field}
            {...register("phone", {
              onChange: (event) => setValue("phone", formatPhone(event.target.value)),
            })}
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            maxLength={15}
            placeholder="(11) 98765-4321"
            className="h-12 text-base"
          />
        )}
      </FormField>
      <FormMessage error={state.error ?? null} success={state.success ?? null} />
      <Button
        pending={pending}
        pendingLabel="Salvando…"
        type="submit"
        size="lg"
        className="h-12 self-start px-5 text-base"
      >
        Salvar dados
      </Button>
    </form>
  );
}
