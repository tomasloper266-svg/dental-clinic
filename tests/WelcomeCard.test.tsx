import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { WelcomeCard } from "@/components/WelcomeCard";

describe("WelcomeCard", () => {
  it("يعرض اسم العيادة بالعربية داخل البطاقة", () => {
    render(<WelcomeCard clinicName="عيادة النور" />);
    expect(screen.getByText("مرحباً بك في عيادة النور")).toBeInTheDocument();
  });
});
