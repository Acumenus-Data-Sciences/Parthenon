<?php

declare(strict_types=1);

namespace App\Services\FinnGen;

/**
 * Expands the Finnish-style regex-like code patterns used in the FinnGen
 * curated endpoint library. The file uses a tiny dialect:
 *
 *   - pipe-alternation:    I21|I22              → ['I21','I22']
 *   - digit range:         F3[2-3]              → ['F32','F33']
 *   - alpha range:         A4[A-C]              → ['A4A','A4B','A4C']
 *   - char class:          7490[ABCE]           → ['7490A','7490B','7490C','7490E']
 *   - single in brackets:  09[8]                → ['098']  (FinnGen literal idiom)
 *   - multi-digit class:   I80[12]              → ['I801','I802']
 *   - leading anchor:      ^FN1[ABSY]           → ['FN1A','FN1B','FN1S','FN1Y']  (caret stripped)
 *   - combined:            I21|F3[2-3]          → ['I21','F32','F33']
 *   - literal with suffix: 4019X                → ['4019X']   (no expansion)
 *   - empty / null         →                    → []
 *
 * Tokens that CAN'T be cleanly expanded are dropped:
 *   - unclosed brackets:   D06[7    →  []   (XLSX cell parsing artifact)
 *   - non-alphanum chars:  $!$      →  []
 *   - single chars:        V        →  []   (too short to be a real code)
 *
 * The ICD-9 trailing-letter stripping that Finnish sub-codes require
 * ("4019X" → "4019" / "401.9") is NOT done here — that's the resolver's
 * concern.
 */
final class FinnGenPatternExpander
{
    /**
     * @return list<string>
     */
    public static function expand(?string $raw): array
    {
        if ($raw === null) {
            return [];
        }
        $raw = trim($raw);
        if ($raw === '') {
            return [];
        }

        $out = [];
        foreach (explode('|', $raw) as $tok) {
            $tok = trim($tok);
            // Strip leading regex anchor (^FN1[ABSY] → FN1[ABSY]).
            if (str_starts_with($tok, '^')) {
                $tok = substr($tok, 1);
            }
            if ($tok === '') {
                continue;
            }
            // Reject unclosed brackets — these are XLSX cell artifacts.
            if (substr_count($tok, '[') !== substr_count($tok, ']')) {
                continue;
            }
            foreach (self::expandBracketClass($tok) as $expanded) {
                $expanded = trim($expanded);
                // Final sanity check: must be 2+ chars and only alphanum/.-_
                if (strlen($expanded) < 2) {
                    continue;
                }
                if (preg_match('/^[A-Za-z0-9._\-]+$/', $expanded) !== 1) {
                    continue;
                }
                $out[] = $expanded;
            }
        }

        return array_values(array_unique($out));
    }

    /**
     * Expand a single token that may contain a bracket char class. Handles
     * digit ranges ([1-3]), alpha ranges ([A-C]), digit classes ([12]),
     * alpha classes ([ABC]), single-digit-in-brackets ([1]). Recursively
     * expands the first bracket found, then re-runs on each result so
     * tokens with multiple bracket classes (rare) also expand.
     *
     * @return list<string>
     */
    private static function expandBracketClass(string $tok): array
    {
        if (! str_contains($tok, '[')) {
            return [$tok];
        }
        // Range: [m-n] where m,n are both digits or both letters
        if (preg_match('/^(.*?)\[(\d)-(\d)\](.*)$/', $tok, $m)) {
            $lo = (int) $m[2];
            $hi = (int) $m[3];
            if ($lo > $hi) {
                return [];
            }
            $results = [];
            for ($i = $lo; $i <= $hi; $i++) {
                $results = array_merge($results, self::expandBracketClass($m[1].$i.$m[4]));
            }

            return $results;
        }
        if (preg_match('/^(.*?)\[([A-Za-z])-([A-Za-z])\](.*)$/', $tok, $m)) {
            $lo = ord(strtoupper($m[2]));
            $hi = ord(strtoupper($m[3]));
            if ($lo > $hi) {
                return [];
            }
            $results = [];
            for ($i = $lo; $i <= $hi; $i++) {
                $results = array_merge($results, self::expandBracketClass($m[1].chr($i).$m[4]));
            }

            return $results;
        }
        // Class: [chars] where chars is one or more digits or letters (no range)
        if (preg_match('/^(.*?)\[([A-Za-z0-9]+)\](.*)$/', $tok, $m)) {
            $prefix = $m[1];
            $chars = $m[2];
            $suffix = $m[3];
            $results = [];
            $len = strlen($chars);
            for ($i = 0; $i < $len; $i++) {
                $results = array_merge($results, self::expandBracketClass($prefix.$chars[$i].$suffix));
            }

            return $results;
        }

        // Bracket present but didn't match any known class form (e.g. nested
        // or contains illegal chars). Drop — better to lose one token than
        // smuggle regex syntax into a downstream LIKE.
        return [];
    }
}
