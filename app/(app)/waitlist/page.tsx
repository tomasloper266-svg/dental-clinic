import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, getSessionUser } from "@/lib/auth/session";
import { toDateInputValue } from "@/lib/dates";
import WaitlistBoard from "@/components/WaitlistBoard";
import LogoutButton from "@/components/LogoutButton";

// صفحة قائمة الانتظار — مرضى طالبو موعداً + مقترحات فجوات شاغرة باليوم.
export default async function WaitlistPage() {
  const session = await getSessionUser(
    (await cookies()).get(SESSION_COOKIE)?.value,
  );
  if (!session) redirect("/login");

  const today = toDateInputValue(new Date());

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-6">
      <div className="mx-auto flex w-full max-w-md flex-col gap-4">
        <header className="flex items-center justify-between">
          <h1 className="text-lg font-bold text-teal-800">
            قائمة الانتظار والفجوات
          </h1>
          <div className="flex items-center gap-3 text-xs">
            <a href="/appointments" className="text-teal-700 underline">
              المواعيد
            </a>
            <LogoutButton />
          </div>
        </header>
        <WaitlistBoard initialDate={today} />
      </div>
    </main>
  );
}
