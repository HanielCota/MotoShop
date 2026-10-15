import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

vi.mock("@/modules/sellers/actions/seller-member-actions", () => ({
  inviteSellerMemberAction: vi.fn(),
  removeSellerMemberAction: vi.fn(),
  renewSellerInviteLinkAction: vi.fn(),
  revokeSellerInviteAction: vi.fn(),
  updateSellerMemberRoleAction: vi.fn(),
}));

import { SellerTeamManager } from "./seller-team-manager";

afterEach(cleanup);

it("shows role names, not internal values, in the role selects", () => {
  render(
    <SellerTeamManager
      invites={[]}
      members={[{ id: "cmember0001", name: "Juliana Prado", email: "juliana@example.test", role: "CATALOG" }]}
    />,
  );

  expect(screen.getByLabelText("Perfil")).toHaveTextContent("Catálogo");
  expect(screen.getByLabelText("Perfil de Juliana Prado")).toHaveTextContent("Catálogo");
  expect(screen.queryByText("CATALOG")).not.toBeInTheDocument();
});
