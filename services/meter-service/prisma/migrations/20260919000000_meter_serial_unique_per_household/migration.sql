-- A manufacturer serial number identifies one physical meter, so a household
-- cannot register it twice. The reservation persists after ARCHIVED.
CREATE UNIQUE INDEX "meters_household_id_serial_number_key" ON "meters"("household_id", "serial_number");
