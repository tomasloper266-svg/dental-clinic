// تحقق نقي من بيانات تسجيل العيادة — بلا أثر جانبي لسهولة اختباره.
export type SignupInput = {
  clinicName: string;
  name: string;
  phone: string;
  username: string;
  password: string;
};

export type ParseResult =
  { ok: true; value: SignupInput } | { ok: false; error: string };

const PHONE_RE = /^[0-9+\-\s]{6,20}$/;
// Username — معرف الدخول: أحرف إنكليزية وأرقام و . _ - فقط، 3 إلى 30 محرفاً.
const USERNAME_RE = /^[a-z0-9_.-]{3,30}$/;

export function normalizePhone(raw: string): string {
  return raw.replace(/[\s\-()]/g, "");
}

export function parseSignup(body: unknown): ParseResult {
  if (typeof body !== "object" || body === null) {
    return { ok: false, error: "طلب غير صالح" };
  }
  const b = body as Record<string, unknown>;
  const clinicName =
    typeof b.clinicName === "string" ? b.clinicName.trim() : "";
  const name = typeof b.name === "string" ? b.name.trim() : "";
  const phone = typeof b.phone === "string" ? normalizePhone(b.phone) : "";
  const username =
    typeof b.username === "string" ? b.username.trim().toLowerCase() : "";
  const password = typeof b.password === "string" ? b.password : "";

  if (clinicName.length < 2 || clinicName.length > 100) {
    return { ok: false, error: "اسم العيادة يجب أن يكون بين 2 و100 حرف" };
  }
  if (name.length < 2 || name.length > 100) {
    return { ok: false, error: "الاسم يجب أن يكون بين 2 و100 حرف" };
  }
  if (!PHONE_RE.test(phone)) {
    return { ok: false, error: "رقم الهاتف غير صالح" };
  }
  if (!USERNAME_RE.test(username)) {
    return {
      ok: false,
      error: "اسم المستخدم يجب أن يكون 3-30 محرفاً بالإنكليزية والأرقام و . _ - فقط",
    };
  }
  if (password.length < 8) {
    return { ok: false, error: "كلمة السر يجب ألا تقل عن 8 أحرف" };
  }
  return { ok: true, value: { clinicName, name, phone, username, password } };
}
