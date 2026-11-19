import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { BrandLock, BrandMark } from "@/components/auth/BrandMark";

afterEach(() => cleanup());

describe("BrandMark", () => {
  it("يرسم بلاطة السن كعنصر رسومي مخفي عن قارئات الشاشة", () => {
    const { container } = render(<BrandMark size={32} />);
    expect(container.querySelector("svg")).not.toBeNull();
  });
});

describe("BrandLock", () => {
  it("يعرض اسم DENTIQ والتوقيع بالعربية", () => {
    render(<BrandLock />);
    expect(screen.getByText("DENTIQ")).toBeInTheDocument();
    expect(
      screen.getByText("نظام إدارة عيادات الأسنان"),
    ).toBeInTheDocument();
  });

  it("يبقى باسم DENTIQ على لوح الهوية الداكن (tone=light)", () => {
    render(<BrandLock tone="light" />);
    expect(screen.getByText("DENTIQ")).toBeInTheDocument();
  });
});
