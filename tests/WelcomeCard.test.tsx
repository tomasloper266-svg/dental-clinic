import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { I18nProvider } from "@/components/i18n/I18nProvider";
import { WelcomeCard } from "@/components/WelcomeCard";

// WelcomeCard يقرأ اللغة من مزود السياق — نثبّت العربية هنا لأنها الافتراضية.
function withLocale(ui: React.ReactElement) {
  return <I18nProvider locale="ar">{ui}</I18nProvider>;
}

describe("WelcomeCard", () => {
  it("يعرض اسم العيادة بالعربية داخل البطاقة", () => {
    render(withLocale(<WelcomeCard clinicName="عيادة النور" />));
    expect(
      screen.getByText((_, el) => el?.textContent === "مرحباً بك في عيادة النور"),
    ).toBeInTheDocument();
  });
});
