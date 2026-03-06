#!/usr/bin/env python3
"""
Fast VCF importer using PostgreSQL COPY for bulk loading.
Converts VCF lines to TSV and pipes into COPY FROM STDIN.
"""

import sys
import os
import re
import glob
import argparse
import psycopg2

COLUMNS = [
    'upload_id', 'source_id', 'person_id', 'sample_id',
    'chromosome', 'position', 'reference_allele', 'alternate_allele',
    'genome_build', 'gene_symbol', 'hgvs_c', 'hgvs_p',
    'variant_type', 'variant_class', 'consequence',
    'quality', 'filter_status', 'zygosity',
    'allele_frequency', 'read_depth',
    'clinvar_id', 'clinvar_significance', 'clinvar_disease', 'clinvar_review_status',
    'cosmic_id', 'tmb_contribution', 'is_msi_marker',
    'measurement_concept_id', 'measurement_source_value',
    'value_as_concept_id', 'mapping_status', 'omop_measurement_id',
    'raw_info', 'created_at', 'updated_at',
]


def infer_variant_type(ref, alt):
    if len(ref) == len(alt):
        return 'SNP' if len(ref) == 1 else 'MNP'
    return 'INS' if len(ref) < len(alt) else 'DEL'


def parse_genotype(fmt, smp):
    if not fmt or not smp:
        return None, None, None
    ff = fmt.split(':')
    sf = smp.split(':')
    if len(ff) != len(sf):
        return None, None, None
    data = dict(zip(ff, sf))

    zyg = None
    gt = data.get('GT', '')
    if gt:
        alleles = [a for a in re.split(r'[/|]', gt) if a != '.']
        if alleles:
            zyg = 'homozygous' if len(set(alleles)) == 1 else 'heterozygous'

    af = None
    if 'AF' in data:
        try: af = float(data['AF'])
        except: pass
    elif 'AD' in data:
        try:
            ads = list(map(int, data['AD'].split(',')))
            t = sum(ads)
            if t > 0 and len(ads) >= 2:
                af = round(ads[1] / t, 6)
        except: pass

    dp = None
    if 'DP' in data:
        try: dp = int(data['DP'])
        except: pass

    return zyg, af, dp


def parse_vcf_line(line, sample_id, upload_id, source_id, genome_build, now):
    fields = line.rstrip('\r\n').split('\t')
    if len(fields) < 5:
        return None

    chrom, pos, _, ref, alt = fields[:5]
    qual = fields[5] if len(fields) > 5 and fields[5] != '.' else None
    filt = fields[6] if len(fields) > 6 else None
    info_str = fields[7] if len(fields) > 7 else ''
    fmt = fields[8] if len(fields) > 8 else ''
    smp = fields[9] if len(fields) > 9 else ''

    chrom = chrom.lstrip('chr')
    zyg, af, dp = parse_genotype(fmt, smp)

    # Parse INFO for AF if not in genotype
    if af is None and 'AF=' in info_str:
        m = re.search(r'AF=([0-9.eE+-]+)', info_str)
        if m:
            try: af = float(m.group(1))
            except: pass

    if dp is None and 'DP=' in info_str:
        m = re.search(r'DP=(\d+)', info_str)
        if m:
            try: dp = int(m.group(1))
            except: pass

    vtype = infer_variant_type(ref, alt)
    sv = f"{chrom}:{pos}:{ref}>{alt}"
    if len(sv) > 255:
        sv = sv[:255]

    # NULL = \N in COPY format
    N = '\\N'

    return '\t'.join([
        str(upload_id),         # upload_id
        str(source_id),         # source_id
        N,                      # person_id
        sample_id or N,         # sample_id
        chrom,                  # chromosome
        str(pos),               # position
        ref,                    # reference_allele
        alt,                    # alternate_allele
        genome_build or N,      # genome_build
        N,                      # gene_symbol (filled by ClinVar annotation)
        N,                      # hgvs_c
        N,                      # hgvs_p
        vtype,                  # variant_type
        N,                      # variant_class
        N,                      # consequence
        str(qual) if qual else N,  # quality
        filt or N,              # filter_status
        zyg or N,               # zygosity
        str(af) if af is not None else N,  # allele_frequency
        str(dp) if dp is not None else N,  # read_depth
        N, N, N, N,             # clinvar_id, _significance, _disease, _review_status
        N,                      # cosmic_id
        N,                      # tmb_contribution
        'false',                # is_msi_marker
        '0',                    # measurement_concept_id
        sv,                     # measurement_source_value
        N,                      # value_as_concept_id
        'unmapped',             # mapping_status
        N,                      # omop_measurement_id
        '{}',                   # raw_info
        now,                    # created_at
        now,                    # updated_at
    ])


def import_file(conn, vcf_path, upload_id, source_id, genome_build, sample_id, now):
    cur = conn.cursor()

    copy_sql = f"COPY app.genomic_variants ({','.join(COLUMNS)}) FROM STDIN"

    inserted = 0
    errors = 0

    with open(vcf_path, 'r') as fh:
        # Use COPY with a StringIterator
        lines = []
        for line in fh:
            if line.startswith('#'):
                continue

            row = parse_vcf_line(line, sample_id, upload_id, source_id, genome_build, now)
            if row is None:
                errors += 1
                continue

            lines.append(row + '\n')
            inserted += 1

            if len(lines) >= 10000:
                cur.copy_expert(copy_sql, StringIteratorIO(lines))
                conn.commit()
                lines = []
                if inserted % 500000 == 0:
                    print(f"  {inserted:,} variants...", flush=True)

        if lines:
            cur.copy_expert(copy_sql, StringIteratorIO(lines))
            conn.commit()

    cur.close()
    return inserted, errors


class StringIteratorIO:
    """File-like object that reads from an iterator of strings."""
    def __init__(self, strings):
        self._iter = iter(strings)
        self._buf = ''

    def read(self, n=-1):
        while n < 0 or len(self._buf) < n:
            try:
                self._buf += next(self._iter)
            except StopIteration:
                break
        if n < 0:
            result = self._buf
            self._buf = ''
        else:
            result = self._buf[:n]
            self._buf = self._buf[n:]
        return result

    def readline(self):
        while '\n' not in self._buf:
            try:
                self._buf += next(self._iter)
            except StopIteration:
                break
        idx = self._buf.find('\n')
        if idx < 0:
            result = self._buf
            self._buf = ''
        else:
            result = self._buf[:idx + 1]
            self._buf = self._buf[idx + 1:]
        return result


def detect_genome_build(path):
    with open(path, 'r') as f:
        for i, line in enumerate(f):
            if i > 200 or not line.startswith('##'):
                break
            lower = line.lower()
            if 'grch38' in lower or 'hg38' in lower:
                return 'GRCh38'
            if 'grch37' in lower or 'hg19' in lower:
                return 'GRCh37'
    return 'GRCh38'


def extract_sample_id(path):
    with open(path, 'r') as f:
        for line in f:
            if line.startswith('#CHROM'):
                cols = line.rstrip('\r\n').split('\t')
                try:
                    fi = cols.index('FORMAT')
                    if fi + 1 < len(cols):
                        return cols[fi + 1]
                except ValueError:
                    pass
                break
            if not line.startswith('#'):
                break
    return None


def main():
    parser = argparse.ArgumentParser(description='Fast VCF importer using COPY')
    parser.add_argument('--dir', default='vcf/giab_NISTv4.2.1')
    parser.add_argument('--source-id', type=int, default=9)
    parser.add_argument('--admin-id', type=int, default=36)
    parser.add_argument('--db-host', default='localhost')
    parser.add_argument('--db-port', type=int, default=5432)
    parser.add_argument('--db-name', default='ohdsi')
    parser.add_argument('--db-user', default='smudoshi')
    parser.add_argument('--limit', type=int, default=0)
    args = parser.parse_args()

    files = sorted(glob.glob(os.path.join(args.dir, '*.vcf')))
    if not files:
        print(f"No .vcf files in {args.dir}")
        return 1

    print(f"Found {len(files)} VCF file(s)")

    conn = psycopg2.connect(dbname=args.db_name, user=args.db_user)
    cur = conn.cursor()
    now = '2026-03-05 23:00:00'

    for vcf_path in files:
        filename = os.path.basename(vcf_path)
        file_size = os.path.getsize(vcf_path)

        # Check if already imported
        cur.execute(
            "SELECT id FROM app.genomic_uploads WHERE filename = %s AND source_id = %s AND status != 'failed'",
            (filename, args.source_id)
        )
        existing = cur.fetchone()
        if existing:
            print(f"  Skipping {filename} — already imported (upload #{existing[0]})")
            continue

        genome_build = detect_genome_build(vcf_path)
        sample_id = extract_sample_id(vcf_path) or os.path.splitext(filename)[0]
        size_str = f"{file_size / 1073741824:.1f} GB" if file_size >= 1073741824 else f"{file_size / 1048576:.1f} MB"

        print(f"Importing {filename} ({size_str}, build={genome_build}, sample={sample_id})")

        # Create upload record
        cur.execute("""
            INSERT INTO app.genomic_uploads
            (source_id, created_by, filename, file_format, file_size_bytes, status,
             genome_build, sample_id, total_variants, mapped_variants, review_required,
             storage_path, created_at, updated_at)
            VALUES (%s, %s, %s, 'vcf', %s, 'parsing', %s, %s, 0, 0, 0, %s, NOW(), NOW())
            RETURNING id
        """, (args.source_id, args.admin_id, filename, file_size, genome_build, sample_id,
              f"vcf/giab_NISTv4.2.1/{filename}"))
        upload_id = cur.fetchone()[0]
        conn.commit()

        try:
            inserted, errors = import_file(conn, vcf_path, upload_id, args.source_id, genome_build, sample_id, now)

            cur.execute("""
                UPDATE app.genomic_uploads
                SET status = 'mapped', total_variants = %s, parsed_at = NOW(), updated_at = NOW()
                WHERE id = %s
            """, (inserted, upload_id))
            conn.commit()

            print(f"  Done: {inserted:,} variants, {errors} errors")
        except Exception as e:
            conn.rollback()
            cur.execute("""
                UPDATE app.genomic_uploads
                SET status = 'failed', error_message = %s, updated_at = NOW()
                WHERE id = %s
            """, (str(e)[:500], upload_id))
            conn.commit()
            print(f"  FAILED: {e}")

    cur.close()
    conn.close()
    print("All imports complete.")
    return 0


if __name__ == '__main__':
    sys.exit(main())
