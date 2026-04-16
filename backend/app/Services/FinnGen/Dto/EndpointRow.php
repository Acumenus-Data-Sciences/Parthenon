<?php

declare(strict_types=1);

namespace App\Services\FinnGen\Dto;

/**
 * Value object representing one row of the FinnGen curated endpoint library
 * XLSX. All fields correspond to the 47 columns described in the format
 * spec (V1.1 / V1.3). Pattern fields ("HD_ICD_10" = "F3[2-3]|G45" etc.)
 * are kept as raw strings here; expansion happens in FinnGenPatternExpander.
 */
final readonly class EndpointRow
{
    /**
     * @param  list<string>  $tags  Parsed #-prefixed tags from the TAGS column (comma-separated upstream).
     * @param  list<string>  $include  Pipe-separated endpoint names from the INCLUDE column.
     */
    public function __construct(
        public array $tags,
        public ?string $level,
        public string $name,
        public ?string $longname,
        public ?int $sex_restriction,
        public array $include,
        public ?string $pre_conditions,
        public ?string $conditions,
        public ?string $outpat_icd,
        public ?string $outpat_oper,
        public bool $hd_mainonly,
        public ?string $hd_icd_10_atc,
        public ?string $hd_icd_10,
        public ?string $hd_icd_9,
        public ?string $hd_icd_8,
        public ?string $hd_icd_10_excl,
        public ?string $hd_icd_9_excl,
        public ?string $hd_icd_8_excl,
        public bool $cod_mainonly,
        public ?string $cod_icd_10,
        public ?string $cod_icd_9,
        public ?string $cod_icd_8,
        public ?string $cod_icd_10_excl,
        public ?string $cod_icd_9_excl,
        public ?string $cod_icd_8_excl,
        public ?string $oper_nom,
        public ?string $oper_hl,
        public ?string $oper_hp1,
        public ?string $oper_hp2,
        public ?string $kela_reimb,
        public ?string $kela_reimb_icd,
        public ?string $kela_atc_needother,
        public ?string $kela_atc,
        public ?string $kela_vnro_needother,
        public ?string $kela_vnro,
        public ?string $canc_topo,
        public ?string $canc_topo_excl,
        public ?string $canc_morph,
        public ?string $canc_morph_excl,
        public ?string $canc_behav,
        public ?string $special,
        public ?string $version,
        public ?string $parent,
        public ?string $latin,
        public int $source_row,
    ) {}
}
