"use client";

import { useCallback, useEffect, useState } from "react";
import { Pencil, Plus, RotateCw, Trash2, UserRound } from "lucide-react";
import type { StaffMemberDto } from "@/lib/services/staff";
import {
  avatarTint,
  commissionLabel,
  staffMemberToForm,
  type StaffFormValues,
} from "@/lib/staff-view";
import { toDateInputValue, formatWeekdayDateCell } from "@/lib/dates";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card, CardBody } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/Toast";
import { ConfirmDialog } from "@/components/appointments/ConfirmDialog";
import { StaffFormModal } from "./StaffFormModal";

// لوحة الطاقم — بطاقات الأعضاء كما في المرجع: أفاتار بلون التمييز، الدور،
// التخصص، الهاتف، نسبة العمولة، عدّاد المواعيد القادمة، وملاحظات الدوام.
// الإدارة: إضافة/تعديل/تعطيل/حذف — التعطيل تحوّل حالة آمن لا يفقد التاريخ.

type LoadState =
  | { kind: "loading" }
  | { kind: "error" }
  | { kind: "loaded"; staff: StaffMemberDto[] };

type EditingTarget = { id: string; values: StaffFormValues } | null;

export default function StaffBoard() {
  const { toast } = useToast();
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [busyId, setBusyId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<EditingTarget>(null);
  const [deleting, setDeleting] = useState<StaffMemberDto | null>(null);

  const refresh = useCallback(async () => {
    setState({ kind: "loading" });
    try {
      const res = await fetch(`/api/staff?today=${toDateInputValue(new Date())}`);
      if (res.status === 401) {
        window.location.href = "/login";
        return;
      }
      if (!res.ok) throw new Error();
      const data = (await res.json()) as { staff: StaffMemberDto[] };
      setState({ kind: "loaded", staff: data.staff });
    } catch {
      setState({ kind: "error" });
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const staff = state.kind === "loaded" ? state.staff : null;

  async function removeMember() {
    if (!deleting) return;
    setBusyId(deleting.id);
    try {
      const res = await fetch(`/api/staff/${encodeURIComponent(deleting.id)}`, {
        method: "DELETE",
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        toast(data.error ?? "تعذر حذف العضو", "danger");
        return;
      }
      toast("حُذف العضو");
      setDeleting(null);
      await refresh();
    } catch {
      toast("تعذر الاتصال بالخادم، حاول مرة أخرى", "danger");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <PageHeader
        title="الطاقم"
        description={formatWeekdayDateCell(new Date())}
        actions={
          <Button
            variant="gold"
            shape="pill"
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            <Plus size={16} aria-hidden /> إضافة عضو
          </Button>
        }
      />

      {state.kind === "loading" && (
        <p className="text-sm text-steel-500" role="status">
          جارٍ تحميل الطاقم…
        </p>
      )}

      {state.kind === "error" && (
        <div className="border-danger-300 bg-danger-50 rounded-panel border p-4 text-sm text-danger-700">
          <p role="alert">تعذر تحميل الطاقم، حاول مرة أخرى.</p>
          <Button variant="secondary" size="sm" className="mt-3" onClick={() => void refresh()}>
            <RotateCw size={14} aria-hidden /> إعادة المحاولة
          </Button>
        </div>
      )}

      {staff !== null && staff.length === 0 && (
        <Card>
          <CardBody>
            <EmptyState
              icon={UserRound}
              title="لا أعضاء في الطاقم بعد"
              description="أضف أول عضو بالضغط على «إضافة عضو» — الأطباء والاستقبال والمساعدون كلهم من هنا."
            />
          </CardBody>
        </Card>
      )}

      {staff !== null && staff.length > 0 && (
        <div className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(250px,1fr))]">
          {staff.map((member) => {
            const tint = avatarTint(member.colorHex);
            const commission = commissionLabel(member.commissionPercent);
            return (
              <Card
                key={member.id}
                className={member.isActive ? undefined : "opacity-60"}
              >
                <CardBody className="p-4">
                  <div className="mb-3 flex items-center gap-3">
                    <span
                      aria-hidden
                      style={tint}
                      className="grid size-12 shrink-0 place-items-center rounded-2xl border text-lg font-bold"
                    >
                      {member.name.trim().charAt(0) || "؟"}
                    </span>
                    <div className="min-w-0">
                      <p className="flex items-center gap-2 truncate text-[15px] font-bold text-ink-900">
                        {member.name}
                        {!member.isActive && (
                          <Badge tone="neutral">معطّل</Badge>
                        )}
                      </p>
                      <p className="text-xs text-warm-500">
                        {member.roleLabelAr}
                      </p>
                    </div>
                  </div>

                  {member.specialty && (
                    <p className="flex items-baseline justify-between gap-2 border-b border-warm-200 py-1.5 text-sm">
                      <span className="text-xs text-warm-500">التخصص</span>
                      <span className="text-ink-900">{member.specialty}</span>
                    </p>
                  )}
                  {member.phone && (
                    <p className="flex items-baseline justify-between gap-2 border-b border-warm-200 py-1.5 text-sm">
                      <span className="text-xs text-warm-500">الهاتف</span>
                      <a
                        href={`tel:${member.phone.replace(/\s/g, "")}`}
                        dir="ltr"
                        className="numeric text-primary-700 hover:text-primary-800"
                      >
                        {member.phone}
                      </a>
                    </p>
                  )}
                  {commission && (
                    <p className="flex items-baseline justify-between gap-2 border-b border-warm-200 py-1.5 text-sm">
                      <span className="text-xs text-warm-500">نسبة العمولة</span>
                      <span className="numeric font-bold text-primary-700">
                        {commission}
                      </span>
                    </p>
                  )}
                  <p className="flex items-baseline justify-between gap-2 border-b border-warm-200 py-1.5 text-sm">
                    <span className="text-xs text-warm-500">مواعيد قادمة</span>
                    <span className="numeric text-ink-900">
                      {member.upcomingCount}
                    </span>
                  </p>
                  {member.scheduleNote && (
                    <p className="mt-2 text-xs text-warm-500">
                      🕐 {member.scheduleNote}
                    </p>
                  )}

                  <div className="mt-3 flex flex-wrap items-center gap-1.5">
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={busyId === member.id}
                      onClick={() => {
                        setEditing({
                          id: member.id,
                          values: staffMemberToForm(member),
                        });
                        setFormOpen(true);
                      }}
                    >
                      <Pencil size={14} aria-hidden /> تعديل
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={busyId === member.id}
                      onClick={() => setDeleting(member)}
                    >
                      <Trash2 size={14} aria-hidden /> حذف
                    </Button>
                  </div>
                </CardBody>
              </Card>
            );
          })}
        </div>
      )}

      {formOpen && (
        <StaffFormModal
          key={editing?.id ?? "new"}
          open={formOpen}
          editing={editing}
          onClose={() => setFormOpen(false)}
          onSaved={(message) => {
            setFormOpen(false);
            toast(message);
            void refresh();
          }}
        />
      )}

      <ConfirmDialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        title="حذف عضو الطاقم"
        description="ستفصل مواعيده عنه (تبقى موجودة بلا طبيب). متابعة؟"
        confirmLabel="حذف"
        onConfirm={() => void removeMember()}
        loading={busyId === deleting?.id}
      />
    </>
  );
}
