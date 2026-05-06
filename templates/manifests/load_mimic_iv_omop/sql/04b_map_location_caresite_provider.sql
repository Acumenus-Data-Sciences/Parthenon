-- Phase 2 Plan 4 Task 6: synthesize a single LOCATION + CARE_SITE + PROVIDER row
-- representing "MIMIC-IV BIDMC ICU/ED" so downstream FK columns resolve.
-- MIMIC-IV has limited location info; this is sufficient for trial-grade
-- visit-spine integrity.

INSERT INTO ${parameters.target_schema}.location (
    location_id, address_1, city, state, zip, location_source_value
) VALUES (
    1, '330 Brookline Ave', 'Boston', 'MA', '02215', 'MIMIC-IV BIDMC'
) ON CONFLICT (location_id) DO NOTHING;

INSERT INTO ${parameters.target_schema}.care_site (
    care_site_id, care_site_name, place_of_service_concept_id, location_id, care_site_source_value
) VALUES (
    1, 'MIMIC-IV BIDMC ICU/ED', 8717, 1, 'MIMIC-IV-BIDMC'
) ON CONFLICT (care_site_id) DO NOTHING;

INSERT INTO ${parameters.target_schema}.provider (
    provider_id, provider_name, care_site_id, provider_source_value
) VALUES (
    1, 'Unknown MIMIC-IV provider', 1, 'MIMIC-IV-UNKNOWN'
) ON CONFLICT (provider_id) DO NOTHING;
