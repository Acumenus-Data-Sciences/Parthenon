\pset pager off
\echo 'Preparing additive FoundationOne genomics backfill objects'

CREATE SEQUENCE IF NOT EXISTS omop.derived_genomic_specimen_id_seq
    START WITH 900000001
    INCREMENT BY 1
    MINVALUE 1
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE omop.derived_genomic_specimen_id_seq
    INCREMENT BY 1
    MINVALUE 1
    NO MAXVALUE
    CACHE 1;

DO $$
DECLARE
    target_last_value bigint;
BEGIN
    SELECT greatest(
        900000000::bigint,
        coalesce(max(specimen_id)::bigint, 0)
    )
    INTO target_last_value
    FROM omop.specimen;

    IF target_last_value >= 2147483647 THEN
        RAISE EXCEPTION
            'Cannot seed derived genomic specimen sequence safely: current specimen_id max % exceeds integer headroom',
            target_last_value;
    END IF;

    PERFORM setval(
        'omop.derived_genomic_specimen_id_seq',
        target_last_value,
        true
    );
END
$$;

CREATE TABLE IF NOT EXISTS app.genomic_upload_omop_context_xref (
    upload_id bigint PRIMARY KEY,
    source_id bigint NOT NULL,
    person_id bigint,
    sample_id varchar(255),
    procedure_occurrence_id bigint,
    visit_occurrence_id bigint,
    care_site_id bigint,
    specimen_id bigint UNIQUE,
    genomic_test_id bigint UNIQUE,
    source_strategy varchar(50) NOT NULL,
    mapping_status varchar(30) NOT NULL DEFAULT 'planned',
    notes text,
    created_at timestamp NOT NULL DEFAULT now(),
    updated_at timestamp NOT NULL DEFAULT now()
);

COMMENT ON TABLE app.genomic_upload_omop_context_xref IS
    'Upload-level provenance table for safe OMOP genomics backfill context.';

\echo 'Validating that the local FoundationOne case can be anchored to OMOP context'

DO $$
DECLARE
    foundation_variant_count integer;
    foundation_procedure_count integer;
    foundation_care_site_count integer;
BEGIN
    SELECT count(*)
    INTO foundation_variant_count
    FROM app.genomic_variants v
    JOIN app.genomic_uploads u ON u.id = v.upload_id
    WHERE u.sample_id = 'TRF091836'
      AND u.file_format = 'foundation_one'
      AND v.person_id IS NOT NULL;

    IF foundation_variant_count <> 4 THEN
        RAISE EXCEPTION
            'Expected 4 person-linked FoundationOne variants for TRF091836, found %',
            foundation_variant_count;
    END IF;

    SELECT count(*)
    INTO foundation_procedure_count
    FROM omop.procedure_occurrence p
    WHERE p.person_id = 1005788
      AND p.procedure_date = DATE '2012-03-06'
      AND p.procedure_source_value ILIKE 'Sigmoid colectomy%';

    IF foundation_procedure_count <> 1 THEN
        RAISE EXCEPTION
            'Expected exactly one sigmoid colectomy procedure anchor for FoundationOne specimen date, found %',
            foundation_procedure_count;
    END IF;

    SELECT count(*)
    INTO foundation_care_site_count
    FROM omop.care_site c
    WHERE c.care_site_name = 'HOSPITAL OF UNIV OF PENNSYLVANIA';

    IF foundation_care_site_count < 1 THEN
        RAISE EXCEPTION
            'Expected at least one care_site match for HOSPITAL OF UNIV OF PENNSYLVANIA, found %',
            foundation_care_site_count;
    END IF;
END
$$;

\echo 'Recording benchmark uploads as intentionally excluded from OMOP genomics backfill'

INSERT INTO app.omop_genomic_test_map (
    upload_id,
    mapping_status,
    notes
)
SELECT
    u.id,
    'excluded_benchmark',
    'GIAB benchmark upload has no person linkage and remains app-layer staging only'
FROM app.genomic_uploads u
WHERE u.file_format = 'vcf'
  AND NOT EXISTS (
      SELECT 1
      FROM app.genomic_variants v
      WHERE v.upload_id = u.id
        AND v.person_id IS NOT NULL
  )
ON CONFLICT (upload_id) DO UPDATE
SET mapping_status = EXCLUDED.mapping_status,
    notes = EXCLUDED.notes,
    updated_at = now();

\echo 'Seeding FoundationOne gene symbol map from official HGNC identifiers'

INSERT INTO app.omop_gene_symbol_map (gene_symbol, hgnc_id, hgnc_symbol, notes)
VALUES
    ('KRAS', 'HGNC:6407', 'KRAS', 'Verified against HGNC REST API on 2026-04-10'),
    ('TP53', 'HGNC:11998', 'TP53', 'Verified against HGNC REST API on 2026-04-10'),
    ('APC', 'HGNC:583', 'APC', 'Verified against HGNC REST API on 2026-04-10'),
    ('SETD2', 'HGNC:18420', 'SETD2', 'Verified against HGNC REST API on 2026-04-10')
ON CONFLICT (gene_symbol) DO UPDATE
SET hgnc_id = EXCLUDED.hgnc_id,
    hgnc_symbol = EXCLUDED.hgnc_symbol,
    notes = EXCLUDED.notes;

\echo 'Resolving upload-level FoundationOne OMOP context'

WITH foundation_context AS (
    SELECT
        u.id AS upload_id,
        u.source_id,
        u.sample_id,
        min(v.person_id) AS person_id,
        min((v.raw_info ->> 'specimen_date')::date) AS specimen_date,
        min(v.raw_info ->> 'report_date') AS report_date,
        min(v.raw_info ->> 'tumor_type') AS tumor_type,
        p.procedure_occurrence_id,
        p.visit_occurrence_id,
        (
            SELECT min(c.care_site_id)
            FROM omop.care_site c
            WHERE c.care_site_name = 'HOSPITAL OF UNIV OF PENNSYLVANIA'
        ) AS care_site_id
    FROM app.genomic_uploads u
    JOIN app.genomic_variants v ON v.upload_id = u.id
    JOIN omop.procedure_occurrence p
      ON p.person_id = v.person_id
     AND p.procedure_date = DATE '2012-03-06'
     AND p.procedure_source_value ILIKE 'Sigmoid colectomy%'
    WHERE u.sample_id = 'TRF091836'
      AND u.file_format = 'foundation_one'
      AND v.person_id IS NOT NULL
    GROUP BY
        u.id,
        u.source_id,
        u.sample_id,
        p.procedure_occurrence_id,
        p.visit_occurrence_id
)
INSERT INTO app.genomic_upload_omop_context_xref (
    upload_id,
    source_id,
    person_id,
    sample_id,
    procedure_occurrence_id,
    visit_occurrence_id,
    care_site_id,
    source_strategy,
    mapping_status,
    notes
)
SELECT
    upload_id,
    source_id,
    person_id,
    sample_id,
    procedure_occurrence_id,
    visit_occurrence_id,
    care_site_id,
    'foundationone_report_derived',
    'matched',
    'Specimen date 2012-03-06 matched to same-day sigmoid colectomy; care_site reflects UPenn specimen collection site'
FROM foundation_context
ON CONFLICT (upload_id) DO UPDATE
SET source_id = EXCLUDED.source_id,
    person_id = EXCLUDED.person_id,
    sample_id = EXCLUDED.sample_id,
    procedure_occurrence_id = EXCLUDED.procedure_occurrence_id,
    visit_occurrence_id = EXCLUDED.visit_occurrence_id,
    care_site_id = EXCLUDED.care_site_id,
    source_strategy = EXCLUDED.source_strategy,
    mapping_status = EXCLUDED.mapping_status,
    notes = EXCLUDED.notes,
    updated_at = now();

\echo 'Recording curated genomic_test metadata for the FoundationOne upload'

INSERT INTO app.omop_genomic_test_map (
    upload_id,
    care_site_id,
    genomic_test_name,
    genomic_test_version,
    reference_genome,
    sequencing_device,
    library_preparation,
    target_capture,
    read_type,
    read_length,
    quality_control_tools,
    total_reads,
    mean_target_coverage,
    per_target_base_cover_100x,
    alignment_tools,
    variant_calling_tools,
    chromosome_corrdinate,
    annotation_tools,
    annotation_databases,
    mapping_status,
    notes
)
SELECT
    x.upload_id,
    x.care_site_id,
    'FoundationOne (report-derived)',
    NULL,
    u.genome_build,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    'manual report extraction',
    'ClinVar;COSMIC',
    'matched',
    'Single person-linked FoundationOne upload; panel manifest unavailable, so omop.target_gene remains intentionally unpopulated'
FROM app.genomic_upload_omop_context_xref x
JOIN app.genomic_uploads u ON u.id = x.upload_id
WHERE x.upload_id = 10
ON CONFLICT (upload_id) DO UPDATE
SET care_site_id = EXCLUDED.care_site_id,
    genomic_test_name = EXCLUDED.genomic_test_name,
    genomic_test_version = EXCLUDED.genomic_test_version,
    reference_genome = EXCLUDED.reference_genome,
    sequencing_device = EXCLUDED.sequencing_device,
    library_preparation = EXCLUDED.library_preparation,
    target_capture = EXCLUDED.target_capture,
    read_type = EXCLUDED.read_type,
    read_length = EXCLUDED.read_length,
    quality_control_tools = EXCLUDED.quality_control_tools,
    total_reads = EXCLUDED.total_reads,
    mean_target_coverage = EXCLUDED.mean_target_coverage,
    per_target_base_cover_100x = EXCLUDED.per_target_base_cover_100x,
    alignment_tools = EXCLUDED.alignment_tools,
    variant_calling_tools = EXCLUDED.variant_calling_tools,
    chromosome_corrdinate = EXCLUDED.chromosome_corrdinate,
    annotation_tools = EXCLUDED.annotation_tools,
    annotation_databases = EXCLUDED.annotation_databases,
    mapping_status = EXCLUDED.mapping_status,
    notes = EXCLUDED.notes,
    updated_at = now();

\echo 'Creating a derived OMOP specimen for the FoundationOne upload if needed'

WITH to_create AS (
    SELECT
        x.upload_id,
        x.person_id,
        x.sample_id,
        x.procedure_occurrence_id,
        x.visit_occurrence_id,
        DATE '2012-03-06' AS specimen_date
    FROM app.genomic_upload_omop_context_xref x
    WHERE x.upload_id = 10
      AND x.specimen_id IS NULL
), inserted AS (
    INSERT INTO omop.specimen (
        specimen_id,
        person_id,
        specimen_concept_id,
        specimen_type_concept_id,
        specimen_date,
        specimen_datetime,
        quantity,
        unit_concept_id,
        anatomic_site_concept_id,
        disease_status_concept_id,
        specimen_source_id,
        specimen_source_value,
        unit_source_value,
        anatomic_site_source_value,
        disease_status_source_value
    )
    SELECT
        nextval('omop.derived_genomic_specimen_id_seq')::integer,
        c.person_id::integer,
        4046382,
        32835,
        c.specimen_date,
        NULL,
        NULL,
        0,
        4244588,
        443381,
        c.upload_id::text,
        left('FoundationOne sample ' || c.sample_id, 50),
        NULL,
        'sigmoid colon',
        'Colon adenocarcinoma (CRC)'
    FROM to_create c
    RETURNING specimen_id, specimen_source_id
)
UPDATE app.genomic_upload_omop_context_xref x
SET specimen_id = i.specimen_id,
    updated_at = now()
FROM inserted i
WHERE x.upload_id::text = i.specimen_source_id;

\echo 'Backfilling upload context specimen_id from any pre-existing OMOP specimen rows'

UPDATE app.genomic_upload_omop_context_xref x
SET specimen_id = s.specimen_id,
    updated_at = now()
FROM omop.specimen s
WHERE x.upload_id = 10
  AND x.specimen_id IS NULL
  AND s.specimen_source_id = x.upload_id::text;

\echo 'Creating an OMOP genomic_test row for the FoundationOne upload if needed'

WITH to_create AS (
    SELECT
        m.upload_id,
        m.care_site_id,
        m.genomic_test_name,
        m.genomic_test_version,
        m.reference_genome,
        m.sequencing_device,
        m.library_preparation,
        m.target_capture,
        m.read_type,
        m.read_length,
        m.quality_control_tools,
        m.total_reads,
        m.mean_target_coverage,
        m.per_target_base_cover_100x,
        m.alignment_tools,
        m.variant_calling_tools,
        m.chromosome_corrdinate,
        m.annotation_tools,
        m.annotation_databases
    FROM app.omop_genomic_test_map m
    WHERE m.upload_id = 10
      AND m.genomic_test_id IS NULL
      AND m.care_site_id IS NOT NULL
), inserted AS (
    INSERT INTO omop.genomic_test (
        care_site_id,
        genomic_test_name,
        genomic_test_version,
        reference_genome,
        sequencing_device,
        library_preparation,
        target_capture,
        read_type,
        read_length,
        quality_control_tools,
        total_reads,
        mean_target_coverage,
        per_target_base_cover_100x,
        alignment_tools,
        variant_calling_tools,
        chromosome_corrdinate,
        annotation_tools,
        annotation_databases
    )
    SELECT
        care_site_id,
        genomic_test_name,
        genomic_test_version,
        reference_genome,
        sequencing_device,
        library_preparation,
        target_capture,
        read_type,
        read_length,
        quality_control_tools,
        total_reads,
        mean_target_coverage,
        per_target_base_cover_100x,
        alignment_tools,
        variant_calling_tools,
        chromosome_corrdinate,
        annotation_tools,
        annotation_databases
    FROM to_create
    RETURNING genomic_test_id, care_site_id, genomic_test_name, reference_genome
)
UPDATE app.omop_genomic_test_map m
SET genomic_test_id = i.genomic_test_id,
    updated_at = now()
FROM inserted i
WHERE m.upload_id = 10
  AND m.care_site_id = i.care_site_id
  AND m.genomic_test_name = i.genomic_test_name
  AND m.reference_genome IS NOT DISTINCT FROM i.reference_genome;

UPDATE app.genomic_upload_omop_context_xref x
SET genomic_test_id = m.genomic_test_id,
    updated_at = now()
FROM app.omop_genomic_test_map m
WHERE x.upload_id = m.upload_id
  AND x.upload_id = 10
  AND m.genomic_test_id IS NOT NULL
  AND x.genomic_test_id IS DISTINCT FROM m.genomic_test_id;

\echo 'Preparing variant-level xref rows for the FoundationOne variants'

INSERT INTO app.genomic_variant_omop_xref (variant_id)
SELECT v.id
FROM app.genomic_variants v
WHERE v.upload_id = 10
  AND v.person_id IS NOT NULL
  AND NOT EXISTS (
      SELECT 1
      FROM app.genomic_variant_omop_xref x
      WHERE x.variant_id = v.id
  );

WITH variant_context AS (
    SELECT
        v.id AS variant_id,
        x.procedure_occurrence_id,
        x.specimen_id,
        g.hgnc_id,
        g.hgnc_symbol
    FROM app.genomic_variants v
    JOIN app.genomic_upload_omop_context_xref x ON x.upload_id = v.upload_id
    LEFT JOIN app.omop_gene_symbol_map g ON g.gene_symbol = v.gene_symbol
    WHERE v.upload_id = 10
      AND v.person_id IS NOT NULL
)
UPDATE app.genomic_variant_omop_xref x
SET procedure_occurrence_id = c.procedure_occurrence_id,
    specimen_id = c.specimen_id,
    reference_specimen_id = NULL,
    target_gene1_id = c.hgnc_id,
    target_gene1_symbol = c.hgnc_symbol,
    target_gene2_id = NULL,
    target_gene2_symbol = NULL,
    mapping_status = 'matched',
    notes = 'FoundationOne report-derived variant linked to same-day colectomy specimen',
    updated_at = now()
FROM variant_context c
WHERE x.variant_id = c.variant_id;

\echo 'Materializing OMOP variant_occurrence rows for the FoundationOne variants'

WITH to_create AS (
    SELECT
        v.id AS variant_id,
        x.procedure_occurrence_id,
        x.specimen_id,
        x.reference_specimen_id,
        x.target_gene1_id,
        x.target_gene1_symbol,
        x.target_gene2_id,
        x.target_gene2_symbol,
        v.reference_allele,
        v.alternate_allele,
        v.hgvs_c,
        v.hgvs_p,
        v.read_depth,
        CASE
            WHEN upper(v.variant_type) = 'SV' THEN v.measurement_source_value
            ELSE NULL
        END AS sequence_alteration,
        COALESCE(v.variant_class, v.consequence) AS variant_feature,
        'somatic' AS genetic_origin,
        v.zygosity AS genotype
    FROM app.genomic_variants v
    JOIN app.genomic_variant_omop_xref x ON x.variant_id = v.id
    WHERE v.upload_id = 10
      AND v.person_id IS NOT NULL
      AND x.variant_occurrence_id IS NULL
      AND x.procedure_occurrence_id IS NOT NULL
      AND x.specimen_id IS NOT NULL
), inserted AS (
    INSERT INTO omop.variant_occurrence (
        procedure_occurrence_id,
        specimen_id,
        reference_specimen_id,
        target_gene1_id,
        target_gene1_symbol,
        target_gene2_id,
        target_gene2_symbol,
        reference_sequence,
        rs_id,
        reference_allele,
        alternate_allele,
        hgvs_c,
        hgvs_p,
        variant_read_depth,
        sequence_alteration,
        variant_feature,
        genetic_origin,
        genotype
    )
    SELECT
        procedure_occurrence_id,
        specimen_id,
        reference_specimen_id,
        target_gene1_id,
        target_gene1_symbol,
        target_gene2_id,
        target_gene2_symbol,
        NULL,
        NULL,
        reference_allele,
        alternate_allele,
        hgvs_c,
        hgvs_p,
        read_depth,
        sequence_alteration,
        variant_feature,
        genetic_origin,
        genotype
    FROM to_create
    RETURNING
        variant_occurrence_id,
        procedure_occurrence_id,
        specimen_id,
        target_gene1_id,
        target_gene1_symbol,
        reference_allele,
        alternate_allele,
        hgvs_c,
        hgvs_p,
        sequence_alteration,
        variant_feature,
        genotype
)
UPDATE app.genomic_variant_omop_xref x
SET variant_occurrence_id = i.variant_occurrence_id,
    updated_at = now()
FROM inserted i,
     app.genomic_variants v
WHERE x.variant_occurrence_id IS NULL
  AND x.variant_id = v.id
  AND v.upload_id = 10
  AND x.procedure_occurrence_id = i.procedure_occurrence_id
  AND x.specimen_id = i.specimen_id
  AND coalesce(x.target_gene1_id, '') = coalesce(i.target_gene1_id, '')
  AND coalesce(x.target_gene1_symbol, '') = coalesce(i.target_gene1_symbol, '')
  AND coalesce(v.reference_allele, '') = coalesce(i.reference_allele, '')
  AND coalesce(v.alternate_allele, '') = coalesce(i.alternate_allele, '')
  AND coalesce(v.hgvs_c, '') = coalesce(i.hgvs_c, '')
  AND coalesce(v.hgvs_p, '') = coalesce(i.hgvs_p, '')
  AND coalesce(CASE WHEN upper(v.variant_type) = 'SV' THEN v.measurement_source_value ELSE NULL END, '') = coalesce(i.sequence_alteration, '')
  AND coalesce(COALESCE(v.variant_class, v.consequence), '') = coalesce(i.variant_feature, '')
  AND coalesce(v.zygosity, '') = coalesce(i.genotype, '');

\echo 'Backfilling variant_occurrence_id from any pre-existing OMOP rows'

UPDATE app.genomic_variant_omop_xref x
SET variant_occurrence_id = vo.variant_occurrence_id,
    updated_at = now()
FROM app.genomic_variants v,
     omop.variant_occurrence vo
WHERE x.variant_id = v.id
  AND v.upload_id = 10
  AND x.variant_occurrence_id IS NULL
  AND vo.procedure_occurrence_id = x.procedure_occurrence_id
  AND vo.specimen_id = x.specimen_id
  AND coalesce(vo.target_gene1_id, '') = coalesce(x.target_gene1_id, '')
  AND coalesce(vo.target_gene1_symbol, '') = coalesce(x.target_gene1_symbol, '')
  AND coalesce(vo.reference_allele, '') = coalesce(v.reference_allele, '')
  AND coalesce(vo.alternate_allele, '') = coalesce(v.alternate_allele, '')
  AND coalesce(vo.hgvs_c, '') = coalesce(v.hgvs_c, '')
  AND coalesce(vo.hgvs_p, '') = coalesce(v.hgvs_p, '');

\echo 'Adding clinically useful OMOP variant_annotation rows for the FoundationOne variants'

WITH annotation_source AS (
    SELECT
        x.variant_occurrence_id,
        'report'::text AS annotation_field,
        v.raw_info ->> 'report' AS value_as_string,
        NULL::double precision AS value_as_number
    FROM app.genomic_variants v
    JOIN app.genomic_variant_omop_xref x ON x.variant_id = v.id
    WHERE v.upload_id = 10
      AND x.variant_occurrence_id IS NOT NULL
      AND v.raw_info ? 'report'

    UNION ALL

    SELECT
        x.variant_occurrence_id,
        'fmi_case',
        v.raw_info ->> 'fmi_case',
        NULL::double precision
    FROM app.genomic_variants v
    JOIN app.genomic_variant_omop_xref x ON x.variant_id = v.id
    WHERE v.upload_id = 10
      AND x.variant_occurrence_id IS NOT NULL
      AND v.raw_info ? 'fmi_case'

    UNION ALL

    SELECT
        x.variant_occurrence_id,
        'report_date',
        v.raw_info ->> 'report_date',
        NULL::double precision
    FROM app.genomic_variants v
    JOIN app.genomic_variant_omop_xref x ON x.variant_id = v.id
    WHERE v.upload_id = 10
      AND x.variant_occurrence_id IS NOT NULL
      AND v.raw_info ? 'report_date'

    UNION ALL

    SELECT
        x.variant_occurrence_id,
        'tumor_type',
        v.raw_info ->> 'tumor_type',
        NULL::double precision
    FROM app.genomic_variants v
    JOIN app.genomic_variant_omop_xref x ON x.variant_id = v.id
    WHERE v.upload_id = 10
      AND x.variant_occurrence_id IS NOT NULL
      AND v.raw_info ? 'tumor_type'

    UNION ALL

    SELECT
        x.variant_occurrence_id,
        'specimen_date',
        v.raw_info ->> 'specimen_date',
        NULL::double precision
    FROM app.genomic_variants v
    JOIN app.genomic_variant_omop_xref x ON x.variant_id = v.id
    WHERE v.upload_id = 10
      AND x.variant_occurrence_id IS NOT NULL
      AND v.raw_info ? 'specimen_date'

    UNION ALL

    SELECT
        x.variant_occurrence_id,
        'clinvar_id',
        v.clinvar_id,
        NULL::double precision
    FROM app.genomic_variants v
    JOIN app.genomic_variant_omop_xref x ON x.variant_id = v.id
    WHERE v.upload_id = 10
      AND x.variant_occurrence_id IS NOT NULL
      AND v.clinvar_id IS NOT NULL

    UNION ALL

    SELECT
        x.variant_occurrence_id,
        'clinvar_significance',
        v.clinvar_significance,
        NULL::double precision
    FROM app.genomic_variants v
    JOIN app.genomic_variant_omop_xref x ON x.variant_id = v.id
    WHERE v.upload_id = 10
      AND x.variant_occurrence_id IS NOT NULL
      AND v.clinvar_significance IS NOT NULL

    UNION ALL

    SELECT
        x.variant_occurrence_id,
        'cosmic_id',
        v.cosmic_id,
        NULL::double precision
    FROM app.genomic_variants v
    JOIN app.genomic_variant_omop_xref x ON x.variant_id = v.id
    WHERE v.upload_id = 10
      AND x.variant_occurrence_id IS NOT NULL
      AND v.cosmic_id IS NOT NULL

    UNION ALL

    SELECT
        x.variant_occurrence_id,
        'consequence',
        v.consequence,
        NULL::double precision
    FROM app.genomic_variants v
    JOIN app.genomic_variant_omop_xref x ON x.variant_id = v.id
    WHERE v.upload_id = 10
      AND x.variant_occurrence_id IS NOT NULL
      AND v.consequence IS NOT NULL

    UNION ALL

    SELECT
        x.variant_occurrence_id,
        'variant_class',
        v.variant_class,
        NULL::double precision
    FROM app.genomic_variants v
    JOIN app.genomic_variant_omop_xref x ON x.variant_id = v.id
    WHERE v.upload_id = 10
      AND x.variant_occurrence_id IS NOT NULL
      AND v.variant_class IS NOT NULL

    UNION ALL

    SELECT
        x.variant_occurrence_id,
        'therapeutic_implications_resistance',
        v.raw_info #>> '{therapeutic_implications,resistance}',
        NULL::double precision
    FROM app.genomic_variants v
    JOIN app.genomic_variant_omop_xref x ON x.variant_id = v.id
    WHERE v.upload_id = 10
      AND x.variant_occurrence_id IS NOT NULL
      AND v.raw_info #>> '{therapeutic_implications,resistance}' IS NOT NULL

    UNION ALL

    SELECT
        x.variant_occurrence_id,
        'therapeutic_implications_potential_benefit',
        v.raw_info #>> '{therapeutic_implications,potential_benefit}',
        NULL::double precision
    FROM app.genomic_variants v
    JOIN app.genomic_variant_omop_xref x ON x.variant_id = v.id
    WHERE v.upload_id = 10
      AND x.variant_occurrence_id IS NOT NULL
      AND v.raw_info #>> '{therapeutic_implications,potential_benefit}' IS NOT NULL
)
INSERT INTO omop.variant_annotation (
    variant_occurrence_id,
    anntation_field,
    value_as_string,
    value_as_number
)
SELECT
    variant_occurrence_id,
    annotation_field,
    value_as_string,
    value_as_number
FROM annotation_source a
WHERE NOT EXISTS (
    SELECT 1
    FROM omop.variant_annotation va
    WHERE va.variant_occurrence_id = a.variant_occurrence_id
      AND va.anntation_field = a.annotation_field
      AND va.value_as_string IS NOT DISTINCT FROM a.value_as_string
      AND va.value_as_number IS NOT DISTINCT FROM a.value_as_number
);
