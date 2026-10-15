import Link from "next/link";
import type { Route } from "next";

import { ScrollableTabs } from "@/components/ui/scrollable-tabs";
import { cn } from "@/lib/utils";

import { sellerOrderQueueLabels, sellerOrderQueueValues, type SellerOrderQueue } from "../domain/seller-order-queue";

type SellerOrderQueueTabsProps = {
  current: SellerOrderQueue;
  /** Quantidade por aba; abas sem número (como "Todos") não mostram contador. */
  counts: Partial<Record<SellerOrderQueue, number>>;
  hrefFor: (queue: SellerOrderQueue) => Route;
};

export function SellerOrderQueueTabs({ current, counts, hrefFor }: SellerOrderQueueTabsProps) {
  return (
    <ScrollableTabs
      aria-label="Filas de pedidos"
      activeKey={current}
      fadeFromClassName="from-card"
      className="border-border mb-4 gap-1 border-b"
    >
      {sellerOrderQueueValues.map((queue) => {
        const active = queue === current;
        const count = counts[queue];
        return (
          <Link
            key={queue}
            href={hrefFor(queue)}
            aria-current={active ? "page" : undefined}
            className={cn(
              "inline-flex min-h-11 shrink-0 items-center gap-2 border-b-2 px-3 text-sm font-semibold transition-[color,border-color] duration-150 ease-out",
              active
                ? "border-moto-brand text-brand-strong"
                : "text-muted-foreground hover:text-foreground border-transparent",
            )}
          >
            {sellerOrderQueueLabels[queue]}
            {count !== undefined ? (
              <span className="bg-surface-sunken text-foreground rounded-full px-2 text-xs tabular-nums">{count}</span>
            ) : null}
          </Link>
        );
      })}
    </ScrollableTabs>
  );
}
