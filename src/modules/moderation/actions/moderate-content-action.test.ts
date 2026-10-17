import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ adminAccess: vi.fn(), moderateContent: vi.fn(), revalidatePath: vi.fn() }));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/logger", () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));
vi.mock("@/modules/auth/application/authorization", () => ({ requireAdminAccess: mocks.adminAccess }));
vi.mock("@/modules/moderation/application/moderate-content", () => ({ moderateContent: mocks.moderateContent }));

import { moderateContentAction } from "./moderate-content-action";

const questionId = "cjld2cjxh0000qzrmn831i7rn";

function form(values: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.adminAccess.mockResolvedValue({ user: { id: "admin-1" } });
  mocks.moderateContent.mockResolvedValue({ path: "/products/capacete" });
});

it("refuses anyone who is not an admin before reading the request", async () => {
  mocks.adminAccess.mockRejectedValue(new Error("FORBIDDEN"));

  await expect(moderateContentAction({}, form({ kind: "question", id: questionId, hide: "true" }))).rejects.toThrow(
    "FORBIDDEN",
  );
  expect(mocks.moderateContent).not.toHaveBeenCalled();
});

it("rejects an unknown content kind or a malformed id without moderating", async () => {
  await expect(moderateContentAction({}, form({ kind: "order", id: questionId, hide: "true" }))).resolves.toEqual({
    error: "Item de moderação inválido.",
  });
  await expect(moderateContentAction({}, form({ kind: "question", id: "../x", hide: "true" }))).resolves.toEqual({
    error: "Item de moderação inválido.",
  });
  expect(mocks.moderateContent).not.toHaveBeenCalled();
});

it("hides content as the signed-in admin and refreshes the public page and the queue", async () => {
  await expect(moderateContentAction({}, form({ kind: "question", id: questionId, hide: "true" }))).resolves.toEqual({
    success: "Conteúdo ocultado.",
  });

  expect(mocks.moderateContent).toHaveBeenCalledWith({
    kind: "question",
    id: questionId,
    hide: true,
    actorUserId: "admin-1",
  });
  expect(mocks.revalidatePath).toHaveBeenCalledWith("/products/capacete");
  expect(mocks.revalidatePath).toHaveBeenCalledWith("/admin/moderation");
});
