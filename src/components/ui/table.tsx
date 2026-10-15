import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/** Tabela responsiva: rola horizontalmente no mobile sem estourar a página. */
export function DataTable({
  caption,
  columns,
  children,
  minWidth = "min-w-[720px]",
  className,
}: {
  caption: string;
  columns: readonly string[];
  children: ReactNode;
  minWidth?: string;
  /** Classes do contêiner, por exemplo `hidden md:block` quando o celular usa cartões. */
  className?: string;
}) {
  return (
    <div className={cn("-mx-4 overflow-x-auto px-4", className)}>
      <table className={cn("w-full border-collapse text-left text-sm", minWidth)}>
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="text-muted-foreground border-b text-xs uppercase">
            {columns.map((column) => (
              <th key={column} scope="col" className="px-2 py-2 font-semibold tracking-wide first:pl-0 last:pr-0">
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-border divide-y">{children}</tbody>
      </table>
    </div>
  );
}

export const tableCellClassName = "px-2 py-3 align-top first:pl-0 last:pr-0";
