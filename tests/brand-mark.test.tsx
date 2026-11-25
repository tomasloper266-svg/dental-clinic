import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { BrandHero, BrandLock, BrandMark } from "@/components/auth/BrandMark";

afterEach(() => cleanup());

describe("BrandMark", () => {
  it("يرسم بلاطة السن كعنصر رسومي مخفي عن قارئات الشاشة", () => {
    const { container } = render(<BrandMark size={32} />);
    expect(container.querySelector("svg")).not.toBeNull();
  });

  it("النسخة على اللوح الأزرق تستخدم معرف تدرج مستقلاً حتى لا يتصادم الاستخدامان", () => {
    const { container } = render(<BrandMark size={32} onPanel />);
    expect(container.querySelector("linearGradient")?.id).toBe(
      "dentiq-tooth-panel",
    );
  });
});

describe("BrandLock", () => {
  it("يعرض اسم DENTIQ على السطح الفاتح", () => {
    render(<BrandLock />);
    expect(screen.getByText("DENTIQ")).toBeInTheDocument();
  });

  it("يعرض الاسم المتدرّج على لوح المصادقة الأزرق (tone=panel)", () => {
    render(<BrandLock tone="panel" />);
    const name = screen.getByText("DENTIQ");
    expect(name).toBeInTheDocument();
    expect(name.style.backgroundImage).toContain("linear-gradient");
    expect(name.style.color).toBe("transparent");
  });
});

describe("BrandHero", () => {
  it("يعرض البلاطة الكبيرة وDENTIQ معاً لموضع اللوح البارز", () => {
    render(<BrandHero />);
    expect(screen.getByText("DENTIQ")).toBeInTheDocument();
  });
});
