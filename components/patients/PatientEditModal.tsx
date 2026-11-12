"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import type { PatientDto } from "@/lib/services/patients";
import PatientForm from "@/components/patients/PatientForm";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";

// زر تحرير بيانات المريض في ملفه — يفتح نموذج التحرير في Modal ثم
// يعيد القراءة من الخادم (router.refresh) ليُحدَّث الملف بعد الحفظ.

export default function PatientEditModal({ patient }: { patient: PatientDto }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  function close() {
    setOpen(false);
  }

  function onSaved() {
    close();
    router.refresh();
  }

  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        <Pencil size={16} aria-hidden />
        تحرير البيانات
      </Button>
      <Modal open={open} onClose={close} title="تحرير مريض">
        <PatientForm editing={patient} onSaved={onSaved} onCancel={close} />
      </Modal>
    </>
  );
}
