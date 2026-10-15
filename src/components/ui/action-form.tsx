"use client";

import { useState, type ComponentProps } from "react";

import { FormMessage } from "@/components/ui/form-message";
import { isNetworkError, NETWORK_ERROR_MESSAGE } from "@/shared/forms/server-action-submit";

type ActionFormProps = Omit<ComponentProps<"form">, "action"> & {
  /** Server Action (usually bound with its ids); its result, if any, is ignored. */
  action: (formData: FormData) => unknown;
};

/**
 * `<form action={serverAction}>` for Server Components: a dropped connection shows an inline
 * message under the fields instead of sending the whole page to the error boundary.
 */
export function ActionForm({ action, children, ...props }: ActionFormProps) {
  const [error, setError] = useState<string | null>(null);

  async function submit(formData: FormData) {
    setError(null);
    try {
      await action(formData);
    } catch (caught) {
      if (!isNetworkError(caught)) throw caught;
      setError(NETWORK_ERROR_MESSAGE);
    }
  }

  return (
    <form {...props} action={submit}>
      {children}
      <FormMessage error={error} className="mt-2 p-2 text-xs" />
    </form>
  );
}
