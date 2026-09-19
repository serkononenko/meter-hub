-- A meter reading recorded under a meter. meter_id is a plain UUID reference
-- (the meter lives in Meter Service's database; no cross-service DB access).
CREATE TYPE "reading_source" AS ENUM ('MANUAL');

-- CreateTable
CREATE TABLE "readings" (
    "id" UUID NOT NULL,
    "meter_id" UUID NOT NULL,
    "value" DECIMAL(20,6) NOT NULL,
    "recorded_at" TIMESTAMPTZ(6) NOT NULL,
    "source" "reading_source" NOT NULL DEFAULT 'MANUAL',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "readings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "readings_meter_id_recorded_at_idx" ON "readings"("meter_id", "recorded_at");
