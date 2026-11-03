import Image from "next/image";
import { ImageOff } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Product photo of a cart item, with the same placeholder wherever a cart item is listed (cart page,
 * cart preview and checkout summary). Decorative: the item name next to it is what is read.
 */
export function CartItemThumbnail({
  url,
  sizes,
  className,
}: {
  url: string | null | undefined;
  sizes: string;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "bg-surface-sunken relative grid shrink-0 place-items-center overflow-hidden rounded-lg",
        className,
      )}
      data-testid="cart-item-thumbnail"
    >
      {url == null ? (
        <ImageOff aria-hidden="true" className="text-muted-foreground size-6" />
      ) : (
        <Image src={url} alt="" fill sizes={sizes} className="object-cover" />
      )}
    </span>
  );
}

/** The same thumbnail, small and inline, at the start of an item written as a line of text. */
export function InlineItemThumbnail({ url }: { url: string | null | undefined }) {
  return <CartItemThumbnail url={url} sizes="28px" className="mr-1.5 inline-grid size-7 align-middle [&>svg]:size-4" />;
}
