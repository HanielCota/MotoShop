"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { FormMessage } from "@/components/ui/form-message";
import { Input } from "@/components/ui/input";
import { formatPhone, formatTaxId } from "@/modules/customers/domain/tax-id";
import { NETWORK_ERROR_MESSAGE } from "@/shared/forms/server-action-submit";

import {
  updateCompanyContactAction,
  type CompanyContactActionState,
} from "../actions/marketplace-configuration-actions";
import type { StoredCompanyContact } from "../domain/company-contact";
import { COMPANY_CONTACT_LIMITS, companyContactSchema, type CompanyContactFormInput } from "../schemas/company-contact";

type TextField = {
  name: keyof CompanyContactFormInput;
  label: string;
  hint?: string;
  placeholder?: string;
  type?: "email" | "tel" | "url";
  inputMode?: "numeric" | "tel" | "email" | "url";
  autoComplete?: string;
  maxLength: number;
  mask?: (value: string) => string;
  wide?: boolean;
};

const fields: readonly TextField[] = [
  {
    name: "companyLegalName",
    label: "Razão social",
    maxLength: COMPANY_CONTACT_LIMITS.legalName,
    autoComplete: "organization",
  },
  {
    name: "companyCnpj",
    label: "CNPJ",
    inputMode: "numeric",
    placeholder: "00.000.000/0000-00",
    maxLength: COMPANY_CONTACT_LIMITS.maskedCnpj,
    mask: formatTaxId,
  },
  {
    name: "supportEmail",
    label: "E-mail de atendimento",
    hint: "Em branco: não aparece.",
    placeholder: "Ex.: atendimento@motoshopbrasil.com.br",
    type: "email",
    inputMode: "email",
    autoComplete: "off",
    maxLength: COMPANY_CONTACT_LIMITS.email,
  },
  {
    name: "supportPhone",
    label: "Telefone ou WhatsApp",
    hint: "Em branco: não aparece. Com número, vira o ícone do WhatsApp no rodapé.",
    placeholder: "Ex.: (11) 91234-5678",
    type: "tel",
    inputMode: "tel",
    autoComplete: "off",
    maxLength: COMPANY_CONTACT_LIMITS.maskedPhone,
    mask: formatPhone,
  },
  { name: "instagramUrl", label: "Instagram", type: "url", inputMode: "url", maxLength: COMPANY_CONTACT_LIMITS.url },
  { name: "youtubeUrl", label: "YouTube", type: "url", inputMode: "url", maxLength: COMPANY_CONTACT_LIMITS.url },
  { name: "weekdayHours", label: "Segunda a sexta", maxLength: COMPANY_CONTACT_LIMITS.hours },
  { name: "saturdayHours", label: "Sábado", maxLength: COMPANY_CONTACT_LIMITS.hours },
  { name: "sundayHolidayHours", label: "Domingos e feriados", maxLength: COMPANY_CONTACT_LIMITS.hours, wide: true },
];

/** Company and contact for the footers; every field may be left blank to keep today's text. */
export function CompanyContactForm({ defaultValues }: { defaultValues: CompanyContactFormInput }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState<CompanyContactActionState>({});
  const {
    register,
    handleSubmit,
    setValue,
    getValues,
    formState: { errors },
  } = useForm<CompanyContactFormInput, unknown, StoredCompanyContact>({
    resolver: zodResolver(companyContactSchema),
    defaultValues,
  });

  // The server validates the typed text again, so it receives the raw fields, not the parsed values.
  const submit = handleSubmit(() => {
    setState({});
    startTransition(async () => {
      const result = await saveCompanyContact(getValues());
      setState(result);
      if (result.success == null) return;

      router.refresh();
    });
  });

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        {fields.map((field) => (
          <FormField
            key={field.name}
            id={`company-contact-${field.name}`}
            label={field.label}
            hint={field.hint}
            error={errors[field.name]?.message}
            className={field.wide === true ? "sm:col-span-2" : undefined}
          >
            {(control) => (
              <Input
                {...control}
                {...register(field.name, {
                  onChange: (event: { target: { value: string } }) => {
                    if (field.mask == null) return;
                    setValue(field.name, field.mask(event.target.value));
                  },
                })}
                type={field.type ?? "text"}
                inputMode={field.inputMode}
                autoComplete={field.autoComplete ?? "off"}
                placeholder={field.placeholder}
                maxLength={field.maxLength}
                className="h-9"
              />
            )}
          </FormField>
        ))}
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
        <p className="text-muted-foreground text-sm">O ano do © segue o ano atual sozinho.</p>
        <Button
          pending={pending}
          pendingLabel="Salvando…"
          type="submit"
          size="sm"
          className="self-start px-4 sm:self-auto"
        >
          Salvar empresa e contato
        </Button>
      </div>
      <FormMessage error={state.error ?? null} success={state.success ?? null} />
    </form>
  );
}

async function saveCompanyContact(values: CompanyContactFormInput): Promise<CompanyContactActionState> {
  try {
    return await updateCompanyContactAction(values);
  } catch {
    return { error: NETWORK_ERROR_MESSAGE };
  }
}
