"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  collectFinalTranscript,
  getRecognitionCtor,
  recognitionErrorMessage,
  type RecognitionCtor,
  type RecognitionLike,
} from "./voice-input";

export type UseVoiceInputOptions = {
  /** لغة التعرف الصوتي — افتراضي العربية السعودية */
  lang?: string;
  /** تُستدعى بكل نص نهائي منقول — الإدراج في الحقل قرار المستدعي */
  onTranscript: (text: string) => void;
  /**
   * حقن اعتماديات للاختبار — يقرأ مُنشئ التعرف الصوتي. الافتراضي يقرأ
   * المتصفح الحقيقي.
   */
  getCtor?: () => RecognitionCtor | null;
};

export type VoiceInputState = {
  /** false حين لا يدعم المتصفح Web Speech API — يُخفى الزر عندئذٍ */
  supported: boolean;
  listening: boolean;
  error: string | null;
  start: () => void;
  stop: () => void;
};

/** hook الإدخال الصوتي — يغلف دورة حياة كائن التعرف الصوتي كاملة. */
export function useVoiceInput({
  lang = "ar-SA",
  onTranscript,
  getCtor = getRecognitionCtor,
}: UseVoiceInputOptions): VoiceInputState {
  // supported يُقرأ بعد التركيب فقط — كي لا يختلف ترميز الخادم عن العميل.
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const recognitionRef = useRef<RecognitionLike | null>(null);
  const onTranscriptRef = useRef(onTranscript);
  onTranscriptRef.current = onTranscript;
  const getCtorRef = useRef(getCtor);
  getCtorRef.current = getCtor;

  useEffect(() => {
    setSupported(getCtorRef.current() !== null);
    return () => {
      // إنهاء صريح عند التفكيك — جلسة ميكروفون معلقة لا تبقى حية.
      recognitionRef.current?.abort();
      recognitionRef.current = null;
    };
  }, []);

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
    setListening(false);
  }, []);

  const start = useCallback(() => {
    const ctor = getCtorRef.current();
    if (!ctor || recognitionRef.current) return;
    setError(null);

    const recognition = new ctor();
    recognition.lang = lang;
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.onresult = (event) => {
      const final = collectFinalTranscript(event);
      if (final) onTranscriptRef.current(final);
    };
    recognition.onerror = (event) => {
      const message = recognitionErrorMessage(event.error);
      // انقطاع متعمد عبر abort/stop ليس خطأ يعرض للمستخدم.
      if (message) setError(message);
    };
    recognition.onend = () => {
      recognitionRef.current = null;
      setListening(false);
    };
    recognitionRef.current = recognition;
    try {
      recognition.start();
      setListening(true);
    } catch {
      // start قد يرمي إن أُطلق مرتين متتاليتين — الحالة تبقى متسقة.
      recognitionRef.current = null;
      setError("تعذر بدء الإدخال الصوتي");
    }
  }, [lang]);

  return { supported, listening, error, start, stop };
}
