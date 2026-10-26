import { expect, it } from "vitest";

import { isSingleAccountTestModeActive, type SingleAccountTestModeSettings } from "./single-account-test-mode";

const active: SingleAccountTestModeSettings = {
  enabled: true,
  accessToken: "TEST-1234567890",
  publicKey: "TEST-00000000-0000-0000-0000-000000000000",
  deploymentEnvironment: undefined,
};

it("turns on only with the explicit flag and TEST- credentials outside production", () => {
  expect(isSingleAccountTestModeActive(active)).toBe(true);
  expect(isSingleAccountTestModeActive({ ...active, deploymentEnvironment: "preview" })).toBe(true);
  expect(isSingleAccountTestModeActive({ ...active, publicKey: undefined })).toBe(true);
});

it("stays off without the flag", () => {
  expect(isSingleAccountTestModeActive({ ...active, enabled: undefined })).toBe(false);
  expect(isSingleAccountTestModeActive({ ...active, enabled: false })).toBe(false);
});

it("refuses the Vercel production deployment even with the flag and test credentials", () => {
  expect(isSingleAccountTestModeActive({ ...active, deploymentEnvironment: "production" })).toBe(false);
});

it("refuses production credentials, a missing token and a Public Key from another environment", () => {
  expect(isSingleAccountTestModeActive({ ...active, accessToken: "APP_USR-1234567890" })).toBe(false);
  expect(isSingleAccountTestModeActive({ ...active, accessToken: undefined })).toBe(false);
  expect(isSingleAccountTestModeActive({ ...active, publicKey: "APP_USR-00000000-0000-0000-0000-000000000000" })).toBe(
    false,
  );
});
