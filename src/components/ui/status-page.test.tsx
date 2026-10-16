import { cleanup, render, screen } from "@testing-library/react";
import { ShieldAlert } from "lucide-react";
import { afterEach, expect, it } from "vitest";

import { StatusPage } from "./status-page";

afterEach(cleanup);

it("renders the status as the page heading with its description and actions", () => {
  render(
    <StatusPage
      role="alert"
      icon={ShieldAlert}
      eyebrow="Erro 404"
      title="Página não encontrada"
      description="A página não existe."
      actions={<button type="button">Ver catálogo</button>}
    />,
  );

  expect(screen.getByRole("alert")).toBeInTheDocument();
  expect(screen.getByRole("heading", { level: 1, name: "Página não encontrada" })).toBeInTheDocument();
  expect(screen.getByText("Erro 404")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Ver catálogo" })).toBeInTheDocument();
});
