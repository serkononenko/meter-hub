CREATE UNIQUE INDEX "meter_bindings_one_open_per_meter" ON "meter_bindings"("meter_id") WHERE "valid_to" IS NULL;
