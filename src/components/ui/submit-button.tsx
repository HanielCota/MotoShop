"use client";

import { useFormStatus } from "react-dom";

import { Button, type ButtonProps } from "@/components/ui/button";

/**
 * Submit button for `<form action={...}>`: reads the form status itself, so the form does not
 * need to thread `pending` down. Shows `pendingLabel` while the action runs.
 */
export function SubmitButton({ pending, ...props }: Omit<ButtonProps, "type">) {
  const status = useFormStatus();

  return <Button type="submit" pending={pending || status.pending} {...props} />;
}
