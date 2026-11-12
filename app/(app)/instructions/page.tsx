import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, getSessionUser } from "@/lib/auth/session";
import InstructionTemplatesBoard from "@/components/instructions/InstructionTemplatesBoard";
import LogoutButton from "@/components/LogoutButton";

// صفحة قوالب التعليمات — إدارة قوالب ما بعد الجراحة حسب الإجراء.
export default async function InstructionsPage() {
  const session = await getSessionUser(
    (await cookies()).get(SESSION_COOKIE)?.value,
  );
  if (!session) redirect("/login");

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-6">
      <div className="mx-auto flex w-full max-w-md flex-col gap-4">
        <header className="flex items-center justify-between">
          <h1 className="text-lg font-bold text-teal-800">قوالب التعليمات</h1>
          <div className="flex items-center gap-3 text-xs">
            <a href="/dashboard" className="text-teal-700 underline">
              لوحة الطبيب
            </a>
            <LogoutButton />
          </div>
        </header>
        <p className="text-xs text-gray-500">
          عند اكتمال علاج من خطة العلاج تُفتح القوالب المطابقة للإجراء لتُرسل
          للمريض بواتساب أو نسخة نصية.
        </p>
        <InstructionTemplatesBoard />
      </div>
    </main>
  );
}
