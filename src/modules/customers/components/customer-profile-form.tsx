"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { FormMessage } from "@/components/ui/form-message";
import { Input } from "@/components/ui/input";
import { authClient } from "@/modules/auth/infrastructure/auth-client";
import { NETWORK_ERROR_MESSAGE } from "@/shared/forms/server-action-submit";

import {
  updateCustomerContactAction,
  updateCustomerNameAction,
  type CustomerProfileActionState,
} from "../actions/customer-profile-actions";
import { formatPhone, formatTaxId } from "../domain/tax-id";
import {
  customerProfileSchema,
  type CustomerProfileFormInput,
  type CustomerProfileInput,
} from "../schemas/customer-account";

const inputClassName = "h-12 text-base";

/**
 * Name, CPF/CNPJ and phone with one "Salvar alterações", so editing two fields never loses one.
 * The name goes through Better Auth only when it changed; the contact is saved every time.
 */
export function CustomerProfileForm({
  defaultName,
  taxId,
  phone,
}: {
  defaultName: string;
  taxId: string | null;
  phone: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState<CustomerProfileActionState>({});
  const {
    register,
    handleSubmit,
    setValue,
    reset,
    getValues,
    formState: { errors, dirtyFields },
  } = useForm<CustomerProfileFormInput, unknown, CustomerProfileInput>({
    resolver: zodResolver(customerProfileSchema),
    defaultValues: { name: defaultName, taxId: formatTaxId(taxId ?? ""), phone: formatPhone(phone ?? "") },
  });

  const submit = handleSubmit((values) => {
    setState({});
    startTransition(async () => {
      const result = await saveProfile(values, Boolean(dirtyFields.name));
      setState(result);
      if (!result.success) return;

      reset(getValues());
      if (dirtyFields.name) authClient.$store.notify("$sessionSignal");
      router.refresh();
    });
  });

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      <FormField
        id="profile-name"
        label="Nome completo"
        error={errors.name?.message}
        labelClassName="text-base"
        required
      >
        {(field) => (
          <Input {...field} {...register("name")} autoComplete="name" maxLength={120} className={inputClassName} />
        )}
      </FormField>
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
            {...register("taxId", { onChange: (event) => setValue("taxId", formatTaxId(event.target.value)) })}
            inputMode="numeric"
            autoComplete="off"
            maxLength={18}
            placeholder="000.000.000-00"
            className={inputClassName}
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
            {...register("phone", { onChange: (event) => setValue("phone", formatPhone(event.target.value)) })}
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            maxLength={15}
            placeholder="(11) 98765-4321"
            className={inputClassName}
          />
        )}
      </FormField>
      <FormMessage error={state.error ?? null} success={state.success ?? null} />
      <Button pending={pending} pendingLabel="Salvando…" type="submit" size="lg" className="self-start">
        Salvar alterações
      </Button>
    </form>
  );
}

async function saveProfile(values: CustomerProfileInput, nameChanged: boolean): Promise<CustomerProfileActionState> {
  try {
    if (nameChanged) {
      const nameResult = await updateCustomerNameAction({ name: values.name });
      if (nameResult.error) return nameResult;
    }

    const contactResult = await updateCustomerContactAction({ taxId: values.taxId, phone: values.phone });
    if (contactResult.error) return contactResult;

    return { success: "Dados atualizados." };
  } catch {
    return { error: NETWORK_ERROR_MESSAGE };
  }
}
