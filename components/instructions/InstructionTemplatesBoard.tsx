"use client";

import { useCallback, useEffect, useState } from "react";

// لوحة قوالب التعليمات — إضافة وتعديل وحذف القوالب حسب الإجراء.
// الطبيب يعدّل نصوص التعليمات هنا، وتُستخدم نفس القوالب في لوحة الإرسال
// بعد اكتمال العلاج.

type TemplateJson = {
  id: string;
  procedure: string;
  body: string;
};

type LoadState =
  | { kind: "loading" }
  | { kind: "error" }
  | { kind: "loaded"; templates: TemplateJson[] };

export default function InstructionTemplatesBoard() {
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [procedure, setProcedure] = useState("");
  const [body, setBody] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editProcedure, setEditProcedure] = useState("");
  const [editBody, setEditBody] = useState("");

  const refresh = useCallback(async () => {
    setState({ kind: "loading" });
    try {
      const res = await fetch("/api/instruction-templates");
      if (!res.ok) throw new Error();
      const data = (await res.json()) as { templates: TemplateJson[] };
      setState({ kind: "loaded", templates: data.templates });
    } catch {
      setState({ kind: "error" });
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function addTemplate() {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/instruction-templates", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ procedure, body }),
      });
      const data = (await res.json()) as {
        template?: TemplateJson;
        error?: string;
      };
      if (!res.ok || !data.template) {
        setError(data.error ?? "تعذر إضافة القالب");
        return;
      }
      setState((prev) =>
        prev.kind === "loaded"
          ? {
              kind: "loaded",
              templates: [...prev.templates, data.template as TemplateJson],
            }
          : prev,
      );
      setProcedure("");
      setBody("");
    } catch {
      setError("تعذر الاتصال بالخادم");
    } finally {
      setBusy(false);
    }
  }

  async function saveEdit(id: string) {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(
        `/api/instruction-templates/${encodeURIComponent(id)}`,
        {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ procedure: editProcedure, body: editBody }),
        },
      );
      const data = (await res.json()) as {
        template?: TemplateJson;
        error?: string;
      };
      if (!res.ok || !data.template) {
        setError(data.error ?? "تعذر تعديل القالب");
        return;
      }
      setState((prev) =>
        prev.kind === "loaded"
          ? {
              kind: "loaded",
              templates: prev.templates.map((t) =>
                t.id === id ? (data.template as TemplateJson) : t,
              ),
            }
          : prev,
      );
      setEditingId(null);
    } catch {
      setError("تعذر الاتصال بالخادم");
    } finally {
      setBusy(false);
    }
  }

  async function removeTemplate(id: string) {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(
        `/api/instruction-templates/${encodeURIComponent(id)}`,
        { method: "DELETE" },
      );
      if (!res.ok && res.status !== 204) throw new Error();
      setState((prev) =>
        prev.kind === "loaded"
          ? {
              kind: "loaded",
              templates: prev.templates.filter((t) => t.id !== id),
            }
          : prev,
      );
    } catch {
      setError("تعذر حذف القالب");
    } finally {
      setBusy(false);
    }
  }

  const canAdd = procedure.trim().length >= 2 && body.trim().length >= 5;

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-2xl bg-white p-4 shadow-md">
        <h2 className="mb-1 text-sm font-bold text-teal-800">قالب جديد</h2>
        <div className="flex flex-col gap-2">
          <input
            value={procedure}
            onChange={(e) => setProcedure(e.target.value)}
            placeholder="الإجراء — خلع، حشو، زرعة، تنظيف…"
            aria-label="الإجراء"
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-teal-600 focus:outline-none"
          />
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={4}
            placeholder="نص التعليمات التي تُرسل للمريض بعد هذا الإجراء…"
            aria-label="نص التعليمات"
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-teal-600 focus:outline-none"
          />
          <button
            type="button"
            onClick={addTemplate}
            disabled={busy || !canAdd}
            className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
          >
            إضافة القالب
          </button>
        </div>
        {error && (
          <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
            {error}
          </p>
        )}
      </div>

      {state.kind === "loading" && (
        <div
          className="h-20 animate-pulse rounded-xl border border-gray-100 bg-gray-50"
          aria-busy="true"
        />
      )}

      {state.kind === "error" && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-center text-sm text-red-700">
          تعذر تحميل القوالب
          <button type="button" onClick={refresh} className="ms-2 underline">
            إعادة المحاولة
          </button>
        </div>
      )}

      {state.kind === "loaded" &&
        (state.templates.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-300 bg-white p-6 text-center text-sm text-gray-500">
            لا قوالب بعد — أضف قالباً لكل إجراء يُرسل بعد تعليماته.
          </div>
        ) : (
          <ul className="space-y-2">
            {state.templates.map((t) => (
              <li key={t.id} className="rounded-2xl bg-white p-4 shadow-md">
                {editingId === t.id ? (
                  <div className="flex flex-col gap-2">
                    <input
                      value={editProcedure}
                      onChange={(e) => setEditProcedure(e.target.value)}
                      aria-label="الإجراء"
                      className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
                    />
                    <textarea
                      value={editBody}
                      onChange={(e) => setEditBody(e.target.value)}
                      rows={4}
                      aria-label="نص التعليمات"
                      className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => saveEdit(t.id)}
                        disabled={busy}
                        className="rounded-lg bg-teal-700 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50"
                      >
                        حفظ
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs text-gray-600"
                      >
                        إلغاء
                      </button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="rounded-lg border border-teal-300 bg-teal-50 px-2 py-0.5 text-xs font-bold text-teal-800">
                        {t.procedure}
                      </span>
                      <div className="ms-auto flex gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingId(t.id);
                            setEditProcedure(t.procedure);
                            setEditBody(t.body);
                          }}
                          disabled={busy}
                          className="rounded-lg border border-gray-300 bg-white px-2.5 py-1 text-xs text-gray-700"
                        >
                          تعديل
                        </button>
                        <button
                          type="button"
                          onClick={() => removeTemplate(t.id)}
                          disabled={busy}
                          className="rounded-lg border border-red-200 bg-red-50 px-2.5 py-1 text-xs text-red-700"
                        >
                          حذف
                        </button>
                      </div>
                    </div>
                    <p className="mt-2 text-xs leading-5 whitespace-pre-line text-gray-700">
                      {t.body}
                    </p>
                  </div>
                )}
              </li>
            ))}
          </ul>
        ))}
    </div>
  );
}
