#!/usr/bin/env bash

set -e

echo "Creating MeterHub databases and users..."

psql \
  -v ON_ERROR_STOP=1 \
  -v identity_db="$IDENTITY_DB" \
  -v identity_user="$IDENTITY_DB_USER" \
  -v identity_password="$IDENTITY_DB_PASSWORD" \
  -v household_db="$HOUSEHOLD_DB" \
  -v household_user="$HOUSEHOLD_DB_USER" \
  -v household_password="$HOUSEHOLD_DB_PASSWORD" \
  -v meter_db="$METER_DB" \
  -v meter_user="$METER_DB_USER" \
  -v meter_password="$METER_DB_PASSWORD" \
  -v reading_db="$READING_DB" \
  -v reading_user="$READING_DB_USER" \
  -v reading_password="$READING_DB_PASSWORD" \
  --username "$POSTGRES_USER" \
  --dbname "$POSTGRES_DB" <<'EOSQL'

CREATE USER :"identity_user" WITH PASSWORD :'identity_password';
CREATE USER :"household_user" WITH PASSWORD :'household_password';
CREATE USER :"meter_user" WITH PASSWORD :'meter_password';
CREATE USER :"reading_user" WITH PASSWORD :'reading_password';

CREATE DATABASE :"identity_db" OWNER :"identity_user";
CREATE DATABASE :"household_db" OWNER :"household_user";
CREATE DATABASE :"meter_db" OWNER :"meter_user";
CREATE DATABASE :"reading_db" OWNER :"reading_user";

REVOKE CONNECT ON DATABASE :"identity_db" FROM PUBLIC;
REVOKE CONNECT ON DATABASE :"household_db" FROM PUBLIC;
REVOKE CONNECT ON DATABASE :"meter_db" FROM PUBLIC;
REVOKE CONNECT ON DATABASE :"reading_db" FROM PUBLIC;

GRANT CONNECT ON DATABASE :"identity_db" TO :"identity_user";
GRANT CONNECT ON DATABASE :"household_db" TO :"household_user";
GRANT CONNECT ON DATABASE :"meter_db" TO :"meter_user";
GRANT CONNECT ON DATABASE :"reading_db" TO :"reading_user";

EOSQL

echo "MeterHub databases created successfully."