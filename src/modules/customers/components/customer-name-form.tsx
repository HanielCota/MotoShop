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

import { updateCustomerNameAction, type CustomerProfileActionState } from "../actions/customer-profile-actions";
import { customerNameSchema, type CustomerNameInput } from "../schemas/customer-account";

export function CustomerNameForm({ defaultName }: { defaultName: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState<CustomerProfileActionState>({});
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CustomerNameInput>({ resolver: zodResolver(customerNameSchema), defaultValues: { name: defaultName } });

  const submit = handleSubmit((values) => {
    setState({});
    startTransition(async () => {
      try {
        const result = await updateCustomerNameAction(values);
        setState(result);
        if (result.success) {
          reset({ name: values.name });
          // Atualiza a saudação do cabeçalho, que lê a sessão no cliente.
          authClient.$store.notify("$sessionSignal");
          router.refresh();
        }
      } catch {
        setState({ error: "Não foi possível conectar. Verifique sua conexão e tente novamente." });
      }
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
          <Input {...field} {...register("name")} autoComplete="name" maxLength={120} className="h-12 text-base" />
        )}
      </FormField>
      <FormMessage error={state.error ?? null} success={state.success ?? null} />
      <Button pending={pending} pendingLabel="Salvando…" type="submit" size="lg" className="self-start">
        Salvar nome
      </Button>
    </form>
  );
}
