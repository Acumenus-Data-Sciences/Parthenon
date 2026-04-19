# Rust Installer v2 Bootstrapper TODO

**Date:** 2026-04-18
**Goal:** Turn the Rust/Tauri installer into a full Parthenon Community
bootstrapper that can stand up services, connect to or prepare an OMOP CDM
target, and guide vocabulary loading without requiring a repo checkout.

## Product Principle

- [x] Treat "I have a database server" and "I have an OMOP CDM" as separate
      states.
- [x] Offer local PostgreSQL as the default alternative when the user does not
      have a target database server.
- [ ] Stop requiring users to clone the full Parthenon repository before
      installing.
- [x] Define the first versioned installer bundle manifest with checksums,
      phases, and DBMS support tiers.
- [x] Build and validate a source-backed installer bundle artifact in CI from
      the manifest.
- [x] Download a versioned installer bundle containing only required compose
      files, templates, helper scripts, and manifests.
- [x] Verify downloaded installer bundle checksums before running any phase.
- [ ] Keep technical JSON and internal config files behind advanced details.

## Data Setup Paths

- [x] Add installer model fields for the three database paths:
      existing database server, existing OMOP CDM, and local PostgreSQL.
- [x] Add a user-facing setup plan that distinguishes database server,
      OMOP DDL, vocabulary, and clinical/source data state.
- [ ] Connect to existing database servers through a HADES/DatabaseConnector
      helper container.
- [ ] Validate existing OMOP CDM schemas, vocabulary tables, permissions, and
      temp/results schema availability.
- [ ] Create missing OMOP schemas and CDM DDL where the target DBMS supports it.
- [ ] Load an Athena vocabulary ZIP supplied by the user.
- [ ] Guide restricted vocabulary acquisition without pretending protected
      content can be silently downloaded.
- [ ] Provision local PostgreSQL, create OMOP schemas, install CDM DDL, and
      load vocabulary/demo data.

## Supported DBMS Tiers

- [ ] First-class test path: PostgreSQL.
- [x] Add shared non-destructive data readiness checks for local PostgreSQL and
      existing PostgreSQL targets.
- [ ] Add connection probes for SQL Server, Oracle, Redshift, Snowflake,
      BigQuery, Spark, Synapse, IRIS, DuckDB, and SQLite.
- [ ] Mark deprecated HADES platforms as advanced only: Hive, Impala, Netezza,
      and PDW.
- [ ] Document JDBC/driver licensing constraints per platform.

## Installer Engine

- [x] Define `installer_manifest.json` for version, files, checksums, service
      plan, DBMS support, phase definitions, and health checks.
- [ ] Add Rust phase state: preflight, download, verify, configure,
      prepare-data-target, start-services, health-check, finalize.
- [x] Add Rust install-source mode for existing checkout versus verified
      installer bundle.
- [x] Show the manifest-backed installer bundle readiness check in the Rust
      system check without exposing JSON.
- [ ] Add resume/rollback for each phase.
- [ ] Store secrets in the OS keychain where available.
- [ ] Export a diagnostics bundle on failure.

## Wizard UX

- [x] Ask where Parthenon should create or use the OMOP CDM.
- [x] Ask what already exists: empty database, schemas only, tables without
      vocabulary, vocabulary without clinical data, or complete CDM.
- [x] Ask how vocabulary will be handled: existing, Athena ZIP, later, or demo.
- [x] Add first-pass readiness checks for existing database server / existing
      CDM paths through the shared contract.
- [ ] Add HADES helper-backed connection testing for all supported DBMSs.
- [ ] Add file picker for Athena vocabulary ZIP.
- [ ] Add local PostgreSQL provisioning confirmation and disk/resource checks.
- [ ] Show only plain-language plan summaries by default.

## Release Gates

- [ ] macOS signed/notarized installer launches and completes local Postgres
      setup.
- [ ] Windows signed installer launches and completes WSL-backed local Postgres
      setup.
- [ ] Linux AppImage/deb/rpm launches and completes local Postgres setup.
- [ ] Existing PostgreSQL CDM connection validation works without repo checkout.
- [ ] Existing cloud database server setup can create schemas and report missing
      vocabulary cleanly.
