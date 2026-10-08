import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { SellerApplicationStatus } from "./seller-application-status";

afterEach(cleanup);

describe("SellerApplicationStatus", () => {
  it("shows a pending application as awaiting review", () => {
    render(<SellerApplicationStatus storeName="Loja Teste" status="PENDING" />);

    expect(screen.getByText("Loja Teste")).toBeInTheDocument();
    expect(screen.getByText("Status: Em análise")).toBeInTheDocument();
    expect(screen.getByText(/aguardando análise pelo Moto Shop/i)).toBeInTheDocument();
  });

  it("does not tell a rejected seller to wait for approval", () => {
    render(<SellerApplicationStatus storeName="Loja Teste" status="REJECTED" />);

    expect(screen.getByText("Status: Não aprovado")).toBeInTheDocument();
    expect(screen.getByText(/entre em contato/i)).toBeInTheDocument();
    expect(screen.queryByText(/aguardando análise/i)).not.toBeInTheDocument();
  });

  it("distinguishes a suspended seller from a pending one", () => {
    render(<SellerApplicationStatus storeName="Loja Teste" status="SUSPENDED" />);

    expect(screen.getByText("Status: Suspensa")).toBeInTheDocument();
    expect(screen.queryByText(/aguardando análise/i)).not.toBeInTheDocument();
  });
});
