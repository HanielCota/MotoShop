import { expect, it } from "vitest";

import { isConfiguredAdminEmail } from "./admin-emails";

it.each([
  ["Dono@MotoShop.test", "dono@motoshop.test, outro@motoshop.test", true],
  [" outro@motoshop.test ", "dono@motoshop.test,outro@motoshop.test", true],
  ["cliente@motoshop.test", "dono@motoshop.test", false],
  ["dono@motoshop.test", undefined, false],
  ["dono@motoshop.test", "", false],
])("isConfiguredAdminEmail(%j, %j) → %s", (email, list, expected) => {
  expect(isConfiguredAdminEmail(email, list)).toBe(expected);
});
