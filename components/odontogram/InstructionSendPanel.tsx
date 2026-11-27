"use client";
import { useI18n } from "@/components/i18n/I18nProvider";

import { useEffect, useState } from "react";
import { Copy, MessageCircle } from "lucide-react";
import { buildWhatsAppUrl } from "@/lib/reminders/whatsapp";
import { MessagePreview } from "@/components/instructions/MessagePreview";

// لوحة إرسال التعليمات — تُفتح تلقائياً عند اكتمال علاج (TREATMENT_DONE):
// تجلب القوالب المطابقة لإجراء العلاج ورقم هاتف المريض، ولكل قالب
// معاينة حقيقية للرسالة كما ستُرسل (نفس النص المرمَّز في رابط wa.me)
// وزر واتساب وزر نسخ. كل إرسال يُسجَّل في تاريخ المريض عبر POST
// على /api/patients/[patientId]/instructions. منطق الإرسال والتسجيل
// لا يُلمس — هذه إعادة عرض فقط.

type TemplateJson = { id: string; procedure: string; body: string };

type Props = { patientId: string; procedure: string };

type PanelState =
  | { kind: "loading" }
  | { kind: "error" }
  | { kind: "ready"; templates: TemplateJson[]; phone: string | null };

export default function InstructionSendPanel({ patientId, procedure }: Props) {
  const { t } = useI18n();
  const [state, setState] = useState<PanelState>({ kind: "loading" });
  const [recorded, setRecorded] = useState<string[]>([]);
  const [copyError, setCopyError] = useState(false);

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
    try {
      await navigator.clipboard.writeText(template.body);
      setCopyError(false);
      void recordSend(template, "TEXT");
    } catch {
      setCopyError(true);
    }
  }

  if (state.kind === "loading") {
    return (
      <div aria-busy="true" className="mt-2 flex flex-col gap-2">
        {[0, 1].map((i) => (
          <div
            key={i}
            className="h-24 animate-pulse rounded-panel bg-surface-sunken"
          />
        ))}
      </div>
    );
  }

  if (state.kind === "error") {
    return (
      <div
        role="alert"
        className="mt-2 rounded-panel border border-danger-300 bg-danger-50 px-3 py-2 text-xs text-danger-700"
      >
        {t("instructions.loadProcedureFailed")}
      </div>
    );
  }

  if (state.templates.length === 0) {
    return (
      <div className="mt-2 rounded-panel border border-warm-200 bg-surface-sunken px-3 py-2 text-xs text-warm-600">
        {t("instructions.noMatchForProcedure")}{procedure}{t("instructions.addFromPage")}
      </div>
    );
  }

  return (
    <div className="mt-2 flex flex-col gap-2">
      <p className="text-xs font-medium text-warm-600">
        {t("instructions.afterPrefix")}{procedure}{t("instructions.reviewAndSend")}
      </p>
      {state.templates.map((tpl) => (
        <div
          key={tpl.id}
          className="rounded-panel border border-warm-200 bg-surface-raised p-3"
        >
          <MessagePreview body={tpl.body} phone={state.phone} />
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {state.phone ? (
              <button
                type="button"
                onClick={() => sendWhatsApp(tpl)}
                className="inline-flex items-center gap-1.5 rounded-full bg-success-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-success-700"
              >
                <MessageCircle size={13} aria-hidden />
                {recorded.includes(tpl.id) ? t("instructions.whatsappSent") : t("instructions.sendWhatsapp")}
              </button>
            ) : (
              <span className="text-xs text-warning-700">
                {t("instructions.noPhone")}
              </span>
            )}
            <button
              type="button"
              onClick={() => void copyText(tpl)}
              className="inline-flex items-center gap-1.5 rounded-full border border-warm-300 px-3 py-1.5 text-xs font-medium text-warm-700 hover:bg-surface-hover"
            >
              <Copy size={13} aria-hidden />
              {recorded.includes(tpl.id) ? t("instructions.copiedCheck") : t("instructions.copyText")}
            </button>
            {copyError && (
              <span role="alert" className="text-xs text-danger-600">
                {t("instructions.copyFailed")}
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
