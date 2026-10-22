import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Surface for a titled block. Border, not ring, like the hand-made boxes it replaced (DS-10).
 * `render` keeps the semantics of the block: `<Card render={<section />}>`, `<form />`, `<aside />`.
 * `size="section"` is the storefront page section (checkout, cart, account): 16/24px padding, body
 * text size, normal block flow (children keep their own width and margins, as in the boxes it
 * replaced; a flex column would stretch buttons to full width) and nothing clipped.
 */
function Card({
  className,
  size = "default",
  render,
  ...props
}: useRender.ComponentProps<"div"> & { size?: "default" | "sm" | "section" }) {
  return useRender({
    defaultTagName: "div",
    props: mergeProps<"div">(
      {
        className: cn(
          "group/card bg-card text-card-foreground border-border flex flex-col gap-(--card-spacing) overflow-hidden rounded-xl border py-(--card-spacing) text-sm [--card-spacing:--spacing(4)] has-[>img:first-child]:pt-0 data-[size=sm]:[--card-spacing:--spacing(3)] *:[img:first-child]:rounded-t-xl *:[img:last-child]:rounded-b-xl",
          size === "section" && "block gap-0 overflow-visible p-4 text-base sm:p-6",
          className,
        ),
      },
      props,
    ),
    render,
    state: { slot: "card", size },
  });
}

function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-header"
      className={cn(
        "group/card-header @container/card-header grid auto-rows-min items-start gap-1 rounded-t-xl px-(--card-spacing) has-data-[slot=card-description]:grid-rows-[auto_auto] [.border-b]:pb-(--card-spacing)",
        className,
      )}
      {...props}
    />
  );
}

type CardTitleProps = React.ComponentProps<"h2"> & {
  /**
   * Heading level of the card title; `h2` under the page `h1`, `h3` inside a titled section, `h1`
   * only when the card is the page itself (e.g. the team invite). Never nest a heading inside it.
   */
  as?: "h1" | "h2" | "h3" | undefined;
};

/** Card heading with one size for every area (Admin, Central do Lojista, storefront). */
function CardTitle({ as: Heading = "h2", className, ...props }: CardTitleProps) {
  return (
    <Heading
      data-slot="card-title"
      className={cn("text-lg leading-snug group-data-[size=sm]/card:text-base", className)}
      {...props}
    />
  );
}

function CardDescription({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="card-description" className={cn("text-muted-foreground text-sm", className)} {...props} />;
}

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="card-content" className={cn("px-(--card-spacing)", className)} {...props} />;
}

export { Card, CardHeader, CardTitle, CardDescription, CardContent };
