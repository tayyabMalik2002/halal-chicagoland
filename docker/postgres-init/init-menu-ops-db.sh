#!/bin/bash
# Runs once, on first container start, after the default $POSTGRES_DB
# (restaurants_db, used by the Flask app) already exists. Creates the
# second database used by the Express app and loads its schema + seed data.
set -e

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" <<-EOSQL
    CREATE DATABASE menu_ops_db;
EOSQL

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" -d menu_ops_db -f /docker-entrypoint-initdb.d/sql/database/schema.sql
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" -d menu_ops_db -f /docker-entrypoint-initdb.d/sql/database/seed.sql
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" -d menu_ops_db -f /docker-entrypoint-initdb.d/sql/menu-analyzer/seed_menu_analyzer.sql
