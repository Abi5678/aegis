import { describe, expect, it } from "vitest";

import { resolveServerHost } from "./index.js";

describe("Aegis server listener", () => {
  it("binds to loopback by default", async () => {
    expect(resolveServerHost(undefined, {})).toBe("127.0.0.1");
    expect(resolveServerHost(undefined, { HOST: "0.0.0.0" })).toBe("0.0.0.0");
    expect(resolveServerHost("10.0.0.8", {})).toBe("10.0.0.8");
  });
});
