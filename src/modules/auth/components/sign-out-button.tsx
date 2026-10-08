"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { cn } from "@/lib/utils";
import { authClient } from "@/modules/auth/infrastructure/auth-client";

type SignOutButtonProps = {
  className?: string;
  /** Called before navigating away, e.g. to close the menu that hosts the button. */
  onSignedOut?: () => void;
};

export function SignOutButton({ className, onSignedOut }: SignOutButtonProps) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);

  async function handleSignOut() {
    setPending(true);
    setFailed(false);
    try {
      const result = await authClient.signOut();
      if (result.error) {
        setFailed(true);
        return;
      }
      onSignedOut?.();
      router.push("/");
      router.refresh();
    } catch {
      setFailed(true);
    } finally {
      setPending(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleSignOut}
      disabled={pending}
      aria-busy={pending}
      className={cn(
        "inline-flex min-h-10 items-center gap-2 rounded-md px-3 text-sm font-medium disabled:opacity-60",
        className,
      )}
    >
      <LogOut aria-hidden="true" className="size-4" />
      {pending ? "Saindo…" : failed ? "Tentar sair novamente" : "Sair"}
    </button>
  );
}
