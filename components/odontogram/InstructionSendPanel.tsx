"use client";

import { useEffect, useState } from "react";
import { buildWhatsAppUrl } from "@/lib/reminders/whatsapp";

// لوحة إرسال التعليمات — تُفتح تلقائياً عند اكتمال علاج (TREATMENT_DONE):
// تجلب القوالب المطابقة لإجراء العلاج ورقم هاتف المريض، ولكل قالب زر واتساب
// (رابط wa.me مقبّد بنص التعليمات) وزر نسخ نصي. كل إرسال يُسجَّل في تاريخ
// المريض عبر POST على /api/patients/[patientId]/instructions.

type TemplateJson = { id: string; procedure: string; body: string };

type Props = { patientId: string; procedure: string };

type PanelState =
  | { kind: "loading" }
  | { kind: "error" }
  | { kind: "ready"; templates: TemplateJson[]; phone: string | null };

export default function InstructionSendPanel({ patientId, procedure }: Props) {
  const [state, setState] = useState<PanelState>({ kind: "loading" });
  const [recorded, setRecorded] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setState({ kind: "loading" });
      try {
        const [templatesRes, patientRes] = await Promise.all([
          fetch(
            `/api/instruction-templates?procedure=${encodeURIComponent(procedure)}`,
          ),
          fetch(`/api/patients/${encodeURIComponent(patientId)}`),
        ]);
        if (!templatesRes.ok || !patientRes.ok) throw new Error();
        const templatesData = (await templatesRes.json()) as {
          templates: TemplateJson[];
        };
        const patientData = (await patientRes.json()) as {
          patient: { phone: string | null } | null;
        };
        if (cancelled) return;
        setState({
          kind: "ready",
          templates: templatesData.templates,
          phone: patientData.patient?.phone ?? null,
        });
      } catch {
        if (!cancelled) setState({ kind: "error" });
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [patientId, procedure]);

  async function recordSend(
    template: TemplateJson,
    channel: "WHATSAPP" | "TEXT",
  ) {
    setRecorded((prev) => [...prev, template.id]);
    try {
      await fetch(
        `/api/patients/${encodeURIComponent(patientId)}/instructions`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            templateId: template.id,
            procedure,
            body: template.body,
            channel,
          }),
        },
      );
    } catch {
      // تسجيل الإرسال اختياري عند فشل الشبكة — لا يعطل إرسال الطبيب الفعلي.
    }
  }

  function sendWhatsApp(template: TemplateJson) {
    if (state.kind !== "ready" || !state.phone) return;
    const url = buildWhatsAppUrl(state.phone, template.body);
    if (!url) return;
    window.open(url, "_blank", "noopener,noreferrer");
    void recordSend(template, "WHATSAPP");
  }

  async function copyText(template: TemplateJson) {
    await navigator.clipboard.writeText(template.body);
    void recordSend(template, "TEXT");
  }

  if (state.kind === "loading") {
    return (
      <div
        className="mt-2 h-16 animate-pulse rounded-lg border border-teal-100 bg-teal-50"
        aria-busy="true"
      />
    );
  }

  if (state.kind === "error") {
    return (
      <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
        تعذر تحميل قوالب التعليمات لهذا الإجراء.
      </p>
    );
  }

  if (state.templates.length === 0) {
    return (
      <p className="mt-2 rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-500">
        لا توجد قوالب تعليمات مطابقة لإجراء «{procedure}» — أضف قالباً من صفحة
        قوالب التعليمات.
      </p>
    );
  }

  return (
    <div className="mt-2 rounded-lg border border-teal-200 bg-teal-50 p-2">
      <p className="mb-1 text-xs font-semibold text-teal-800">
        تعليمات ما بعد «{procedure}» — اختر طريقة الإرسال:
      </p>
      <ul className="space-y-1.5">
        {state.templates.map((t) => (
          <li key={t.id} className="rounded-lg bg-white p-2">
            <p className="text-[11px] leading-5 whitespace-pre-line text-gray-700">
              {t.body}
            </p>
            <div className="mt-1 flex gap-1.5">
              {state.phone ? (
                <button
                  type="button"
                  onClick={() => sendWhatsApp(t)}
                  className="rounded-lg bg-green-600 px-3 py-1 text-[11px] font-bold text-white"
                >
                  {recorded.includes(t.id) ? "أُرسل ✓ واتساب" : "إرسال واتساب"}
                </button>
              ) : (
                <span className="text-[11px] text-amber-700">
                  لا رقم هاتف للمريض — استخدم النسخ النصي
                </span>
              )}
              <button
                type="button"
                onClick={() => copyText(t)}
                className="rounded-lg border border-gray-300 px-3 py-1 text-[11px] text-gray-700"
              >
                {recorded.includes(t.id) ? "نُسخ ✓" : "نسخ النص"}
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
