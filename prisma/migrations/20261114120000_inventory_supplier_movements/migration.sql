-- AlterTable: حقول الفئة والمورد الاختيارية على المواد
ALTER TABLE "Material" ADD COLUMN "category" TEXT;
ALTER TABLE "Material" ADD COLUMN "supplier" TEXT;

-- CreateTable: دفتر حركات المخزون — إلحاقي لكل تغيّر كمية
CREATE TABLE "MaterialMovement" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,
    "quantityChange" DECIMAL(12,2) NOT NULL,
    "note" TEXT,
    "recordedById" TEXT NOT NULL,
    "movedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MaterialMovement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MaterialMovement_clinicId_movedAt_idx" ON "MaterialMovement"("clinicId", "movedAt" DESC);
CREATE INDEX "MaterialMovement_clinicId_materialId_movedAt_idx" ON "MaterialMovement"("clinicId", "materialId", "movedAt" DESC);

-- AddForeignKey
ALTER TABLE "MaterialMovement" ADD CONSTRAINT "MaterialMovement_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MaterialMovement" ADD CONSTRAINT "MaterialMovement_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material"("id") ON DELETE CASCADE ON UPDATE CASCADE;
