import { describe, expect, it } from "vitest";
import { formatSyp } from "@/lib/utils";

describe("formatSyp", () => {
  it("ينسّق المبلغ بالليرة السورية بأرقام لاتينية", () => {
    expect(formatSyp(15000)).toContain("15,000");
    expect(formatSyp(15000)).toContain("ل.س");
  });

  it("يقرّب الكسور إلى صفر خانة عشرية", () => {
    expect(formatSyp(1500.75)).toBe(formatSyp(1501));
  });
});
