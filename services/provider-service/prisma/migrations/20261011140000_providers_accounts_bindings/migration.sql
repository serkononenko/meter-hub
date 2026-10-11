-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "providers" (
    "id" UUID NOT NULL,
    "household_id" UUID,
    "name" VARCHAR(200) NOT NULL,
    "notes" TEXT,
    "default_rule" JSONB,
    "archived_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID NOT NULL,
    "updated_by" UUID NOT NULL,

    CONSTRAINT "providers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "provider_accounts" (
    "id" UUID NOT NULL,
    "provider_id" UUID NOT NULL,
    "household_id" UUID NOT NULL,
    "label" VARCHAR(200) NOT NULL,
    "account_number" VARCHAR(100),
    "rule" JSONB NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "archived_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID NOT NULL,
    "updated_by" UUID NOT NULL,

    CONSTRAINT "provider_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meter_bindings" (
    "id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "household_id" UUID NOT NULL,
    "meter_id" UUID NOT NULL,
    "valid_from" DATE NOT NULL,
    "valid_to" DATE,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID NOT NULL,
    "updated_by" UUID NOT NULL,

    CONSTRAINT "meter_bindings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "providers_household_id_idx" ON "providers"("household_id");

-- CreateIndex
CREATE INDEX "provider_accounts_household_id_idx" ON "provider_accounts"("household_id");

-- CreateIndex
CREATE INDEX "provider_accounts_provider_id_idx" ON "provider_accounts"("provider_id");

-- CreateIndex
CREATE INDEX "meter_bindings_account_id_idx" ON "meter_bindings"("account_id");

-- CreateIndex
CREATE INDEX "meter_bindings_meter_id_valid_from_idx" ON "meter_bindings"("meter_id", "valid_from");

-- AddForeignKey
ALTER TABLE "provider_accounts" ADD CONSTRAINT "provider_accounts_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "providers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meter_bindings" ADD CONSTRAINT "meter_bindings_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "provider_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

