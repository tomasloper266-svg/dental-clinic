import { describe, expect, it } from "vitest";
import { pageWrapClass } from "@/lib/page-width";

describe("pageWrapClass", () => {
  it("full بلا سقف عرض — جداول كاملة ورسم مسرحي", () => {
    expect(pageWrapClass("full")).toBe("w-full px-4 py-6");
  });

  it("wide بسقف استراتيجي موسّع", () => {
    expect(pageWrapClass("wide")).toContain("max-w-7xl");
    expect(pageWrapClass("wide")).toContain("mx-auto");
  });

  it("reading بسقف قراءة للنماذج", () => {
    expect(pageWrapClass("reading")).toContain("max-w-3xl");
  });
});
