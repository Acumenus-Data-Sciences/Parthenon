<?php

namespace App\Services\Imaging;

use App\Models\App\ImagingInstance;
use App\Models\App\ImagingSeries;
use App\Models\App\ImagingStudy;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

/**
 * DicomFileService — scans a local directory of DICOM files and upserts
 * imaging_studies / imaging_series / imaging_instances records.
 *
 * Supports Explicit VR Little Endian (the overwhelming majority of modern DICOM).
 * Reads only metadata tags (stops before pixel data at 7FE0,0010).
 */
class DicomFileService
{
    // ──────────────────────────────────────────────────────────────────────
    // DICOM tag constants (big-endian hex → for reference; we use LE in file)
    // ──────────────────────────────────────────────────────────────────────

    private const TAGS = [
        0x00080016 => 'SOPClassUID',
        0x00080018 => 'SOPInstanceUID',
        0x00080020 => 'StudyDate',
        0x00080060 => 'Modality',
        0x00080080 => 'InstitutionName',
        0x00081030 => 'StudyDescription',
        0x0008103E => 'SeriesDescription',
        0x00080090 => 'ReferringPhysicianName',
        0x00100010 => 'PatientName',
        0x00100020 => 'PatientID',
        0x00180015 => 'BodyPartExamined',
        0x00180050 => 'SliceThickness',
        0x00180060 => 'KVP',
        0x00181030 => 'ProtocolName',
        0x00181164 => 'PixelSpacing',
        0x0020000D => 'StudyInstanceUID',
        0x0020000E => 'SeriesInstanceUID',
        0x00200013 => 'InstanceNumber',
        0x00201041 => 'SliceLocation',
        0x00280010 => 'Rows',
        0x00280011 => 'Columns',
        0x00280030 => 'PixelSpacing', // also at 0028,0030
        0x00081164 => 'FrameOfReferenceUID',
    ];

    // VRs that use 4-byte length (explicit VR long form)
    private const LONG_VRS = ['OB', 'OD', 'OF', 'OL', 'OW', 'SQ', 'UC', 'UN', 'UR', 'UT'];

    // ──────────────────────────────────────────────────────────────────────
    // Public API
    // ──────────────────────────────────────────────────────────────────────

    /**
     * Scan $dir recursively, import all DICOM files into the DB for $sourceId.
     *
     * @return array{studies: int, series: int, instances: int, errors: int}
     */
    public function importDirectory(string $dir, int $sourceId): array
    {
        if (!is_dir($dir)) {
            throw new \InvalidArgumentException("Directory not found: {$dir}");
        }

        $files = $this->findDicomFiles($dir);

        $studies = [];   // uid -> data
        $series = [];    // uid -> data
        $instances = []; // sopUid -> data

        foreach ($files as $path) {
            try {
                $meta = $this->readMeta($path);
                if (!$meta) {
                    continue;
                }
                $this->accumulate($meta, $path, $studies, $series, $instances);
            } catch (\Throwable $e) {
                Log::warning("DICOM parse error: {$path}: " . $e->getMessage());
            }
        }

        $errors = 0;

        // Derive repo-relative paths (so files served from base_path())
        $repoRoot = base_path();

        $studies = array_map(function (array $s) use ($repoRoot) {
            if (isset($s['file_dir'])) {
                $s['file_dir'] = $this->relativeTo($s['file_dir'], $repoRoot);
            }
            return $s;
        }, $studies);

        $series = array_map(function (array $s) use ($repoRoot) {
            if (isset($s['file_dir'])) {
                $s['file_dir'] = $this->relativeTo($s['file_dir'], $repoRoot);
            }
            return $s;
        }, $series);

        $instances = array_map(function (array $i) use ($repoRoot) {
            if (isset($i['file_path'])) {
                $i['file_path'] = $this->relativeTo($i['file_path'], $repoRoot);
            }
            return $i;
        }, $instances);

        [$studyCount, $seriesCount, $instanceCount] = $this->persist(
            $sourceId,
            $studies,
            $series,
            $instances
        );

        return [
            'studies'   => $studyCount,
            'series'    => $seriesCount,
            'instances' => $instanceCount,
            'errors'    => $errors,
        ];
    }

    /**
     * Skip an undefined-length DICOM element (SQ or other) by tracking nesting depth.
     * Properly handles nested sequences and items.
     */
    private function skipUndefinedLength($fh): void
    {
        $depth = 1;
        $safeguard = 500000; // 500K iterations max

        while ($depth > 0 && $safeguard-- > 0 && !feof($fh)) {
            $rawGroup = fread($fh, 2);
            $rawElem  = fread($fh, 2);
            if (strlen($rawGroup) < 2 || strlen($rawElem) < 2) {
                break;
            }
            $group = unpack('v', $rawGroup)[1];
            $elem  = unpack('v', $rawElem)[1];

            if ($group === 0xFFFE) {
                // Control tags: Item, Item Delimiter, Sequence Delimiter
                $lenRaw = fread($fh, 4);
                $len    = strlen($lenRaw) === 4 ? unpack('V', $lenRaw)[1] : 0;

                if ($elem === 0xE0DD) {
                    // Sequence Delimitation Item — end of current sequence
                    $depth--;
                } elseif ($elem === 0xE000 && $len !== 0xFFFFFFFF && $len > 0) {
                    // Defined-length Item — skip contents
                    fseek($fh, $len, SEEK_CUR);
                }
                // E00D (Item Delimitation) and undefined-length E000 handled by loop
                continue;
            }

            // Regular element inside sequence — read VR and length
            $vrRaw = fread($fh, 2);
            $vr    = $vrRaw;
            if (!preg_match('/^[A-Z]{2}$/', $vr)) {
                fseek($fh, -2, SEEK_CUR);
                $length = unpack('V', fread($fh, 4))[1];
                $vr = 'UN';
            } elseif (in_array($vr, self::LONG_VRS, true)) {
                fread($fh, 2);
                $length = unpack('V', fread($fh, 4))[1];
            } else {
                $length = unpack('v', fread($fh, 2))[1];
            }

            if ($length === 0xFFFFFFFF) {
                $depth++; // another nested undefined-length element
            } elseif ($length > 0) {
                fseek($fh, $length, SEEK_CUR);
            }
        }
    }

    // ──────────────────────────────────────────────────────────────────────
    // File discovery
    // ──────────────────────────────────────────────────────────────────────

    /** @return string[] */
    private function findDicomFiles(string $dir): array
    {
        $results = [];
        $iterator = new \RecursiveIteratorIterator(
            new \RecursiveDirectoryIterator($dir, \FilesystemIterator::SKIP_DOTS)
        );
        foreach ($iterator as $file) {
            /** @var \SplFileInfo $file */
            if ($file->isFile() && $this->isDicom($file->getPathname())) {
                $results[] = $file->getPathname();
            }
        }
        return $results;
    }

    private function isDicom(string $path): bool
    {
        $fh = @fopen($path, 'rb');
        if (!$fh) {
            return false;
        }
        fseek($fh, 128);
        $magic = fread($fh, 4);
        fclose($fh);
        return $magic === 'DICM';
    }

    // ──────────────────────────────────────────────────────────────────────
    // DICOM metadata reader (Explicit VR Little Endian)
    // ──────────────────────────────────────────────────────────────────────

    /** @return array<string, string|int|float|null>|null */
    private function readMeta(string $path): ?array
    {
        $fh = @fopen($path, 'rb');
        if (!$fh) {
            return null;
        }

        try {
            // Skip 128-byte preamble + 4-byte "DICM" magic
            fseek($fh, 132);

            $result = [];
            $maxTags = 500; // read up to 500 elements (StudyUID is in group 0020)

            while (!feof($fh) && $maxTags-- > 0) {
                // Read group and element
                $rawGroup = fread($fh, 2);
                $rawElem  = fread($fh, 2);
                if (strlen($rawGroup) < 2 || strlen($rawElem) < 2) {
                    break;
                }

                $group = unpack('v', $rawGroup)[1];
                $elem  = unpack('v', $rawElem)[1];
                $tag   = ($group << 16) | $elem;

                // Stop at pixel data
                if ($tag >= 0x7FE00010) {
                    break;
                }

                // Determine VR and length
                // Groups 0000 and 0002 always use Explicit VR
                // We assume Explicit VR (most modern DICOM) — handle gracefully
                $vrRaw = fread($fh, 2);
                if (strlen($vrRaw) < 2) {
                    break;
                }
                $vr = $vrRaw;

                // Validate VR — if not printable ASCII letters, likely implicit VR
                if (!preg_match('/^[A-Z]{2}$/', $vr)) {
                    // Implicit VR — length is the 4 bytes we just read + next 2 bytes would be rewind
                    // Back up and treat as 4-byte implicit length
                    fseek($fh, -2, SEEK_CUR);
                    $lenRaw = fread($fh, 4);
                    if (strlen($lenRaw) < 4) break;
                    $length = unpack('V', $lenRaw)[1];
                    $vr = 'UN';
                } elseif (in_array($vr, self::LONG_VRS, true)) {
                    // Skip 2 reserved bytes
                    fread($fh, 2);
                    $lenRaw = fread($fh, 4);
                    if (strlen($lenRaw) < 4) break;
                    $length = unpack('V', $lenRaw)[1];
                } else {
                    $lenRaw = fread($fh, 2);
                    if (strlen($lenRaw) < 2) break;
                    $length = unpack('v', $lenRaw)[1];
                }

                // Handle undefined length — skip this element (usually sequences)
                if ($length === 0xFFFFFFFF) {
                    $this->skipUndefinedLength($fh);
                    continue;
                }

                // Skip large elements (pixel data, embedded images, etc.)
                if ($length > 8192) {
                    fseek($fh, $length, SEEK_CUR);
                    continue;
                }

                // Read value if it's a tag we want
                $tagName = self::TAGS[$tag] ?? null;
                if ($tagName && $length > 0) {
                    $value = fread($fh, $length);
                    // Trim padding (DICOM pads with space or null)
                    $result[$tagName] = rtrim($value, " \0");
                } elseif ($length > 0) {
                    fseek($fh, $length, SEEK_CUR);
                }
            }

            return $result ?: null;
        } finally {
            fclose($fh);
        }
    }

    // ──────────────────────────────────────────────────────────────────────
    // Accumulate into study/series/instance maps
    // ──────────────────────────────────────────────────────────────────────

    private function accumulate(
        array $meta,
        string $filePath,
        array &$studies,
        array &$series,
        array &$instances
    ): void {
        $studyUid  = $meta['StudyInstanceUID'] ?? null;
        $seriesUid = $meta['SeriesInstanceUID'] ?? null;
        $sopUid    = $meta['SOPInstanceUID'] ?? null;

        if (!$studyUid || !$seriesUid || !$sopUid) {
            return;
        }

        $dir = dirname($filePath);

        // ── Study ──────────────────────────────────────────────────────────
        if (!isset($studies[$studyUid])) {
            $studies[$studyUid] = [
                'study_instance_uid'  => $studyUid,
                'modality'            => $meta['Modality'] ?? null,
                'body_part_examined'  => $meta['BodyPartExamined'] ?? null,
                'study_description'   => $meta['StudyDescription'] ?? null,
                'referring_physician' => $meta['ReferringPhysicianName'] ?? null,
                'study_date'          => $this->parseDate($meta['StudyDate'] ?? null),
                'accession_number'    => null,
                'patient_name_dicom'  => $meta['PatientName'] ?? null,
                'patient_id_dicom'    => $meta['PatientID'] ?? null,
                'institution_name'    => $meta['InstitutionName'] ?? null,
                'file_dir'            => $dir,
                'status'              => 'indexed',
                'num_series'          => 0,
                'num_images'          => 0,
            ];
        }
        $studies[$studyUid]['num_images']++;

        // ── Series ─────────────────────────────────────────────────────────
        if (!isset($series[$seriesUid])) {
            $ps = $meta['PixelSpacing'] ?? null;
            $rows = isset($meta['Rows']) ? (int) $meta['Rows'] : null;
            $cols = isset($meta['Columns']) ? (int) $meta['Columns'] : null;

            $series[$seriesUid] = [
                'study_instance_uid'  => $studyUid,
                'series_instance_uid' => $seriesUid,
                'series_description'  => $meta['SeriesDescription'] ?? null,
                'modality'            => $meta['Modality'] ?? null,
                'body_part_examined'  => $meta['BodyPartExamined'] ?? null,
                'series_number'       => isset($meta['SeriesNumber']) ? (int) $meta['SeriesNumber'] : null,
                'slice_thickness_mm'  => isset($meta['SliceThickness']) ? (float) $meta['SliceThickness'] : null,
                'manufacturer'        => $meta['Manufacturer'] ?? null,
                'manufacturer_model'  => $meta['ManufacturerModelName'] ?? null,
                'pixel_spacing'       => $ps,
                'rows_x_cols'         => ($rows && $cols) ? "{$rows}x{$cols}" : null,
                'kvp'                 => $meta['KVP'] ?? null,
                'file_dir'            => $dir,
                'num_images'          => 0,
            ];

            $studies[$studyUid]['num_series']++;
        }
        $series[$seriesUid]['num_images']++;

        // ── Instance ───────────────────────────────────────────────────────
        if (!isset($instances[$sopUid])) {
            $instances[$sopUid] = [
                'study_instance_uid'  => $studyUid,
                'series_instance_uid' => $seriesUid,
                'sop_instance_uid'    => $sopUid,
                'sop_class_uid'       => $meta['SOPClassUID'] ?? null,
                'instance_number'     => isset($meta['InstanceNumber']) ? (int) $meta['InstanceNumber'] : null,
                'slice_location'      => isset($meta['SliceLocation']) ? (float) $meta['SliceLocation'] : null,
                'file_path'           => $filePath,
            ];
        }
    }

    // ──────────────────────────────────────────────────────────────────────
    // Persist
    // ──────────────────────────────────────────────────────────────────────

    /** @return array{0: int, 1: int, 2: int} */
    private function persist(
        int $sourceId,
        array $studies,
        array $series,
        array $instances
    ): array {
        $studyCount    = 0;
        $seriesCount   = 0;
        $instanceCount = 0;

        DB::transaction(function () use (
            $sourceId, $studies, $series, $instances,
            &$studyCount, &$seriesCount, &$instanceCount
        ) {
            $studyUidToId  = [];
            $seriesUidToId = [];

            foreach ($studies as $uid => $s) {
                $data = array_filter($s, fn ($v) => $v !== null && $v !== '');
                $study = ImagingStudy::updateOrCreate(
                    ['study_instance_uid' => $uid],
                    array_merge($data, ['source_id' => $sourceId])
                );
                $studyUidToId[$uid] = $study->id;
                $studyCount++;
            }

            foreach ($series as $uid => $s) {
                $studyId = $studyUidToId[$s['study_instance_uid']] ?? null;
                if (!$studyId) {
                    continue;
                }
                $data = array_filter($s, fn ($v) => $v !== null && $v !== '');
                unset($data['study_instance_uid']);
                $ser = ImagingSeries::updateOrCreate(
                    ['series_instance_uid' => $uid],
                    array_merge($data, ['study_id' => $studyId])
                );
                $seriesUidToId[$uid] = $ser->id;
                $seriesCount++;
            }

            foreach ($instances as $sopUid => $inst) {
                $studyId  = $studyUidToId[$inst['study_instance_uid']] ?? null;
                $seriesId = $seriesUidToId[$inst['series_instance_uid']] ?? null;
                if (!$studyId || !$seriesId) {
                    continue;
                }
                $data = array_filter($inst, fn ($v) => $v !== null && $v !== '');
                unset($data['study_instance_uid'], $data['series_instance_uid']);
                ImagingInstance::updateOrCreate(
                    ['sop_instance_uid' => $sopUid],
                    array_merge($data, ['study_id' => $studyId, 'series_id' => $seriesId])
                );
                $instanceCount++;
            }
        });

        return [$studyCount, $seriesCount, $instanceCount];
    }

    // ──────────────────────────────────────────────────────────────────────
    // Helpers
    // ──────────────────────────────────────────────────────────────────────

    private function parseDate(?string $raw): ?string
    {
        if ($raw && strlen($raw) === 8 && ctype_digit($raw)) {
            return substr($raw, 0, 4) . '-' . substr($raw, 4, 2) . '-' . substr($raw, 6, 2);
        }
        return null;
    }

    private function relativeTo(string $path, string $base): string
    {
        $base = rtrim($base, '/') . '/';
        if (str_starts_with($path, $base)) {
            return substr($path, strlen($base));
        }
        return $path;
    }
}
