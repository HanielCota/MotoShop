import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";

const sendNotificationEmail = vi.hoisted(() => vi.fn().mockResolvedValue({ status: "SENT" }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/logger", () => ({ logger: { error: vi.fn() } }));
vi.mock("@/modules/auth/infrastructure/auth", () => ({ authEmailConfigured: true }));
vi.mock("@/modules/notifications/application/send-notification-email", () => ({ sendNotificationEmail }));
vi.mock("./member-invites", () => ({ hashInviteToken: () => "token-hash" }));

import { sendSellerInviteEmail } from "./send-seller-invite-email";

it("keeps the invite link unchanged in the button, writes it out and shows the token only there", async () => {
  const url = "https://motoshopbrasil.com.br/convite/invite-secret-token";

  await sendSellerInviteEmail({
    inviteId: "invite-1",
    to: "member@example.test",
    storeName: "Garagem MX",
    roleLabel: "Catálogo",
    url,
    token: "invite-secret-token",
  });

  const html = renderToStaticMarkup(sendNotificationEmail.mock.calls[0]?.[0].react);
  const links = [...html.matchAll(/href="([^"]*)"/g)].map((match) => match[1]);
  expect(links).toEqual([url, url]);
  expect(html).toMatch(/Convite para a equipe da (<!-- -->)?Garagem MX/);
  expect(html.split(url).join("")).not.toContain("invite-secret-token");
  expect(html).not.toContain("member@example.test");
});
