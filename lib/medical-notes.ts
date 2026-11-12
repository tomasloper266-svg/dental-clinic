// الملاحظات الطبية تُخزَّن نصاً واحداً (Patient.medicalNotes) لكن النموذج
// يدخلها ثلاثة حقول: حساسية/أمراض/أدوية. الدوال هنا نقية وتضمن ذهاباً
// وإياباً بلا فقد: الأسطر غير المعلّمة تُحفظ كما هي وتُعاد عند التركيب.

export type MedicalNotes = {
  allergies: string;
  conditions: string;
  medications: string;
  // أسطر حرمة دخلها الطبيب يدوياً خارج الأقسام الثلاثة — لا تُهمل أبداً.
  other: string;
};

const ALLERGIES_LABEL = "حساسية:";
const CONDITIONS_LABEL = "أمراض:";
const MEDICATIONS_LABEL = "أدوية:";

export function composeMedicalNotes(notes: MedicalNotes): string {
  const sections: string[] = [];
  if (notes.allergies.trim()) {
    sections.push(`${ALLERGIES_LABEL} ${notes.allergies.trim()}`);
  }
  if (notes.conditions.trim()) {
    sections.push(`${CONDITIONS_LABEL} ${notes.conditions.trim()}`);
  }
  if (notes.medications.trim()) {
    sections.push(`${MEDICATIONS_LABEL} ${notes.medications.trim()}`);
  }
  if (notes.other.trim()) {
    sections.push(notes.other.trim());
  }
  return sections.join("\n");
}

export function parseMedicalNotes(raw: string | null | undefined): MedicalNotes {
  const notes: MedicalNotes = {
    allergies: "",
    conditions: "",
    medications: "",
    other: "",
  };
  if (!raw) return notes;

  const otherLines: string[] = [];
  let current: "allergies" | "conditions" | "medications" | null = null;

  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith(ALLERGIES_LABEL)) {
      current = "allergies";
      notes.allergies = trimmed.slice(ALLERGIES_LABEL.length).trim();
    } else if (trimmed.startsWith(CONDITIONS_LABEL)) {
      current = "conditions";
      notes.conditions = trimmed.slice(CONDITIONS_LABEL.length).trim();
    } else if (trimmed.startsWith(MEDICATIONS_LABEL)) {
      current = "medications";
      notes.medications = trimmed.slice(MEDICATIONS_LABEL.length).trim();
    } else if (current) {
      // سطر تتمة للقسم الحالي — يحفظ قيمة متعددة الأسطر كما دخلت.
      notes[current] = `${notes[current]}\n${trimmed}`.trim();
    } else {
      otherLines.push(trimmed);
    }
  }
  notes.other = otherLines.join("\n");
  return notes;
}
