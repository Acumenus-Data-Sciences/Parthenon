-- Phase 3 Plan 5 (T-023): no-op placeholder for the load stage.
--
-- The community-tier ``Hl7v2OruReader`` (Python) parses ORU bytes and
-- bulk-inserts into ``fmt_oru_message`` + ``fmt_oru_observation`` directly,
-- so the manifest's load stage is a SQL ``SELECT 1`` — it exists so the
-- DAG ordering (``bootstrap -> load -> map_measurement -> queue_unmapped``)
-- is preserved and so post-condition validators have a stable node id to
-- assert ``fmt_oru_*`` row counts after.

SELECT 1 AS lis_lab_load_complete;
