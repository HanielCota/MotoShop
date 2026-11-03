import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

vi.mock("next/image", () => ({
  // eslint-disable-next-line @next/next/no-img-element
  default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} />,
}));

import { CheckoutOrderSummary } from "./checkout-order-summary";

afterEach(cleanup);

const baseProps = {
  shippingTotalInCents: 0,
  hasQuotes: false,
  isQuoting: false,
  couponCode: "",
  onCouponChange: () => undefined,
  onApplyCoupon: async () => ({}),
  couponCustomerKey: "cliente@example.test|",
};

it("shows each item's product photo, with the cart placeholder for an item without one", () => {
  render(
    <CheckoutOrderSummary
      {...baseProps}
      cartSummary={{ itemCount: 3, itemsSubtotalInCents: 90_000 }}
      items={[
        {
          id: "item-1",
          name: "Capacete Strike",
          variant: "Preto · M",
          quantity: 1,
          lineTotalInCents: 50_000,
          thumbnailUrl: "https://ik.example/capacete.jpg",
        },
        { id: "item-2", name: "Bota Trail", variant: "41", quantity: 1, lineTotalInCents: 30_000, thumbnailUrl: null },
        {
          id: "item-3",
          name: "Luva Leve",
          variant: "M",
          quantity: 1,
          lineTotalInCents: 10_000,
          thumbnailUrl: "https://ik.example/luva.jpg",
        },
      ]}
    />,
  );

  const list = screen.getByRole("list", { name: "Itens do pedido" });
  const thumbnails = within(list).getAllByTestId("cart-item-thumbnail");

  expect(thumbnails).toHaveLength(3);
  expect(thumbnails[0]?.querySelector("img")).toHaveAttribute("src", "https://ik.example/capacete.jpg");
  expect(thumbnails[1]?.querySelector("img")).toBeNull();
  expect(within(list).getByText(/Bota Trail/)).toBeInTheDocument();
});

function summaryWith(props: {
  couponCode: string;
  couponCustomerKey: string;
  onApplyCoupon: () => Promise<{ discountInCents?: number; error?: string }>;
}) {
  return (
    <CheckoutOrderSummary
      {...baseProps}
      {...props}
      hasQuotes
      cartSummary={{ itemCount: 1, itemsSubtotalInCents: 59_990 }}
    />
  );
}

it("drops a previewed discount when the e-mail or CPF changes, since the per-customer limit depends on them", async () => {
  const onApplyCoupon = async () => ({ discountInCents: 5_999 });
  const { rerender } = render(
    summaryWith({ couponCode: "CUPOM10", couponCustomerKey: "a@example.test|", onApplyCoupon }),
  );

  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Aplicar" })));
  expect(screen.getByText("Desconto do cupom")).toBeInTheDocument();

  rerender(summaryWith({ couponCode: "CUPOM10", couponCustomerKey: "b@example.test|", onApplyCoupon }));
  expect(screen.queryByText("Desconto do cupom")).not.toBeInTheDocument();
});

it("shows a coupon error only under the code that was checked", async () => {
  const onApplyCoupon = async () => ({ error: "Este cupom expirou." });
  const { rerender } = render(
    summaryWith({ couponCode: "VELHO", couponCustomerKey: "a@example.test|", onApplyCoupon }),
  );

  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Aplicar" })));
  expect(screen.getByRole("alert")).toHaveTextContent("Este cupom expirou.");

  rerender(summaryWith({ couponCode: "NOVO10", couponCustomerKey: "a@example.test|", onApplyCoupon }));
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});
