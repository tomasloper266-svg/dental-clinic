import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

// تهيئة افتراضية لـ next/navigation — مكوّنات الاختبار التي تركّب
// I18nProvider (يقرأ الراوتر لتغيير اللغة) أو أي راوتر خارج شجرة
// التطبيق تفشل دونه. الملفات التي تزيّف الراوتر بنفسها تبقى على تزييفها.
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    prefetch: vi.fn(),
    refresh: vi.fn(),
  }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
  useSelectedLayoutSegment: () => null,
  useSelectedLayoutSegments: () => [],
}));

// تنظيف صريح بعد كل اختبار — الـ auto-cleanup معطّل لأن vitest
// لا يعمل بوضع globals، وبدونه تتسرب مكوّنات اختبار لاحقة.
afterEach(() => cleanup());
