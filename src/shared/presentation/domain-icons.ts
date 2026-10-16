import { Boxes, Package, SearchX, ShoppingBag } from "lucide-react";

/**
 * One icon per concept in every area (IC-04): the same symbol must mean the same thing for the
 * customer, the seller and the Admin. `cart` is reserved for the cart; "nothing found" is
 * `notFound`, never an order or product icon.
 */
export const domainIcons = {
  order: Package,
  cart: ShoppingBag,
  notFound: SearchX,
  stock: Boxes,
} as const;
