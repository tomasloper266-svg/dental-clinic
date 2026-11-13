"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ClipboardList, Pencil, Plus, RotateCw, Trash2 } from "lucide-react";
import { filterTemplates, templateExcerpt } from "@/lib/templates-view";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { PanelToolbar, SearchInput } from "@/components/ui/Toolbar";
import { EntityCell } from "@/components/ui/EntityCell";
import { IconAction, PillAction } from "@/components/ui/TableActions";
import { StatusPill } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { ConfirmDialog } from "@/components/appointments/ConfirmDialog";
import { Field, Input, Textarea } from "@/components/ui/Field";
import { EmptyState } from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/components/ui/cn";
import { MessagePreview } from "@/components/instructions/MessagePreview";

// لوحة قوالب ما بعد العلاج — كل قالب يُعرض بمعاينة حقيقية للرسالة
// كما ستُرسل للمريض (نفس النص الذي يُرمَّز في رابط wa.me في لوحة
// الإرسال بعد اكتمال العلاج). الإضافة والتعديل والسحب عبر واجهات
// القوالب نفسها دون أي تغيير، والحذف بتأكيد صريح.

type TemplateJson = {
  id: string;
  procedure: string;
  body: string;
};

export default function InstructionTemplatesBoard() {
  const { toast } = useToast();
  const [templates, setTemplates] = useState<TemplateJson[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<TemplateJson | null>(null);
  const [removing, setRemoving] = useState<TemplateJson | null>(null);
  /** القالب المعروض في لوحة المعاينة — الافتراضي أول قالب */
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoadError(false);
    try {
      const res = await fetch("/api/instruction-templates");
      if (!res.ok) throw new Error();
      const data = (await res.json()) as { templates: TemplateJson[] };
      setTemplates(data.templates);
    } catch {
      setTemplates(null);
      setLoadError(true);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  /** POST /api/instruction-templates — إضافة قالب جديد */
  async function addTemplate(body: {
    procedure: string;
    body: string;
  }): Promise<boolean> {
    setBusy(true);
    try {
      const res = await fetch("/api/instruction-templates", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as {
        template?: TemplateJson;
        error?: string;
      };
      if (!res.ok || !data.template) {
        toast(data.error ?? "تعذر إضافة القالب، أعد المحاولة", "danger");
        return false;
      }
      toast("أُضيف القالب");
      await refresh();
      return true;
    } catch {
      toast("تعذر الاتصال بالخادم، حاول مرة أخرى", "danger");
      return false;
    } finally {
      setBusy(false);
    }
  }

  /** PUT /api/instruction-templates/[id] — حفظ تعديل قالب */
  async function saveEdit(
    id: string,
    body: { procedure: string; body: string },
  ): Promise<boolean> {
    setBusy(true);
    try {
      const res = await fetch(
        `/api/instruction-templates/${encodeURIComponent(id)}`,
        {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      const data = (await res.json()) as {
        template?: TemplateJson;
        error?: string;
      };
      if (!res.ok || !data.template) {
        toast(data.error ?? "تعذر تعديل القالب، أعد المحاولة", "danger");
        return false;
      }
      toast("حُفظ تعديل القالب");
      await refresh();
      return true;
    } catch {
      toast("تعذر الاتصال بالخادم، حاول مرة أخرى", "danger");
      return false;
    } finally {
      setBusy(false);
    }
  }

  /** DELETE /api/instruction-templates/[id] — حذف قالب بعد تأكيد */
  async function removeTemplate(id: string): Promise<boolean> {
    setBusy(true);
    try {
      const res = await fetch(
        `/api/instruction-templates/${encodeURIComponent(id)}`,
        { method: "DELETE" },
      );
      if (!res.ok && res.status !== 204) throw new Error();
      toast("حُذف القالب");
      await refresh();
      return true;
    } catch {
      toast("تعذر حذف القالب، أعد المحاولة", "danger");
      return false;
    } finally {
      setBusy(false);
    }
  }

  // القالب المعروض في المعاينة الحية — الافتراضي أول قالب عند التحميل.
  const selected =
    templates?.find((t) => t.id === selectedId) ?? templates?.[0] ?? null;

  // تصفية البحث نقية على القوالب المحمّلة حصراً
  const [search, setSearch] = useState("");
  const filtered = useMemo(
    () => (templates ? filterTemplates(templates, search) : null),
    [templates, search],
  );

  return (
    <>
      <PageHeader
        title="تعليمات ما بعد العلاج"
        description="قوالب التعليمات التي تُرسل للمريض بعد اكتمال العلاج — كل قالب معروض بمعاينة الرسالة كما ستصل، وبنفس النص الذي يُرمَّز في رابط واتساب عند الإرسال."
        actions={
          <Button onClick={() => setAdding(true)}>
            <Plus size={16} aria-hidden />
            قالب جديد
          </Button>
        }
      />

      {loadError ? (
        <div
          role="alert"
          className="mt-5 flex flex-col items-start gap-2 rounded-panel border border-danger-300 bg-danger-50 px-4 py-4"
        >
          <p className="text-xs font-medium text-danger-700">
            تعذر تحميل القوالب — تحقق من الاتصال ثم أعد المحاولة.
          </p>
          <Button variant="secondary" size="sm" onClick={() => void refresh()}>
            <RotateCw size={14} aria-hidden />
            إعادة المحاولة
          </Button>
        </div>
      ) : templates === null ? (
        <div aria-busy="true" className="mt-5 flex flex-col gap-3">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-28 animate-pulse rounded-panel bg-surface-sunken"
            />
          ))}
        </div>
      ) : templates.length === 0 ? (
        <div className="mt-5">
          <EmptyState
            icon={ClipboardList}
            title="لا قوالب بعد"
            description="أضف قالباً لكل إجراء — خلع، حشو، زرعة… — لتُفتح تعليماته تلقائياً عند اكتمال العلاج."
            action={
              <Button size="sm" onClick={() => setAdding(true)}>
                <Plus size={14} aria-hidden />
                قالب جديد
              </Button>
            }
          />
        </div>
      ) : selected ? (
        <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
          {/* بطاقة المحتوى — شريط أدوات بحث + شبكة بطاقات القوالب */}
          <Card>
            <CardHeader>
              <CardTitle>قوالب التعليمات</CardTitle>
            </CardHeader>
            <PanelToolbar className="border-b border-warm-200">
              <SearchInput
                value={search}
                onChange={setSearch}
                placeholder="ابحث في القوالب…"
                aria-label="بحث في قوالب التعليمات"
              />
              <span className="numeric text-xs text-warm-500">
                {filtered?.length ?? 0} قالب
              </span>
            </PanelToolbar>
            <CardBody className="pt-0">
              {filtered?.length === 0 ? (
                <EmptyState
                  icon={ClipboardList}
                  title="لا قوالب مطابقة"
                  description="عدّل كلمات البحث لتوسيع القائمة."
                  action={
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setSearch("")}
                    >
                      مسح البحث
                    </Button>
                  }
                />
              ) : (
                <ul className="grid gap-2 sm:grid-cols-2">
                  {filtered?.map((t) => {
                    const active = t.id === selected.id;
                    return (
                      <li key={t.id}>
                        <TemplateCard
                          template={t}
                          selected={active}
                          busy={busy}
                          onSelect={() => setSelectedId(t.id)}
                          onEdit={() => setEditing(t)}
                          onRemove={() => setRemoving(t)}
                        />
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardBody>
          </Card>

          {/* معاينة القالب المختار — حية دائماً */}
          <Card>
            <CardBody className="flex flex-col gap-3 py-4">
              <div className="flex items-center justify-between gap-2">
                <StatusPill tone="success">{selected.procedure}</StatusPill>
              </div>
              <MessagePreview body={selected.body} />
            </CardBody>
          </Card>
        </div>
      ) : null}

      <TemplateModal
        key="add-template"
        open={adding}
        title="قالب جديد"
        busy={busy}
        onClose={() => setAdding(false)}
        onSubmit={async (payload) => {
          const ok = await addTemplate(payload);
          if (ok) setAdding(false);
          return ok;
        }}
      />

      {editing && (
        <TemplateModal
          key={`edit-${editing.id}`}
          open
          title={`تعديل: ${editing.procedure}`}
          busy={busy}
          initialProcedure={editing.procedure}
          initialBody={editing.body}
          onClose={() => setEditing(null)}
          onSubmit={async (payload) => {
            const ok = await saveEdit(editing.id, payload);
            if (ok) setEditing(null);
            return ok;
          }}
        />
      )}

      <ConfirmDialog
        open={removing !== null}
        onClose={() => setRemoving(null)}
        title="حذف القالب"
        description={
          removing
            ? `سيُحذف قالب «${removing.procedure}» نهائياً ولن تُرسل تعليماته تلقائياً بعد اكتمال العلاج. هل تريد المتابعة؟`
            : ""
        }
        confirmLabel="احذف القالب"
        loading={busy}
        onConfirm={async () => {
          if (removing && (await removeTemplate(removing.id))) {
            setRemoving(null);
          }
        }}
      />
    </>
  );
}

/** بطاقة قالب — أفاتار بالإجراء وسطر معاينة باهت، وحبوب عرض مع أيقوني تعديل وحذف */
function TemplateCard({
  template,
  selected,
  busy,
  onSelect,
  onEdit,
  onRemove,
}: {
  template: TemplateJson;
  selected: boolean;
  busy: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onRemove: () => void;
}) {
  return (
    <div
      className={cn(
        "flex h-full flex-col gap-3 rounded-panel border bg-surface-raised p-3.5 transition-colors",
        selected
          ? "border-primary-600"
          : "border-warm-200 hover:bg-surface-hover",
      )}
    >
      <EntityCell
        name={template.procedure}
        subtitle={templateExcerpt(template.body)}
      />
      <div className="mt-auto flex items-center gap-1.5">
        <PillAction variant={selected ? "solid" : "outline"} onClick={onSelect}>
          عرض
        </PillAction>
        <IconAction
          icon={Pencil}
          label={`تعديل قالب ${template.procedure}`}
          onClick={onEdit}
        />
        <IconAction
          icon={Trash2}
          label={`حذف قالب ${template.procedure}`}
          tone="danger"
          disabled={busy}
          onClick={onRemove}
        />
      </div>
    </div>
  );
}

/** نافذة قالب — إضافة أو تعديل، مع معاينة حية للرسالة أثناء الكتابة */
function TemplateModal({
  open,
  title,
  busy,
  initialProcedure = "",
  initialBody = "",
  onClose,
  onSubmit,
}: {
  open: boolean;
  title: string;
  busy: boolean;
  initialProcedure?: string;
  initialBody?: string;
  onClose: () => void;
  onSubmit: (payload: { procedure: string; body: string }) => Promise<boolean>;
}) {
  const [procedure, setProcedure] = useState(initialProcedure);
  const [body, setBody] = useState(initialBody);
  const [error, setError] = useState<string | null>(null);

  const canSave = procedure.trim().length >= 2 && body.trim().length >= 5;

  function buildPayload(): { procedure: string; body: string } | null {
    if (!canSave) {
      setError("الإجراء حرفان على الأقل ونص التعليمات خمسة أحرف على الأقل");
      return null;
    }
    setError(null);
    return { procedure: procedure.trim(), body: body.trim() };
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <>
          <Button
            loading={busy}
            disabled={!canSave}
            onClick={async () => {
              const payload = buildPayload();
              if (payload && (await onSubmit(payload))) {
                onClose();
              }
            }}
          >
            احفظ القالب
          </Button>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            إلغاء
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label="الإجراء" htmlFor="template-procedure">
          <Input
            id="template-procedure"
            value={procedure}
            onChange={(e) => setProcedure(e.target.value)}
            placeholder="مثال: خلع ضرس العقل"
          />
        </Field>
        <Field label="نص التعليمات" htmlFor="template-body">
          <Textarea
            id="template-body"
            rows={4}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="التعليمات التي تصل للمريض بعد هذا الإجراء…"
          />
        </Field>
        {error && (
          <p role="alert" className="text-xs text-danger-600">
            {error}
          </p>
        )}
        <MessagePreview
          body={body.trim() || "ستظهر معاينة الرسالة هنا أثناء الكتابة…"}
        />
      </div>
    </Modal>
  );
}
