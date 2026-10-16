import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/**
 * Escala de botões (mobile first):
 * - `default`/`icon`: 44px, alvo de toque mínimo recomendado.
 * - `sm`/`icon-sm`: 36px, apenas para tabelas e barras densas no desktop.
 * - `lg`/`icon-lg`: 48px, CTAs principais, sempre em `font-semibold` (peso único de CTA).
 * Um único raio (`rounded-md`) para todos os controles — evite sobrescrever.
 */
const smallSize =
  "h-9 gap-1 px-3 text-sm has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2 [&_svg:not([class*='size-'])]:size-3.5";

const buttonVariantClasses = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-md border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap transition-[background-color,border-color,color,box-shadow,transform] duration-150 ease-out outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 active:not-aria-[haspopup]:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/80",
        outline:
          "border-border bg-background hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-[color-mix(in_oklch,var(--secondary),var(--foreground)_5%)] aria-expanded:bg-secondary aria-expanded:text-secondary-foreground",
        ghost: "hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground",
        destructive:
          "bg-destructive/10 text-destructive hover:bg-destructive/20 focus-visible:border-destructive/40 focus-visible:ring-destructive/20",
        /** Final confirmation of an irreversible action (e.g. inside ConfirmDialog); white on red keeps 7:1. */
        "destructive-solid":
          "bg-destructive text-white hover:bg-destructive/90 focus-visible:border-destructive/40 focus-visible:ring-destructive/30",
        /** Standalone text link for an action or navigation; pair with `size="link"` (or `link-xs`). */
        link: "text-brand-strong underline underline-offset-4 hover:decoration-2",
        /** Secondary text link (clear filters, back, cancel). */
        "link-muted": "text-muted-foreground underline underline-offset-4 hover:text-foreground",
      },
      size: {
        default: "h-11 gap-1.5 px-4 has-data-[icon=inline-end]:pr-3 has-data-[icon=inline-start]:pl-3",
        sm: smallSize,
        lg: "h-12 gap-2 px-5 text-base font-semibold has-data-[icon=inline-end]:pr-4 has-data-[icon=inline-start]:pl-4 [&_svg:not([class*='size-'])]:size-5",
        icon: "size-11",
        "icon-sm": "size-9",
        "icon-lg": "size-12",
        /** Text links: no padding, 44px touch target on phones and 36px from `sm` up. */
        link: "h-auto min-h-11 w-fit px-0 sm:min-h-9",
        /** Small text links in dense tables (Admin). */
        "link-xs": "h-auto min-h-11 w-fit px-0 text-xs sm:min-h-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

type ButtonVariantProps = VariantProps<typeof buttonVariantClasses>;

/**
 * Class string of a button, merged with tailwind-merge: the base `border-transparent` gives way to a
 * variant border (e.g. `outline`) and a caller `className` overrides the size, even on a bare
 * `<Link className={buttonVariants(...)}>` without `cn()`.
 */
function buttonVariants(props?: ButtonVariantProps & { className?: string | undefined }): string {
  return cn(buttonVariantClasses(props));
}

type ButtonProps = ButtonPrimitive.Props &
  ButtonVariantProps & {
    /** Action in progress: disables the button, sets `aria-busy` and shows `pendingLabel` (ex.: "Salvando…"). */
    pending?: boolean | undefined;
    pendingLabel?: string | undefined;
  };

function Button({
  className,
  variant = "default",
  size = "default",
  pending = false,
  pendingLabel,
  disabled,
  children,
  ...props
}: ButtonProps) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariantClasses({ variant, size, className }))}
      disabled={pending || disabled}
      aria-busy={pending || undefined}
      {...props}
    >
      {pending && pendingLabel ? pendingLabel : children}
    </ButtonPrimitive>
  );
}

export { Button, buttonVariants, type ButtonProps };
