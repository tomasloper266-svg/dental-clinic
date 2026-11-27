"use client";
import { useI18n } from "@/components/i18n/I18nProvider";

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
  const { t } = useI18n();
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
        toast(data.error ?? t("instructions.addFailed"), "danger");
        return false;
      }
      toast(t("instructions.templateAdded"));
      await refresh();
      return true;
    } catch {
      toast(t("errors.serverRetry"), "danger");
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
        toast(data.error ?? t("instructions.updateFailed"), "danger");
        return false;
      }
      toast(t("instructions.templateUpdated"));
      await refresh();
      return true;
    } catch {
      toast(t("errors.serverRetry"), "danger");
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
      toast(t("instructions.templateDeleted"));
      await refresh();
      return true;
    } catch {
      toast(t("instructions.deleteFailed"), "danger");
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
        title={t("instructions.afterTreatment")}
        description={t("instructions.templatesFullHint")}
        actions={
          <Button onClick={() => setAdding(true)}>
            <Plus size={16} aria-hidden />
            {t("instructions.newTemplate")}
          </Button>
        }
      />

      {loadError ? (
        <div
          role="alert"
          className="mt-5 flex flex-col items-start gap-2 rounded-panel border border-danger-300 bg-danger-50 px-4 py-4"
        >
          <p className="text-xs font-medium text-danger-700">
            {t("instructions.loadFailed")}
          </p>
          <Button variant="secondary" size="sm" onClick={() => void refresh()}>
            <RotateCw size={14} aria-hidden />
            {t("common.retry")}
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
            title={t("instructions.empty")}
            description={t("instructions.addPerProcedure")}
            action={
              <Button size="sm" onClick={() => setAdding(true)}>
                <Plus size={14} aria-hidden />
                {t("instructions.newTemplate")}
              </Button>
            }
          />
        </div>
      ) : selected ? (
        <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
          {/* بطاقة المحتوى — شريط أدوات بحث + شبكة بطاقات القوالب */}
          <Card>
            <CardHeader>
              <CardTitle>{t("common.instructionTemplates")}</CardTitle>
            </CardHeader>
            <PanelToolbar className="border-b border-warm-200">
              <SearchInput
                value={search}
                onChange={setSearch}
                placeholder={t("instructions.searchPlaceholder")}
                aria-label={t("instructions.search")}
              />
              <span className="numeric text-xs text-warm-500">
                {filtered?.length ?? 0} {t("instructions.template")}
              </span>
            </PanelToolbar>
            <CardBody className="pt-0">
              {filtered?.length === 0 ? (
                <EmptyState
                  icon={ClipboardList}
                  title={t("instructions.noMatches")}
                  description={t("patients.widenList")}
                  action={
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setSearch("")}
                    >
                      {t("patients.clearSearch")}
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
        title={t("instructions.newTemplate")}
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
          title={t("instructions.editTitle", { procedure: editing.procedure })}
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
        title={t("instructions.deleteTemplateAction")}
        description={
          removing
            ? t("instructions.deleteTemplateConfirm", { procedure: removing.procedure })
            : ""
        }
        confirmLabel={t("instructions.deleteTemplate")}
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
  const { t } = useI18n();
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
          {t("common.view")}
        </PillAction>
        <IconAction
          icon={Pencil}
          label={t("instructions.editTemplateLabel", { procedure: template.procedure })}
          onClick={onEdit}
        />
        <IconAction
          icon={Trash2}
          label={t("instructions.deleteTemplateLabel", { procedure: template.procedure })}
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
  const { t } = useI18n();
  const [procedure, setProcedure] = useState(initialProcedure);
  const [body, setBody] = useState(initialBody);
  const [error, setError] = useState<string | null>(null);

  const canSave = procedure.trim().length >= 2 && body.trim().length >= 5;

  function buildPayload(): { procedure: string; body: string } | null {
    if (!canSave) {
      setError(t("instructions.minLengths"));
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
            {t("instructions.saveTemplate")}
          </Button>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            {t("common.cancel")}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label={t("common.procedure")} htmlFor="template-procedure">
          <Input
            id="template-procedure"
            value={procedure}
            onChange={(e) => setProcedure(e.target.value)}
            placeholder={t("dental.exampleWisdom")}
          />
        </Field>
        <Field label={t("instructions.body")} htmlFor="template-body">
          <Textarea
            id="template-body"
            rows={4}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={t("instructions.reachPatientHint")}
          />
        </Field>
        {error && (
          <p role="alert" className="text-xs text-danger-600">
            {error}
          </p>
        )}
        <MessagePreview
          body={body.trim() || t("instructions.previewPlaceholder")}
        />
      </div>
    </Modal>
  );
}
