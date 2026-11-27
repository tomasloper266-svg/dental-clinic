import { getServerT } from "@/lib/i18n";
import Link from "next/link";
import { ToothIcon } from "@/components/shell/icons/ToothIcon";

/**
 * صفحة الهبوط داخل نظام الـ tokens — هوية عاجي/أخضر طبي عميق،
 * بلا ألوان Tailwind خام ولا متغيرات وضع داكن (المعطّل في هذا التطبيق).
 */
export default async function Home() {
  const t = await getServerT();
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-10 p-8 text-center">
      <div className="flex flex-col items-center gap-4">
        <span
          aria-hidden
          className="grid size-14 place-items-center rounded-panel bg-primary-900 text-primary-100 shadow-md"
        >
          <ToothIcon size={30} />
        </span>
        <h1 className="font-display text-3xl font-normal text-ink-900 sm:text-4xl">
          {t("landing.subtitle")}
        </h1>
        <p className="mt-1 max-w-md text-lg text-steel-600">
          {t("landing.tagline")}
        </p>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row">
        <Link
          href="/signup"
          className="focus-ring inline-flex items-center justify-center rounded-field bg-primary-600 px-8 py-4 text-lg font-semibold text-white shadow-sm transition-colors hover:bg-primary-700"
        >
          {t("landing.registerClinic")}
        </Link>
        <Link
          href="/login"
          className="focus-ring inline-flex items-center justify-center rounded-field border border-warm-300 bg-surface-raised px-8 py-4 text-lg font-semibold text-ink-900 shadow-xs transition-colors hover:bg-surface-hover"
        >
          {t("landing.login")}
        </Link>
      </div>

      <p className="text-sm text-steel-500">
        {t("landing.appendOnlyNote")}
      </p>
    </main>
  );
}
