import { cleanup, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({ default: (props: ComponentProps<"a">) => <a {...props} /> }));
vi.mock("@/modules/shipping/infrastructure/melhor-envio-oauth", () => ({ isMelhorEnvioOAuthConfigured: () => true }));

import { MelhorEnvioConnectionCard } from "./melhor-envio-connection-card";

afterEach(cleanup);

it("tells the seller the connection can buy labels with the account balance (L-12)", () => {
  render(<MelhorEnvioConnectionCard connected={false} shippingStatus={undefined} />);

  expect(screen.getByText(/comprar e gerar etiquetas com o saldo da sua conta/)).toBeInTheDocument();
  expect(screen.queryByText(/somente consulta de frete/)).not.toBeInTheDocument();
});
