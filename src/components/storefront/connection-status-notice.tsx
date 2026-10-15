"use client";

import { WifiOff } from "lucide-react";
import { useSyncExternalStore } from "react";

function subscribe(onChange: () => void) {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

const isOnline = () => navigator.onLine;
// The server always renders online; the notice only appears after hydration, when the browser knows.
const isOnlineOnServer = () => true;

/**
 * Without a connection, sorting, paging or opening a product falls on the browser's own blank error
 * page. This notice tells the customer why before they try, and goes away when the connection returns.
 */
export function ConnectionStatusNotice() {
  const online = useSyncExternalStore(subscribe, isOnline, isOnlineOnServer);
  if (online) return null;

  return (
    <div
      role="status"
      className="border-warning/40 bg-warning-surface text-warning-foreground fixed inset-x-3 bottom-3 z-50 flex items-start gap-2 rounded-xl border p-3 text-sm shadow-lg sm:inset-x-auto sm:right-4 sm:bottom-4 sm:max-w-sm"
    >
      <WifiOff aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      <p>
        <strong>Sem conexão com a internet.</strong> Confira o Wi-Fi ou os dados móveis. A página volta a funcionar
        quando a conexão voltar.
      </p>
    </div>
  );
}
