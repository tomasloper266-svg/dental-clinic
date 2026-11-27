import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
    setupFiles: ["./tests/setup.ts"],
    // ملفات التكامل تشترك في قاعدة بيانات واحدة — التنفيذ المتوازي يجعل
    // تنظيف ملف يحذف بيانات ملف آخر (انتهاك مفاتيح أجنبية). تتابع إجباري.
    fileParallelism: false,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname),
    },
  },
});
