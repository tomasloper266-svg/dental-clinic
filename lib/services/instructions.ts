import { clinicScope } from "@/lib/tenant/clinic-client";
import type { TenantContext } from "@/lib/tenant/context";

// خدمة تعليمات ما بعد الجراحة — قوالب حسب الإجراء قابلة للتعديل من الطبيب،
// وتسجيل ما أُرسل ومتى في تاريخ المريض بقيد إلحاقي (InstructionSend).
// كل استعلام عبر clinicScope بمعرّف العيادة من سياق الجلسة.

export type InstructionTemplateDto = {
  id: string;
  procedure: string;
  body: string;
};

export type InstructionSendDto = {
  id: string;
  templateId: string | null;
  procedure: string;
  body: string;
  channel: "WHATSAPP" | "TEXT";
  sentById: string;
  sentAt: Date;
};

export type CreateTemplateInput = { procedure: string; body: string };
export type UpdateTemplateInput = { procedure?: string; body?: string };

function validateTemplateFields(
  b: Record<string, unknown>,
  requireAll: boolean,
):
  | { ok: true; value: Partial<CreateTemplateInput> }
  | { ok: false; error: string } {
  const out: Partial<CreateTemplateInput> = {};

  if (!requireAll || b.procedure !== undefined) {
    const procedure = typeof b.procedure === "string" ? b.procedure.trim() : "";
    if (procedure.length < 2 || procedure.length > 100) {
      return { ok: false, error: "اسم الإجراء يجب أن يكون بين 2 و100 حرف" };
    }
    out.procedure = procedure;
  }
  if (!requireAll || b.body !== undefined) {
    const body = typeof b.body === "string" ? b.body.trim() : "";
    if (body.length < 5 || body.length > 4000) {
      return { ok: false, error: "نص التعليمات يجب أن يكون بين 5 و4000 حرف" };
    }
    out.body = body;
  }
  return { ok: true, value: out };
}

// تحقق نقي للإنشاء — يُختبر بمعزل عن القاعدة.
export function parseCreateTemplate(
  body: unknown,
): { ok: true; value: CreateTemplateInput } | { ok: false; error: string } {
  if (typeof body !== "object" || body === null) {
    return { ok: false, error: "طلب غير صالح" };
  }
  const parsed = validateTemplateFields(body as Record<string, unknown>, true);
  return parsed.ok
    ? { ok: true, value: parsed.value as CreateTemplateInput }
    : parsed;
}

// نفس القواعد لكن كل حقل اختياري — يُحدَّث ما ورد فقط.
export function parseUpdateTemplate(
  body: unknown,
): { ok: true; value: UpdateTemplateInput } | { ok: false; error: string } {
  if (typeof body !== "object" || body === null) {
    return { ok: false, error: "طلب غير صالح" };
  }
  const parsed = validateTemplateFields(body as Record<string, unknown>, false);
  return parsed.ok
    ? { ok: true, value: parsed.value as UpdateTemplateInput }
    : parsed;
}

export async function listTemplates(
  ctx: TenantContext,
  procedure?: string,
): Promise<InstructionTemplateDto[]> {
  const db = clinicScope(ctx.clinicId);
  const templates = await db.instructionTemplate.findMany({
    where: procedure
      ? { procedure: { equals: procedure, mode: "insensitive" } }
      : {},
    orderBy: [{ procedure: "asc" }, { id: "asc" }],
    select: { id: true, procedure: true, body: true },
  });
  return templates;
}

// القوالب المطابقة لإجراء منجز — تُعرض للطبيب عند اكتمال العلاج (TREATMENT_DONE)
// ليختار ما يرسله للمريض بضغطة. تطابق تام على اسم الإجراء، وأخطاء التسمية
// الشائعة (مفرد/جمع وبعض الصيغ) تُغطى بمطابقة جزئية في كلا الاتجاهين.
export async function findTemplatesForProcedure(
  ctx: TenantContext,
  procedure: string,
): Promise<InstructionTemplateDto[]> {
  const trimmed = procedure.trim();
  if (trimmed.length < 2) return [];
  const db = clinicScope(ctx.clinicId);
  const all = await db.instructionTemplate.findMany({
    select: { id: true, procedure: true, body: true },
    orderBy: { id: "asc" },
  });
  const needle = trimmed.toLowerCase();
  return all.filter((t) => {
    const haystack = t.procedure.toLowerCase();
    return (
      haystack === needle ||
      haystack.includes(needle) ||
      needle.includes(haystack)
    );
  });
}

export async function createTemplate(
  ctx: TenantContext,
  input: CreateTemplateInput,
): Promise<InstructionTemplateDto> {
  const db = clinicScope(ctx.clinicId);
  const template = await db.instructionTemplate.create({
    data: {
      clinicId: ctx.clinicId,
      procedure: input.procedure,
      body: input.body,
    },
    select: { id: true, procedure: true, body: true },
  });
  return template;
}

export async function updateTemplate(
  ctx: TenantContext,
  templateId: string,
  input: UpdateTemplateInput,
): Promise<InstructionTemplateDto | null> {
  const db = clinicScope(ctx.clinicId);
  const existing = await db.instructionTemplate.findFirst({
    where: { id: templateId },
    select: { id: true },
  });
  if (!existing) return null;

  const template = await db.instructionTemplate.update({
    where: { id: templateId },
    data: input,
    select: { id: true, procedure: true, body: true },
  });
  return template;
}

export async function deleteTemplate(
  ctx: TenantContext,
  templateId: string,
): Promise<boolean> {
  const db = clinicScope(ctx.clinicId);
  const result = await db.instructionTemplate.deleteMany({
    where: { id: templateId },
  });
  return result.count > 0;
}

export type SendInstructionInput = {
  templateId?: string | null;
  procedure: string;
  body: string;
  channel: "WHATSAPP" | "TEXT";
};

// تحقق نقي لتسجيل الإرسال — نص التعليمات يُخزَّن كما أُرسل، والقالب اختياري.
export function parseSendInstruction(
  body: unknown,
): { ok: true; value: SendInstructionInput } | { ok: false; error: string } {
  if (typeof body !== "object" || body === null) {
    return { ok: false, error: "طلب غير صالح" };
  }
  const b = body as Record<string, unknown>;
  const procedure = typeof b.procedure === "string" ? b.procedure.trim() : "";
  if (procedure.length < 2 || procedure.length > 100) {
    return { ok: false, error: "اسم الإجراء غير صالح" };
  }
  const text = typeof b.body === "string" ? b.body.trim() : "";
  if (text.length < 5 || text.length > 4000) {
    return { ok: false, error: "نص التعليمات غير صالح" };
  }
  const channel = b.channel === "WHATSAPP" ? "WHATSAPP" : "TEXT";
  const templateId =
    typeof b.templateId === "string" && b.templateId.trim() !== ""
      ? b.templateId
      : null;
  return {
    ok: true,
    value: { templateId, procedure, body: text, channel },
  };
}

// تسجيل إرسال بقيد إلحاقي — المريض من المسار ولا يُوثق بمعرّف جسم الطلب.
// مريض عيادة أخرى يعيد null (404 في الـ handler).
export async function recordInstructionSend(
  ctx: TenantContext,
  patientId: string,
  input: SendInstructionInput,
): Promise<InstructionSendDto | null> {
  const db = clinicScope(ctx.clinicId);
  const patient = await db.patient.findFirst({
    where: { id: patientId },
    select: { id: true },
  });
  if (!patient) return null;

  const send = await db.instructionSend.create({
    data: {
      clinicId: ctx.clinicId,
      patientId,
      templateId: input.templateId,
      procedure: input.procedure,
      body: input.body,
      channel: input.channel,
      sentById: ctx.userId,
    },
    select: {
      id: true,
      templateId: true,
      procedure: true,
      body: true,
      channel: true,
      sentById: true,
      sentAt: true,
    },
  });
  return send;
}

// تاريخ الإرسالات للمريض — الأحدث أولاً، لأجل مراجعة الطبيب.
export async function listInstructionSends(
  ctx: TenantContext,
  patientId: string,
): Promise<InstructionSendDto[]> {
  const db = clinicScope(ctx.clinicId);
  const sends = await db.instructionSend.findMany({
    where: { patientId },
    orderBy: { sentAt: "desc" },
    take: 100,
    select: {
      id: true,
      templateId: true,
      procedure: true,
      body: true,
      channel: true,
      sentById: true,
      sentAt: true,
    },
  });
  return sends;
}
