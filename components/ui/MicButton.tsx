"use client";

import { useCallback, useRef } from "react";
import { Mic, Square } from "lucide-react";
import { useVoiceInput } from "@/lib/use-voice-input";
import { insertDictation, type RecognitionCtor } from "@/lib/voice-input";
import { cn } from "./cn";

type MicButtonProps = {
  /** معرّف الحقل النصي المرتبط — يُقرأ منه موضع المؤشر عند الإدراج */
  targetId: string;
  value: string;
  onChange: (next: string) => void;
  /** حقن اعتماديات للاختبار — الافتراضي يقرأ المتصفح */
  getCtor?: () => RecognitionCtor | null;
};

// زر المايك بجانب الحقول النصية السريرية — ينقل الكلام (ar-SA) عبر Web
// Speech API مجاناً في المتصفح. بلا دعم في المتصفح (فايرفوكس مثلاً) يُخفى
// الزر كلياً دون أي كسر. الإدراج في موضع المؤشر إن كان الحقل مركّزاً،
// وإلا الإلحاق بالنص الموجود — والنص بعده قابل للتعديل كأي نص مكتوب.
export function MicButton({ targetId, value, onChange, getCtor }: MicButtonProps) {
  const valueRef = useRef(value);
  valueRef.current = value;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const handleTranscript = useCallback(
    (text: string) => {
      const field = document.getElementById(targetId);
      const caret =
        field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement
          ? field.selectionStart
          : null;
      onChangeRef.current(insertDictation(valueRef.current, text, caret));
    },
    [targetId],
  );

  const { supported, listening, error, start, stop } = useVoiceInput({
    onTranscript: handleTranscript,
    getCtor,
  });

  if (!supported) return null;

  const label = listening
    ? "إيقاف الإدخال الصوتي"
    : "بدء الإدخال الصوتي (عربي)";

  return (
    <span className="inline-flex items-center gap-1.5">
      <button
        type="button"
        onClick={listening ? stop : start}
        aria-pressed={listening}
        aria-label={label}
        title={error ?? label}
        className={cn(
          "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-field border transition-colors",
          "focus-visible:outline-primary-500 focus-visible:outline-2 focus-visible:outline-offset-2",
          listening
            ? "border-danger-300 bg-danger-50 text-danger-600 animate-pulse"
            : "border-primary-200 bg-primary-50 text-primary-700 hover:bg-primary-100 active:bg-primary-200",
        )}
      >
        {listening ? (
          <Square size={15} aria-hidden fill="currentColor" />
        ) : (
          <Mic size={17} aria-hidden />
        )}
      </button>
      {listening && (
        <span role="status" className="text-danger-600 text-xs font-medium">
          جارٍ التسجيل…
        </span>
      )}
      {error && !listening && (
        <span role="alert" className="text-danger-600 text-xs">
          {error}
        </span>
      )}
    </span>
  );
}
