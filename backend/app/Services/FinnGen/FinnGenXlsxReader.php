<?php

declare(strict_types=1);

namespace App\Services\FinnGen;

use App\Services\FinnGen\Dto\EndpointRow;
use Generator;
use PhpOffice\PhpSpreadsheet\IOFactory;
use PhpOffice\PhpSpreadsheet\Worksheet\Worksheet;
use RuntimeException;

/**
 * Streams the FinnGen curated endpoint XLSX file as EndpointRow DTOs.
 *
 * Row semantics:
 *   row 1 → column headers (TAGS, LEVEL, NAME, LONGNAME, …, Modification_reason)
 *   row 2 → banner/notice ("#ALL", "#V1.3", "#_This_follow-up_coding_is_the_work_of_…_")
 *   row 3+ → endpoints. DEATH typically sits at row 3 with LEVEL blank but
 *            COD_ICD_10='ANY' — a real endpoint, must NOT be filtered out.
 *
 * Banner / junk filter:
 *   - NAME must be non-empty
 *   - NAME must not start with '#'
 *   - At least one of the source-code columns OR INCLUDE must be non-empty
 *     (catches the banner, which has NAME but no code columns / INCLUDE).
 */
final class FinnGenXlsxReader
{
    public const COL_TAGS = 1;

    public const COL_LEVEL = 2;

    public const COL_NAME = 3;

    public const COL_LONGNAME = 4;

    public const COL_SEX = 5;

    public const COL_INCLUDE = 6;

    public const COL_PRE_CONDITIONS = 7;

    public const COL_CONDITIONS = 8;

    public const COL_OUTPAT_ICD = 9;

    public const COL_OUTPAT_OPER = 10;

    public const COL_HD_MAINONLY = 11;

    public const COL_HD_ICD_10_ATC = 12;

    public const COL_HD_ICD_10 = 13;

    public const COL_HD_ICD_9 = 14;

    public const COL_HD_ICD_8 = 15;

    public const COL_HD_ICD_10_EXCL = 16;

    public const COL_HD_ICD_9_EXCL = 17;

    public const COL_HD_ICD_8_EXCL = 18;

    public const COL_COD_MAINONLY = 19;

    public const COL_COD_ICD_10 = 20;

    public const COL_COD_ICD_9 = 21;

    public const COL_COD_ICD_8 = 22;

    public const COL_COD_ICD_10_EXCL = 23;

    public const COL_COD_ICD_9_EXCL = 24;

    public const COL_COD_ICD_8_EXCL = 25;

    public const COL_OPER_NOM = 26;

    public const COL_OPER_HL = 27;

    public const COL_OPER_HP1 = 28;

    public const COL_OPER_HP2 = 29;

    public const COL_KELA_REIMB = 30;

    public const COL_KELA_REIMB_ICD = 31;

    public const COL_KELA_ATC_NEEDOTHER = 32;

    public const COL_KELA_ATC = 33;

    public const COL_KELA_VNRO_NEEDOTHER = 34;

    public const COL_KELA_VNRO = 35;

    public const COL_CANC_TOPO = 36;

    public const COL_CANC_TOPO_EXCL = 37;

    public const COL_CANC_MORPH = 38;

    public const COL_CANC_MORPH_EXCL = 39;

    public const COL_CANC_BEHAV = 40;

    public const COL_SPECIAL = 41;

    public const COL_VERSION = 42;

    public const COL_PARENT = 43;

    public const COL_LATIN = 44;

    public function __construct(private readonly string $path)
    {
        if (! is_file($this->path)) {
            throw new RuntimeException("FinnGen XLSX fixture not found: {$this->path}");
        }
    }

    /**
     * Approximate total endpoint count for progress reporting. Returns the
     * sheet's highest row index — will over-count by 1 (banner) plus any
     * trailing blank rows, but is cheap and only used to size the progress
     * bar.
     */
    public function estimateTotal(): int
    {
        $reader = IOFactory::createReader('Xlsx');
        $reader->setReadDataOnly(true);
        $wb = $reader->load($this->path);
        $ws = $wb->getActiveSheet();
        $high = $ws->getHighestRow();
        $wb->disconnectWorksheets();

        return max(0, $high - 2); // subtract header + banner
    }

    /**
     * @return Generator<int, EndpointRow, void, void>
     */
    public function rows(): Generator
    {
        $reader = IOFactory::createReader('Xlsx');
        $reader->setReadDataOnly(true);
        $wb = $reader->load($this->path);
        $ws = $wb->getActiveSheet();
        $high = $ws->getHighestRow();

        try {
            for ($r = 2; $r <= $high; $r++) {
                $name = self::strCell($ws, self::COL_NAME, $r);
                if ($name === null || $name === '' || str_starts_with($name, '#')) {
                    continue;
                }

                // Gather raw values once
                $tagsRaw = self::strCell($ws, self::COL_TAGS, $r);
                $includeRaw = self::strCell($ws, self::COL_INCLUDE, $r);
                $hd10 = self::strCell($ws, self::COL_HD_ICD_10, $r);
                $hd9 = self::strCell($ws, self::COL_HD_ICD_9, $r);
                $hd8 = self::strCell($ws, self::COL_HD_ICD_8, $r);
                $cod10 = self::strCell($ws, self::COL_COD_ICD_10, $r);
                $cod9 = self::strCell($ws, self::COL_COD_ICD_9, $r);
                $cod8 = self::strCell($ws, self::COL_COD_ICD_8, $r);
                $outpat = self::strCell($ws, self::COL_OUTPAT_ICD, $r);
                $kelaAtc = self::strCell($ws, self::COL_KELA_ATC, $r);
                $kelaReimb = self::strCell($ws, self::COL_KELA_REIMB, $r);
                $operNom = self::strCell($ws, self::COL_OPER_NOM, $r);
                $cancTopo = self::strCell($ws, self::COL_CANC_TOPO, $r);

                // A real endpoint needs at least one of: code column, INCLUDE, or being DEATH-shaped
                // (which has COD_ICD_10='ANY'). The banner row has NAME starting with '#'
                // (already filtered above) so anything that reaches here with a non-null NAME
                // is accepted even if all code columns happen to be blank — DEATH passes via
                // COD_ICD_10='ANY', and some pure-composite endpoints may only have INCLUDE.
                $hasContent =
                    ($tagsRaw !== null && $tagsRaw !== '') ||
                    ($includeRaw !== null && $includeRaw !== '') ||
                    ($hd10 !== null && $hd10 !== '') || ($hd9 !== null && $hd9 !== '') || ($hd8 !== null && $hd8 !== '') ||
                    ($cod10 !== null && $cod10 !== '') || ($cod9 !== null && $cod9 !== '') || ($cod8 !== null && $cod8 !== '') ||
                    ($outpat !== null && $outpat !== '') || ($kelaAtc !== null && $kelaAtc !== '') ||
                    ($kelaReimb !== null && $kelaReimb !== '') || ($operNom !== null && $operNom !== '') ||
                    ($cancTopo !== null && $cancTopo !== '');
                if (! $hasContent) {
                    continue;
                }

                yield new EndpointRow(
                    tags: self::splitList($tagsRaw, ','),
                    level: self::strCell($ws, self::COL_LEVEL, $r),
                    name: $name,
                    longname: self::strCell($ws, self::COL_LONGNAME, $r),
                    sex_restriction: self::intCell($ws, self::COL_SEX, $r),
                    include: self::splitList($includeRaw, '|'),
                    pre_conditions: self::strCell($ws, self::COL_PRE_CONDITIONS, $r),
                    conditions: self::strCell($ws, self::COL_CONDITIONS, $r),
                    outpat_icd: $outpat,
                    outpat_oper: self::strCell($ws, self::COL_OUTPAT_OPER, $r),
                    hd_mainonly: self::yesCell($ws, self::COL_HD_MAINONLY, $r),
                    hd_icd_10_atc: self::strCell($ws, self::COL_HD_ICD_10_ATC, $r),
                    hd_icd_10: $hd10,
                    hd_icd_9: $hd9,
                    hd_icd_8: $hd8,
                    hd_icd_10_excl: self::strCell($ws, self::COL_HD_ICD_10_EXCL, $r),
                    hd_icd_9_excl: self::strCell($ws, self::COL_HD_ICD_9_EXCL, $r),
                    hd_icd_8_excl: self::strCell($ws, self::COL_HD_ICD_8_EXCL, $r),
                    cod_mainonly: self::yesCell($ws, self::COL_COD_MAINONLY, $r),
                    cod_icd_10: $cod10,
                    cod_icd_9: $cod9,
                    cod_icd_8: $cod8,
                    cod_icd_10_excl: self::strCell($ws, self::COL_COD_ICD_10_EXCL, $r),
                    cod_icd_9_excl: self::strCell($ws, self::COL_COD_ICD_9_EXCL, $r),
                    cod_icd_8_excl: self::strCell($ws, self::COL_COD_ICD_8_EXCL, $r),
                    oper_nom: $operNom,
                    oper_hl: self::strCell($ws, self::COL_OPER_HL, $r),
                    oper_hp1: self::strCell($ws, self::COL_OPER_HP1, $r),
                    oper_hp2: self::strCell($ws, self::COL_OPER_HP2, $r),
                    kela_reimb: $kelaReimb,
                    kela_reimb_icd: self::strCell($ws, self::COL_KELA_REIMB_ICD, $r),
                    kela_atc_needother: self::strCell($ws, self::COL_KELA_ATC_NEEDOTHER, $r),
                    kela_atc: $kelaAtc,
                    kela_vnro_needother: self::strCell($ws, self::COL_KELA_VNRO_NEEDOTHER, $r),
                    kela_vnro: self::strCell($ws, self::COL_KELA_VNRO, $r),
                    canc_topo: $cancTopo,
                    canc_topo_excl: self::strCell($ws, self::COL_CANC_TOPO_EXCL, $r),
                    canc_morph: self::strCell($ws, self::COL_CANC_MORPH, $r),
                    canc_morph_excl: self::strCell($ws, self::COL_CANC_MORPH_EXCL, $r),
                    canc_behav: self::strCell($ws, self::COL_CANC_BEHAV, $r),
                    special: self::strCell($ws, self::COL_SPECIAL, $r),
                    version: self::strCell($ws, self::COL_VERSION, $r),
                    parent: self::strCell($ws, self::COL_PARENT, $r),
                    latin: self::strCell($ws, self::COL_LATIN, $r),
                    source_row: $r,
                );
            }
        } finally {
            $wb->disconnectWorksheets();
        }
    }

    private static function strCell(Worksheet $ws, int $col, int $row): ?string
    {
        $v = $ws->getCell([$col, $row])->getValue();
        if ($v === null) {
            return null;
        }
        $s = trim((string) $v);

        return $s === '' ? null : $s;
    }

    private static function intCell(Worksheet $ws, int $col, int $row): ?int
    {
        $v = $ws->getCell([$col, $row])->getValue();
        if ($v === null) {
            return null;
        }
        if (is_int($v)) {
            return $v;
        }
        $s = trim((string) $v);
        if ($s === '') {
            return null;
        }

        return ctype_digit($s) ? (int) $s : null;
    }

    private static function yesCell(Worksheet $ws, int $col, int $row): bool
    {
        $v = self::strCell($ws, $col, $row);

        return $v !== null && strcasecmp($v, 'YES') === 0;
    }

    /**
     * @return list<string>
     */
    private static function splitList(?string $raw, string $sep): array
    {
        if ($raw === null || trim($raw) === '') {
            return [];
        }
        $out = [];
        foreach (explode($sep, $raw) as $tok) {
            $tok = trim($tok);
            if ($tok !== '') {
                $out[] = $tok;
            }
        }

        return array_values(array_unique($out));
    }
}
