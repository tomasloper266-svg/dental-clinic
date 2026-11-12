import { cookies } from "next/headers";
import { pageWrapClass } from "@/lib/page-width";
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
    <div className={pageWrapClass("reading")}>
      <SetupBoard />
    </div>
  );
}
