<?php

namespace App\PHPStan\Rules;

use PhpParser\Node;
use PhpParser\Node\Expr\StaticCall;
use PhpParser\Node\Scalar\String_;
use PHPStan\Analyser\Scope;
use PHPStan\Rules\Rule;
use PHPStan\Rules\RuleError;
use PHPStan\Rules\RuleErrorBuilder;

/**
 * Bans direct DB::connection('omop'), DB::connection('results'),
 * and DB::connection('inpatient') calls outside of allowed files.
 *
 * Forces developers to use the SourceAware trait instead.
 *
 * @implements Rule<StaticCall>
 */
class NoBareConnectionCallRule implements Rule
{
    /** Connection names that must not be hardcoded */
    private const BANNED_CONNECTIONS = ['omop', 'results', 'inpatient', 'eunomia'];

    /** Files allowed to use bare connections (infrastructure code) */
    private const ALLOWED_FILES = [
        'Context/SourceContext.php',
        'Database/DynamicConnectionFactory.php',
        'Cdm/CdmModel.php',
        'Results/ResultsModel.php',
        'Vocabulary/VocabularyModel.php',
        'Commands/LoadEunomiaCommand.php',
        'Commands/LoadVocabularies.php',
        'Commands/ComputeEmbeddings.php',
        'Commands/LoadIrsfCommand.php',
        'Commands/SolrIndexClaims.php',
        'PatientSimilarity/ConceptNameResolver.php',
        'Vocabulary/HierarchyBuilderService.php',
        'VocabularyController.php',
        'Commands/BuildConceptHierarchy.php',
    ];

    public function getNodeType(): string
    {
        return StaticCall::class;
    }

    /**
     * @return list<RuleError>
     */
    public function processNode(Node $node, Scope $scope): array
    {
        if (! $node instanceof StaticCall) {
            return [];
        }

        // Check if it's DB::connection(...)
        if (! $node->class instanceof Node\Name) {
            return [];
        }

        $className = $node->class->toString();
        if ($className !== 'DB' && ! str_ends_with($className, '\DB')) {
            return [];
        }

        if (! $node->name instanceof Node\Identifier || $node->name->name !== 'connection') {
            return [];
        }

        // Check the first argument
        if (count($node->getArgs()) === 0) {
            return [];
        }

        $arg = $node->getArgs()[0]->value;
        if (! $arg instanceof String_) {
            return [];
        }

        if (! in_array($arg->value, self::BANNED_CONNECTIONS, true)) {
            return [];
        }

        // Check if file is in the allowed list
        $file = $scope->getFile();
        foreach (self::ALLOWED_FILES as $allowed) {
            if (str_contains($file, $allowed)) {
                return [];
            }
        }

        return [
            RuleErrorBuilder::message(
                "Direct DB::connection('{$arg->value}') is banned. "
                .'Use the SourceAware trait: $this->cdm(), $this->results(), or $this->vocab(). '
                .'See docs/superpowers/specs/2026-03-26-cdm-source-isolation-design.md'
            )->build(),
        ];
    }
}
