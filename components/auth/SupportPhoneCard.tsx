"use client";

import { LifeBuoy, Phone } from "lucide-react";
import { useI18n } from "@/components/i18n/I18nProvider";

// بطاقة الدعم المشتركة بين صفحتَي «نسيت كلمة المرور» و«نسيت رقم الهاتف» —
// رقم الهاتف رابط اتصال مباشر (tel:)، وينفتح اتصال فوري من الموبايل.
// النصوص من القاموس حسب لغة الجلسة.

const SUPPORT_PHONE = "0997934237";
const SUPPORT_PHONE_DISPLAY = "0997 934 237";

const PRIMARY_BTN_CLS =
  "h-12 w-full rounded-[10px] text-[15px] font-semibold text-white transition-colors hover:opacity-90";

export function SupportPhoneCard() {
  const { t } = useI18n();

  return (
    <section
      aria-label={t("auth.support.aria")}
      className="rounded-2xl bg-white px-6 py-8 text-center"
    >
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#eceefc]">
        <LifeBuoy size={26} color="#4a5cd9" aria-hidden />
      </div>
      <h2 className="mt-4 text-lg font-bold text-[#16181d]">
        {t("auth.support.title")}
      </h2>
      <p className="mt-2 text-sm leading-6 text-[#6a6f83]">
        {t("auth.support.description")}
      </p>
      <a
        href={`tel:${SUPPORT_PHONE}`}
        dir="ltr"
        className="mt-5 flex items-center justify-center gap-2 text-3xl font-bold tracking-wide text-[#16181d] hover:text-[#4a5cd9]"
      >
        <Phone size={24} color="#4a5cd9" aria-hidden />
        {SUPPORT_PHONE_DISPLAY}
      </a>
      <a
        href={`tel:${SUPPORT_PHONE}`}
        className={`${PRIMARY_BTN_CLS} mt-6 inline-block leading-[48px]`}
        style={{ background: "#5B6CE4" }}
      >
        {t("auth.support.call")}
      </a>
    </section>
  );
}
