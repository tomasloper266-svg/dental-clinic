import { describe, expect, it } from "vitest";
import { DEFAULT_LOGO_LETTER, clinicLogoLetter } from "@/lib/branding";

describe("clinicLogoLetter", () => {
  it("يُرجع الحرف المخزّن كما هو", () => {
    expect(clinicLogoLetter("ن")).toBe("ن");
    expect(clinicLogoLetter("ن", "عيادات النور")).toBe("ن");
  });

  it("يُفسّر الحرف من اسم العيادة عند غياب المخزّن", () => {
    expect(clinicLogoLetter("", "عيادات النور")).toBe("ع");
    expect(clinicLogoLetter(undefined, "الشفق")).toBe("ا");
    expect(clinicLogoLetter(null, "   النور  ")).toBe("ا");
  });

  it("يلحق بالمثل الافتراضي عند غيابهما معاً أو بفراغات فقط", () => {
    expect(clinicLogoLetter()).toBe(DEFAULT_LOGO_LETTER);
    expect(clinicLogoLetter("", "")).toBe(DEFAULT_LOGO_LETTER);
    expect(clinicLogoLetter("   ", "   ")).toBe(DEFAULT_LOGO_LETTER);
    expect(clinicLogoLetter("  ", undefined)).toBe(DEFAULT_LOGO_LETTER);
  });

  it("الحرف المخزّن كفراغ لا يُقبل كحرف — يُفسَّر من الاسم", () => {
    expect(clinicLogoLetter(" ", "عيادات النور")).toBe("ع");
  });
});

// مسح الاسم القديم — «سِنّة» لا يجوز أن يعود إلى شجرة الواجهة،
// وDENTIQ هو الاسم المعتمد في مكوّن الهوية.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

function collectSourceFiles(rootDir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(rootDir)) {
    const full = join(rootDir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...collectSourceFiles(full));
    } else if (/\.tsx?$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

describe("هوية DENTIQ", () => {
  const roots = [join(process.cwd(), "app"), join(process.cwd(), "components")];

  it("لا تواجد للاسم القديم «سِنّة» في app/ وcomponents/", () => {
    const offenders = roots
      .flatMap((root) => collectSourceFiles(root))
      .filter((file) => readFileSync(file, "utf8").includes("سِنّة"));
    expect(offenders).toEqual([]);
  });

  it("مكوّن الهوية يحمل الاسم المعتمد DENTIQ", () => {
    const brandMark = readFileSync(
      join(process.cwd(), "components/auth/BrandMark.tsx"),
      "utf8",
    );
    expect(brandMark).toContain("DENTIQ");
  });
});
