-- CreateEnum
CREATE TYPE "meter_type" AS ENUM ('ELECTRICITY', 'GAS', 'COLD_WATER', 'HOT_WATER');

-- CreateEnum
CREATE TYPE "meter_unit" AS ENUM ('KWH', 'M3', 'L');

-- CreateEnum
CREATE TYPE "meter_status" AS ENUM ('ACTIVE', 'ARCHIVED');

-- CreateTable
CREATE TABLE "meters" (
    "id" UUID NOT NULL,
    "household_id" UUID NOT NULL,
    "type" "meter_type" NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "serial_number" VARCHAR(100) NOT NULL,
    "unit" "meter_unit" NOT NULL,
    "status" "meter_status" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "meters_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "meters_household_id_idx" ON "meters"("household_id");
