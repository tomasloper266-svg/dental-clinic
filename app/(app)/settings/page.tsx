import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, getSessionUser } from "@/lib/auth/session";
import SettingsBoard from "@/components/settings/SettingsBoard";

// صفحة الإعدادات — بيانات العيادة والطبيب والحساب والأمان، محمية بالجلسة،
// وبياناتها من واجهة برمجة الحساب المرتبطة بالعيادة حصراً.
export default async function SettingsPage() {
  const session = await getSessionUser(
    (await cookies()).get(SESSION_COOKIE)?.value,
  );
  if (!session) redirect("/login");

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6">
      <SettingsBoard />
    </div>
  );
}
