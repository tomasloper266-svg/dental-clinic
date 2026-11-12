import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, getSessionUser } from "@/lib/auth/session";
import PatientsView from "@/components/patients/PatientsView";

// شاشة المرضى محمية — الجلسة من الكوكي، والبيانات من API العيادة حصراً.
export default async function PatientsPage() {
  const session = await getSessionUser(
    (await cookies()).get(SESSION_COOKIE)?.value,
  );
  if (!session) redirect("/login");

  return (
    <main className="min-h-screen bg-neutral-50">
      <PatientsView />
    </main>
  );
}
