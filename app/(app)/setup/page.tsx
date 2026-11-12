import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, getSessionUser } from "@/lib/auth/session";
import SetupBoard from "@/components/auth/SetupBoard";

// صفحة الإعداد بعد التسجيل — محمية بالجلسة، وترشد لاستكمال بيانات
// العيادة والطبيب وربط بريد موثق قبل العودة إلى لوحة القيادة.
export default async function SetupPage() {
  const session = await getSessionUser(
    (await cookies()).get(SESSION_COOKIE)?.value,
  );
  if (!session) redirect("/login");

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8">
      <SetupBoard />
    </div>
  );
}
