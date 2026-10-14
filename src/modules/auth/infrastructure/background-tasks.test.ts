import { beforeEach, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ after: vi.fn() }));
vi.mock("next/server", () => ({ after: mocks.after }));

import { runAuthTaskAfterResponse } from "./background-tasks";

beforeEach(() => vi.resetAllMocks());

it("hands auth e-mails to after() so the response does not wait for them (L-01)", () => {
  const task = Promise.resolve();

  runAuthTaskAfterResponse(task);

  expect(mocks.after).toHaveBeenCalledWith(task);
});

it("does not throw outside a request, where after() is unavailable", () => {
  mocks.after.mockImplementation(() => {
    throw new Error("after() was called outside a request scope");
  });

  expect(() => runAuthTaskAfterResponse(Promise.resolve())).not.toThrow();
});
