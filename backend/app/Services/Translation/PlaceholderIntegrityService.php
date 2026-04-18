<?php

declare(strict_types=1);

namespace App\Services\Translation;

final class PlaceholderIntegrityService
{
    /**
     * @return list<array{type: string, missing: list<string>, extra: list<string>}>
     */
    public function violations(string $sourceText, string $targetText): array
    {
        $violations = [];

        $sourcePlaceholders = $this->placeholders($sourceText);
        $targetPlaceholders = $this->placeholders($targetText);
        $missingPlaceholders = array_values(array_diff($sourcePlaceholders, $targetPlaceholders));
        $extraPlaceholders = array_values(array_diff($targetPlaceholders, $sourcePlaceholders));

        if ($missingPlaceholders !== [] || $extraPlaceholders !== []) {
            $violations[] = [
                'type' => 'placeholder-mismatch',
                'missing' => $missingPlaceholders,
                'extra' => $extraPlaceholders,
            ];
        }

        $sourceTags = $this->tags($sourceText);
        $targetTags = $this->tags($targetText);
        $missingTags = array_values(array_diff($sourceTags, $targetTags));
        $extraTags = array_values(array_diff($targetTags, $sourceTags));

        if ($missingTags !== [] || $extraTags !== []) {
            $violations[] = [
                'type' => 'tag-mismatch',
                'missing' => $missingTags,
                'extra' => $extraTags,
            ];
        }

        return $violations;
    }

    /**
     * @return list<string>
     */
    public function placeholders(string $text): array
    {
        $names = implode('|', array_map(
            fn (string $name): string => preg_quote($name, '/'),
            (array) config('translation.placeholder_names', [])
        ));
        $colonPattern = $names === '' ? '(?!)' : ":(?:{$names})";

        preg_match_all(
            "/{{\\s*[\\w.]+\\s*}}|{$colonPattern}|%[sdif]/",
            $text,
            $matches,
        );

        $values = array_values(array_unique($matches[0] ?? []));
        sort($values);

        return $values;
    }

    /**
     * @return list<string>
     */
    public function tags(string $text): array
    {
        preg_match_all('/<\/?[A-Za-z][A-Za-z0-9-]*(?:\s[^>]*)?>/', $text, $matches);

        $values = array_values(array_unique($matches[0] ?? []));
        sort($values);

        return $values;
    }
}
