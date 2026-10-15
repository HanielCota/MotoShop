import { expect, it } from "vitest";

import config from "../../next.config";

it("does not advertise the framework in X-Powered-By (L-22)", () => {
  expect(config.poweredByHeader).toBe(false);
});
