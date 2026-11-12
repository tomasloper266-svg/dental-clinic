import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// تنظيف صريح بعد كل اختبار — الـ auto-cleanup معطّل لأن vitest
// لا يعمل بوضع globals، وبدونه تتسرب مكوّنات اختبار لاحق.
afterEach(() => cleanup());

