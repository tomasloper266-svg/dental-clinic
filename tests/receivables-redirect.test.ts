import { describe, expect, it } from "vitest";
import nextConfig from "../next.config";

describe("next.config redirects", () => {
  it("redirects /receivables to /dues as a temporary redirect", async () => {
    const redirects = await nextConfig.redirects!();
    const rule = redirects.find((r) => r.source === "/receivables");
    expect(rule).toBeDefined();
    expect(rule!.destination).toBe("/dues");
    expect(rule!.permanent).toBe(false);
  });
});
