# Parthenon Native i18n Availability Plan

Date: 2026-04-17

Owner: Product/Engineering

Status: Implementation started

## Implementation Progress

2026-04-17:

- Added per-user locale persistence with a topnav language selector.
- Added the initial supported locale registry for English, Spanish, French, German, Portuguese, Finnish, Japanese, Simplified Chinese, Korean, Hindi, Arabic, and an internal pseudolocale.
- Wired frontend i18next initialization, document `lang`/`dir` updates, locale request headers, formatter helpers, and shared shell translation resources.
- Localized the first shared shell slice: topnav, sidebar navigation, command palette, theme toggle, and language selector labels.
- Added backend locale negotiation middleware for user locale, `X-Parthenon-Locale`, query override, and `Accept-Language`.
- Added a Settings `Language & Region` tab with native-language labels and regional format previews.
- Converted user-profile API success/error messages to Laravel translation keys for the supported locale set.
- Localized the rest of Settings: profile details, avatar controls, account/security, and notification preferences.
- Added locale-aware contextual help lookup with English fallback metadata, localized help/changelog UI chrome, and a first Spanish dashboard help file as the content migration pattern.
- Localized the unauthenticated auth flow: login, registration, forgot-password, forced password change, OIDC callback states, and matching backend auth response messages.

## Executive Summary

Making Parthenon available "natively in all i18n languages" should be treated as a localization program, not a one-time string replacement task. The repository already has a useful frontend dependency base (`i18next` and `react-i18next`), and Laravel already exposes locale/fallback configuration, but Parthenon is not currently wired as a localized product.

The recommended goal is:

> Parthenon supports a declared set of production locales with native UI text, localized formatting, localized backend messages, localized help/email/export content, locale-aware clinical terminology where vocabulary data exists, and locale-aware AI responses, while falling back visibly and safely to English for unavailable clinical/source data.

The practical path is:

1. Build the locale architecture and coverage tooling first.
2. Extract English into stable translation keys without changing behavior.
3. Ship one pilot locale plus a pseudolocale and one RTL canary.
4. Expand language packs in waves with clinical/product review.

For full product coverage, the likely engineering effort is 8-14 weeks before translation review, then 1-3 weeks of translation/review/QA per production language depending on scope and translator availability. Supporting every possible BCP 47 language is not a finite release; supporting "all languages Parthenon offers" is a maintained language-pack program.

## Research Basis

External primary sources consulted:

- i18next documents language fallback, namespace fallback, and key fallback; for production it recommends setting fallback to a real language and supports namespace-based organization: https://www.i18next.com/principles/fallback
- react-i18next provides `useTranslation`, namespace loading, language changes, and Suspense behavior: https://react.i18next.com/latest/usetranslation-hook
- Laravel 12 localization supports locale and fallback locale configuration, per-request locale changes, keyed PHP language files, JSON translation files, placeholders, and pluralization: https://laravel.com/docs/12.x/localization
- i18next browser language detector can detect from query string, cookie, local storage, browser settings, HTML tag, path, or subdomain: https://github.com/i18next/i18next-browser-languageDetector
- i18next HTTP backend can lazy-load resources from `/locales/{{lng}}/{{ns}}.json`: https://github.com/i18next/i18next-http-backend
- JavaScript `Intl.NumberFormat` and `Intl.DateTimeFormat` provide language-sensitive number, currency, unit, date, and time formatting: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/NumberFormat and https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DateTimeFormat/DateTimeFormat
- Unicode CLDR plural rules show why plurals are not a simple singular/plural switch across languages: https://cldr.unicode.org/index/cldr-spec/plural-rules
- W3C Internationalization guidance recommends document-level `dir="rtl"` for RTL languages, `lang`, logical CSS properties, and `dir="auto"` for mixed-direction user/runtime text: https://www.w3.org/International/questions/qa-html-dir

Local repository audit commands included:

- `rg` searches for existing i18n/localization references.
- Package dependency inspection for i18next-related packages.
- Frontend TypeScript AST scan to estimate user-facing strings.
- Backend grep for hardcoded response/message strings.
- Help-content, route, user-profile, and settings endpoint review.

The AST counts are directional, not a final translation inventory. They intentionally overcount non-user strings so the plan does not underestimate effort.

## Current State Audit

### Frontend

Relevant files:

- `frontend/package.json`
- `frontend/src/main.tsx`
- `frontend/src/app/App.tsx`
- `frontend/src/app/router.tsx`
- `frontend/src/components/layout/Sidebar.tsx`
- `frontend/src/components/layout/Header.tsx`
- `frontend/src/components/layout/CommandPalette.tsx`
- `frontend/src/lib/api-client.ts`
- `frontend/src/stores/authStore.ts`
- `frontend/src/types/models.ts`
- `frontend/src/features/settings/**`

Findings:

- `i18next` and `react-i18next` are already installed.
- `i18next-browser-languagedetector`, `i18next-http-backend`, and `i18next-icu` are not currently listed.
- There is no app-level i18n initialization in `main.tsx` or `App.tsx`.
- The app has many hardcoded UI strings. Example: route/nav labels in `Sidebar.tsx`; header labels in `Header.tsx`; settings labels in `frontend/src/features/settings`.
- API requests do not send `Accept-Language` or an explicit Parthenon locale header.
- User type/model has no `locale`, `timezone`, or `preferred_language`.
- Settings/profile UI has no language preference field.
- Date, number, and sorting calls are scattered. A quick grep found about 609 `toLocale*`, `Intl`, `date-fns`, `d3.format`, or `localeCompare` call sites.
- There are at least 42 hardcoded `en-US` or `lang="en"` style references.
- A production frontend AST pass over 1,059 TS/TSX files found about:
  - 6,129 JSX text nodes.
  - 1,206 user-facing JSX attributes such as `placeholder`, `title`, `alt`, and `aria-label`.
  - 14,996 other string literal candidates.
  - 2,465 template string candidates.
  - 24,796 total candidates before triage.

Highest frontend extraction areas from the AST estimate:

- `features/administration`
- `features/data-explorer`
- `features/cohort-definitions`
- `features/studies`
- `features/patient-similarity`
- `features/etl`
- `features/standard-pros`
- `features/investigation`
- `features/auth`
- `features/commons`
- `features/analyses`
- `components`

### Backend

Relevant files:

- `backend/config/app.php`
- `backend/lang/en/finngen.php`
- `backend/routes/api.php`
- `backend/app/Http/Controllers/Api/V1/AuthController.php`
- `backend/app/Http/Controllers/Api/V1/UserProfileController.php`
- `backend/app/Http/Controllers/Api/V1/HelpController.php`
- `backend/app/Mail/*.php`
- `backend/resources/views/emails/*.blade.php`
- `backend/resources/views/exports/*.blade.php`
- `backend/resources/help/*.json`

Findings:

- Laravel has `APP_LOCALE`, `APP_FALLBACK_LOCALE`, and `APP_FAKER_LOCALE` configured.
- Only one app-specific backend translation file exists: `backend/lang/en/finngen.php`.
- `FinnGenErrorMapper` already uses `__()` for user-facing FinnGen errors. This is the best existing backend pattern.
- Many controllers return hardcoded English `message` or `error` strings.
- `AuthController::formatUser()` returns no locale/timezone preference.
- `UserProfileController` updates profile/avatar/theme but not language.
- Email templates are English-only and some use hardcoded `<html>` without `lang`/`dir`.
- `HelpController` reads `resources/help/{key}.json` without locale fallback.
- `backend/resources/help` has 56 JSON help files and about 228 KB of English help content.
- `frontend/public/help` has older/static help JSON as well; this should be reconciled or explicitly scoped.

### Clinical Vocabulary And Source Data

Relevant files:

- `backend/database/migrations/2026_03_01_150007_create_vocab_concept_synonyms_table.php`
- `backend/app/Jobs/Vocabulary/VocabularyImportJob.php`
- `backend/app/Console/Commands/LoadVocabularies.php`
- `backend/app/Services/Analysis/PatientProfileService.php`
- `backend/config/cdm-schema-v54.php`
- `frontend/src/features/etl/lib/cdm-schema-v54.ts`

Findings:

- The repository models OMOP `concept_synonym_name` with `language_concept_id`, which gives Parthenon a path to locale-aware concept search/display.
- CDM note language fields exist (`language_concept_id`) and patient notes display language.
- Clinical source values, imported source labels, OMOP concept names, and study/cohort titles are data, not product chrome. They cannot always be translated safely by the UI layer.
- "Native" clinical terminology should mean "prefer same-language vocabulary synonyms when available, otherwise fall back to canonical English/available source text with clear behavior."

### AI And Generated Narrative

Relevant areas:

- `frontend/src/components/layout/AbbyPanel.tsx`
- `backend/app/Services/AI/**`
- `backend/app/Http/Controllers/Api/V1/TextToSqlController.php`
- `backend/app/Http/Controllers/Api/V1/PublicationController.php`
- Study designer and cohort explanation flows.

Findings:

- Built-in Abby prompts and examples are English.
- Backend prompts request "natural language" answers but do not consistently include a target locale.
- SQL, OMOP JSON, code, and diagnostic logs must remain machine-readable and usually English/code-like, while explanations around them can be localized.

### Non-Web And Peripheral Surfaces

Potentially in scope depending on the product definition:

- `installer/gui_qt.py`
- `frontend/public/install/**`
- README/docs/public documentation.
- Export PDFs and generated documents.
- Admin broadcast emails.
- Survey invitation emails and public survey route.

These should not block the first web-app pilot, but they must be included before claiming full native product availability.

## Definition Of "Native Availability"

A locale is production-supported only when all criteria below are true:

1. Users can choose it in settings, and unauthenticated users can be served it by browser preference or URL/query override.
2. `<html lang>` and `<html dir>` are correct.
3. Navigation, layout, page titles, buttons, forms, modals, table headers, chart labels, validation text, empty states, toasts, help drawer content, public survey copy, and accessibility labels are translated.
4. API error/status messages shown to users are localized or mapped to localized frontend keys.
5. Dates, times, numbers, percentages, currency, units, pluralized phrases, and sorting use the active locale.
6. Emails and export documents generated by Parthenon use recipient/request locale when known.
7. Abby and other AI-generated explanations use the active locale by default, while code/SQL/artifacts remain intact.
8. Clinical terminology uses available same-language OMOP synonyms or clearly falls back to the canonical term.
9. English appears only for proper nouns, code identifiers, unavailable source data, untranslated user-generated content, logs, or documented fallback cases.
10. The locale has passed automated missing-key checks, pseudolocale checks, Playwright smoke tests, RTL tests if applicable, and human linguistic QA.

## Recommended Locale Strategy

Use BCP 47 tags in frontend/user settings and map them to Laravel directory names internally.

Examples:

- Frontend/user stored value: `en-US`, `es-ES`, `pt-BR`, `zh-Hans`, `ar`
- Laravel directory value: `en`, `es`, `pt_BR`, `zh_Hans`, `ar`
- Fallback chain examples:
  - `pt-BR -> pt -> en-US -> en`
  - `zh-Hant -> zh -> en-US -> en`
  - `en-GB -> en -> en-US`

Recommended initial set:

- Base: `en-US`
- Pseudolocale: `en-XA` or internal `pseudo`
- Pilot LTR language: `es-ES` or `fr-FR`
- RTL canary: `ar`
- Wave 1 production candidates: `es-ES`, `fr-FR`, `de-DE`, `pt-BR`, `fi-FI`, `ja-JP`, `zh-Hans`, `ko-KR`, `hi-IN`, `ar`

Rationale:

- `es`, `fr`, `de`, `pt-BR` cover common international product expectations.
- `fi-FI` is valuable because FinnGen is a major Parthenon feature.
- `ja-JP`, `zh-Hans`, and `ko-KR` expose East Asian layout, font coverage, line-breaking, and search/sort behavior.
- `hi-IN` exposes Indic-script shaping, Devanagari font coverage, Hindi plural/phrase behavior, and India-specific number/date formatting concerns.
- `ar` forces RTL, bidirectional text, and logical CSS discipline early.

Do not claim "all languages" until language-support tiers are explicit:

- Tier A: fully supported and QA-certified.
- Tier B: translated UI with English clinical/source fallback.
- Tier C: experimental/community language pack.
- Tier D: browser/AI may respond in language, but Parthenon UI is not certified.

## Translation AI Service Strategy

Current research date: 2026-04-17.

The best path for Parthenon is not to pick a single machine-translation engine and send every string through it. Native i18n needs four cooperating layers:

1. A translation management system (TMS) that owns keys, review state, translation memory, term bases, Git sync, and QA gates.
2. A machine-translation or generative-translation engine for first drafts.
3. An LLM reviewer/QA pass that enforces Parthenon-specific constraints such as ICU placeholders, clinical terms, and tone.
4. Human native/domain review for production Tier A locales, especially for clinical workflows and patient-facing copy.

### Recommended Stack

Primary recommendation:

- TMS and localization source of truth: Phrase Strings plus Phrase TMS/Language AI where licensed.
- Default AI translation drafting path: Phrase Language AI with Phrase Next GenMT and/or DeepL API Pro, depending on language pair and data classification.
- Broad-coverage and regulated fallback: Google Cloud Translation Advanced, Azure AI Translator, or Amazon Translate selected by the customer's existing cloud compliance posture and signed BAA status.
- LLM QA/rewrite pass: OpenAI API with Structured Outputs for schema-bound QA reports and translation corrections; use GPT-5.4-class models for high-value review where cost is acceptable and smaller models for bulk lint/rewrite where quality allows.
- Automated metric layer: Phrase QPS in the TMS, and optional offline COMET/XCOMET regression scoring for provider bakeoffs and release gates.

This stack keeps Parthenon vendor-flexible while still giving us a concrete implementation target. The repository should expose a provider abstraction, but the first production workflow should optimize for Phrase + DeepL/OpenAI because it gives the best combined coverage of developer workflow, translation memory, terminology control, contextual translation, review automation, and AI quality checks.

### Why Phrase Is The First TMS Choice

Phrase is the best fit for Parthenon's product-localization workflow because it directly matches the repository model:

- Phrase Strings integrates with GitHub repositories and uses a `.phrase.yml` file to define import/export paths, which maps cleanly to `frontend/src/i18n/**`, `frontend/public/locales/**`, and backend language files.
- Phrase Strings provides key-oriented software localization, while Phrase TMS covers larger help/docs/export/email content.
- Phrase Language AI acts as a central MT and agentic translation hub across Phrase products, can autoselect engines by domain/language pair, supports MT glossaries, and can run AI Translation Agent workflows.
- Phrase Next GenMT is especially relevant for product/help content because it uses generative AI, supports glossary use, tag handling, multi-segment context, locale variants, and real-time customization from translation memories.
- Phrase QPS predicts MQM-derived quality scores and is available in Phrase TMS, Phrase Language AI API, and Phrase Strings, making it useful for routing low-confidence segments to human review.
- Phrase Strings QA checks support length validation, placeholder usage, and term-base usage, which are exactly the checks that prevent broken React/i18next strings.

Primary sources:

- Phrase GitHub sync: https://support.phrase.com/hc/en-us/articles/5784125562012-GitHub-Strings
- Phrase Language AI: https://support.phrase.com/hc/en-us/articles/5709660879516-Phrase-Language-AI
- Phrase Next GenMT: https://support.phrase.com/hc/en-us/articles/14299433827996-Phrase-Next-GenMT
- Phrase QPS: https://support.phrase.com/hc/en-us/articles/5709672289180-Phrase-QPS-Overview
- Phrase Strings QA: https://support.phrase.com/hc/en-us/articles/5820046486684-Quality-Assurance-Strings

Runner-up: Lokalise. Lokalise is a credible alternative if the team wants a lighter developer-first TMS with strong AI translation workflow, translation memory, and glossary support. Lokalise AI Translations currently documents GPT-5/Claude-backed routing, custom instructions, glossary/style-guide enrichment, and API task workflows. The drawback is that Phrase has a more complete enterprise MT hub, QPS/MQM story, and Strings/TMS split that better matches Parthenon's mix of software strings plus help/docs/export content.

Primary sources:

- Lokalise translation memory: https://docs.lokalise.com/en/articles/1409589-translation-memory
- Lokalise glossary: https://docs.lokalise.com/en/articles/1400629-glossary
- Lokalise AI Translations: https://docs.lokalise.com/en/articles/8011393-ai-translations

### Translation Engine Roles

DeepL API Pro should be the preferred product-copy draft engine where supported and where data classification allows it.

- DeepL supports API glossaries, including v3 multilingual glossary management.
- DeepL's context parameter is useful for ambiguous short UI/help snippets, but DeepL explicitly warns that this parameter is not a replacement for LLM-style instructions or glossary rules.
- DeepL recommends next-gen/quality-optimized translation paths for highest quality and supports many of the current target languages, including Korean and Hindi.

Use DeepL for:

- UI strings.
- Help articles.
- Product documentation.
- Email/export copy that contains no PHI or sensitive customer data.
- High-quality LTR and CJK/Korean/Hindi first drafts where language-pair results pass our bakeoff.

Do not use DeepL as the only source of truth for:

- Clinical concept semantics.
- Patient-generated content.
- PHI-bearing runtime content unless Legal/Security explicitly approve the contract and data path.
- SQL, JSON, identifiers, logs, code, placeholders, or OMOP/CDM field names.

Primary sources:

- DeepL text API and next-gen model guidance: https://developers.deepl.com/api-reference/translate
- DeepL v3 glossaries: https://developers.deepl.com/api-reference/multilingual-glossaries
- DeepL context parameter guidance: https://developers.deepl.com/docs/learning-how-tos/examples-and-guides/how-to-use-context-parameter
- DeepL supported languages: https://developers.deepl.com/docs/getting-started/supported-languages

Google Cloud Translation Advanced should be the enterprise broad-coverage fallback and one candidate for regulated deployments.

- It supports 100+ language pairs, language detection, glossary support, batch translation, document translation, regional endpoints, IAM, and Translation LLM/adaptive translation options.
- Adaptive translation can use example sentence pairs or datasets to tailor output to Parthenon's domain.
- Google states that Cloud Translation does not use customer data or translations to improve Cloud Translation API models.
- Google Cloud HIPAA use requires reviewing and accepting Google's BAA and building on approved services/configuration.

Use Google when:

- A target locale is weak in DeepL or Phrase.
- We need Translation LLM/adaptive translation behavior with domain examples.
- The deployment already runs on Google Cloud with an approved BAA/compliance path.

Primary sources:

- Cloud Translation API overview: https://docs.cloud.google.com/translate/docs/api-overview
- Adaptive translation: https://docs.cloud.google.com/translate/docs/advanced/adaptive-translation
- Google Cloud HIPAA: https://cloud.google.com/security/compliance/hipaa-compliance

Azure AI Translator should be the Microsoft-cloud option.

- Azure Custom Translator supports dictionaries/glossaries, dynamic dictionary, neural phrase dictionary, and custom training.
- Microsoft documents that Azure AI Translator text translation does not store customer data, while document translation temporarily stores data during processing and removes it after processing.
- Azure is attractive when customers already have Microsoft enterprise agreements, tenant controls, or healthcare compliance workflows.

Use Azure when:

- The customer environment is Azure-centered.
- We need no-trace text translation behavior.
- We want Custom Translator with neural phrase dictionary for controlled terminology.

Primary sources:

- Azure Custom Translator dictionaries: https://learn.microsoft.com/en-us/azure/ai-services/translator/custom-translator/concepts/dictionaries
- Azure AI Translator data/privacy/security: https://learn.microsoft.com/en-us/azure/ai-foundry/responsible-ai/translator/data-privacy-security

Amazon Translate should be the AWS-cloud option.

- It supports custom terminology for brand/domain terms.
- AWS lists Amazon Translate as a HIPAA Eligible Service, subject to the shared responsibility model and signed BAA requirements.
- AWS terminology best practices emphasize keeping terminology uncluttered, handling case sensitivity, and avoiding conflicting translations.

Use Amazon Translate when:

- A Parthenon deployment is already AWS-centered.
- The customer has an AWS BAA and wants to keep translation workloads inside AWS.
- The requirements are high-volume, cost-sensitive translation with terminology control rather than the highest product-copy fluency.

Primary sources:

- Amazon Translate custom terminology: https://docs.aws.amazon.com/translate/latest/dg/how-custom-terminology.html
- Amazon Translate terminology best practices: https://docs.aws.amazon.com/translate/latest/dg/ct-best-practices.html
- AWS HIPAA Eligible Services reference: https://aws.amazon.com/compliance/hipaa-eligible-services-reference/

OpenAI should be used as the translation QA, constraint enforcement, and localized AI-response layer, not as the only localization system.

- Structured Outputs enforce JSON Schema adherence, which is ideal for returning translation QA reports with `locale`, `key`, `severity`, `placeholderIssues`, `terminologyIssues`, `suggestedFix`, and `needsHumanReview`.
- Batch API is useful for asynchronous large-scale QA and rewrite jobs.
- OpenAI states that API Platform business data is not used for model training by default.
- OpenAI API PHI use requires a BAA with OpenAI; OpenAI documents that most API services are covered, with exceptions.
- GPT-5.4 is currently documented as the default model for important general-purpose and coding work; use it for high-value QA/rewrite and use smaller variants only after bakeoff.

Use OpenAI for:

- "Translate this key while preserving ICU/i18next placeholders exactly" structured jobs.
- "Review this translation against source, glossary, and tone guide" jobs.
- Locale-specific Abby responses and explanations.
- Help text refinement after raw MT.
- Detecting unlocalized source terms, broken placeholders, suspect clinical terminology, and untranslated English.

Do not use OpenAI for:

- PHI-bearing text without a signed BAA and endpoint eligibility review.
- Fully automated publication of clinical guidance without human review.
- Direct translation of code, SQL, identifiers, logs, or OMOP concept IDs.

Primary sources:

- OpenAI Structured Outputs: https://platform.openai.com/docs/guides/structured-outputs
- OpenAI Batch API: https://platform.openai.com/docs/guides/batch
- OpenAI enterprise privacy: https://openai.com/enterprise-privacy/
- OpenAI API BAA guidance: https://help.openai.com/en/articles/8660679-how-can-i-get-a-business-associate-agreement-baa-with-openai-for-the-api-services
- GPT-5.4 API guide: https://developers.openai.com/api/docs/guides/latest-model

### Data Classification Rules

All translation calls must be classified before leaving Parthenon:

- Class 0: product UI strings, generic help text, docs, validation messages. External TMS/MT/LLM allowed after vendor DPA/security approval.
- Class 1: deployment-specific but non-PHI labels, study titles, workspace names, organization-specific configuration. External translation allowed only when customer contract permits it; otherwise local/customer-approved provider only.
- Class 2: clinical terminology from controlled vocabularies. Prefer OMOP synonyms, curated termbase, and source vocabularies; do not free-translate concept IDs or canonical code labels as if they were ordinary prose.
- Class 3: PHI, patient notes, row-level patient data, user-uploaded documents, private comments. Do not send to third-party translation services unless the specific provider, endpoint, region, and BAA/DPA are approved for PHI.
- Class 4: code-like artifacts such as SQL, JSON, CDM field names, API payload keys, logs, identifiers, cohort JSON, concept IDs. Never translate. Localize surrounding explanation only.

The default implementation should allow Class 0 through the Phrase/DeepL/OpenAI workflow, block Class 3, and mark Class 1/2 for explicit policy approval.

### Best-Practice Localization Rules

Follow these rules regardless of provider:

- Use stable semantic keys, not source-English-as-key, for product UI.
- Preserve i18next/ICU placeholders exactly. Translation QA must fail if `{count}`, `{{name}}`, `<0>...</0>`, or HTML/tag placeholders differ.
- Use CLDR plural categories instead of English singular/plural assumptions.
- Set document `lang` and `dir` from the selected locale and use markup, not CSS alone, for bidi direction.
- Use `dir="auto"` or equivalent isolation for mixed-direction user/runtime text.
- Prefer logical CSS properties (`margin-inline-start`, `padding-inline-end`, etc.) as the UI is converted.
- Store a product termbase with "do not translate" entries for Parthenon, Abby, OMOP, OHDSI, CDM, SQL, ICD, SNOMED, LOINC, RxNorm, Atlas, cohort, concept set, and other clinical/product terms.
- Keep translation memory and glossary assets under exportable formats such as TMX/CSV/TSV so Parthenon is not locked to one vendor.
- Require human review for Tier A languages before release, then allow AI+QPS routing to reduce review scope on future diffs.

Primary standards/sources:

- W3C HTML i18n authoring guidance: https://www.w3.org/International/techniques/authoring-html/i18n-html
- Unicode CLDR plural rules: https://cldr.unicode.org/index/cldr-spec/plural-rules
- i18next fallback principles: https://www.i18next.com/principles/fallback

### Bakeoff Plan

Before committing production spend, run a one-week provider bakeoff.

Sample set:

- 250 UI strings across navigation, settings, auth, cohort definitions, study designer, data explorer, ETL, and admin.
- 25 long help sections.
- 50 clinical/product terminology snippets.
- 25 validation/error/toast strings with placeholders.
- 25 RTL/mixed-direction strings.
- 25 CJK/Korean/Hindi strings that stress spacing, line-breaking, and formality.

Providers to test:

- Phrase Next GenMT through Phrase Language AI.
- DeepL API Pro with glossary/context where applicable.
- Google Cloud Translation Advanced with glossary/adaptive examples.
- Azure AI Translator with Custom Translator/dictionary where applicable.
- Amazon Translate with custom terminology if AWS deployment support is required.
- OpenAI GPT-5.4 as QA/rewrite layer, not as a raw MT-only competitor.

Scoring:

- Placeholder/tag parity: must be 100%.
- JSON/ICU validity: must be 100%.
- Termbase compliance: target 98%+ on controlled product terms.
- Native reviewer acceptability: target 90%+ "publish or minor edit" for UI strings and 80%+ for help drafts.
- COMET/XCOMET or Phrase QPS: use as a ranking/regression signal, not as the sole release gate.
- Human MQM-style review: required for the final top two providers in `es-ES`, `ar`, `ja-JP`, `ko-KR`, and `hi-IN`.
- Security/legal status: provider must pass DPA/BAA/region requirements before handling anything beyond Class 0.

### Service Abstraction To Implement

Add a backend-only translation orchestration service after the current UI language selector work:

- `TranslationProviderInterface`
  - `translateBatch(TranslationBatchRequest $request): TranslationBatchResult`
  - `reviewBatch(TranslationReviewRequest $request): TranslationReviewResult`
  - `supportsLocale(string $source, string $target): bool`
  - `supportsDataClass(TranslationDataClass $class): bool`
- Provider adapters:
  - `PhraseTranslationProvider`
  - `DeepLTranslationProvider`
  - `GoogleTranslationProvider`
  - `AzureTranslationProvider`
  - `AmazonTranslationProvider`
  - `OpenAiTranslationReviewProvider`
- Shared services:
  - `TranslationPolicyService` for data-class gating.
  - `PlaceholderIntegrityService` for ICU/i18next/tag parity.
  - `TerminologyService` for termbase and do-not-translate rules.
  - `LocaleAssetExporter` to generate TMS upload files from frontend/backend namespaces.
  - `LocaleAssetImporter` to validate and import reviewed translations back into the repo.

Provider configuration should be environment-driven and tenant-aware:

- `TRANSLATION_PROVIDER_PRIMARY=phrase`
- `TRANSLATION_PROVIDER_MT=deepl`
- `TRANSLATION_PROVIDER_REVIEW=openai`
- `TRANSLATION_PROVIDER_REGULATED=google|azure|aws|none`
- `TRANSLATION_ALLOW_PHI=false` by default
- per-provider API keys, region, endpoint, glossary IDs, and project IDs

No browser client should call external translation APIs directly. All translation service calls must happen server-side so keys, logs, redaction, rate limits, and audit trails are controlled.

### Immediate Resolution

Proceed with Phrase-first localization workflow design, but do not hard-wire Phrase into runtime user flows. Implement Parthenon's local locale files, extraction checks, provider-neutral translation orchestration, and import/export contract first.

Recommended next implementation step:

1. Add a `translation_assets` tooling path that exports frontend/backend locale namespaces to a TMS-ready JSON/CSV bundle.
2. Add placeholder/term QA scripts that run locally and in CI.
3. Add provider-neutral backend service interfaces and a no-op/local-file provider.
4. Add a DeepL/OpenAI prototype behind feature flags for Class 0 strings only.
5. Run the bakeoff before purchasing or committing to production provider credentials.

## Target Architecture

### Frontend Locale Module

Add:

- `frontend/src/i18n/i18n.ts`
- `frontend/src/i18n/locales.ts`
- `frontend/src/i18n/format.ts`
- `frontend/src/i18n/plural.ts` if needed
- `frontend/public/locales/{locale}/{namespace}.json` or `frontend/src/locales/{locale}/{namespace}.json`

Recommended config:

- Use `i18next` with `initReactI18next`.
- Use namespaces by domain: `common`, `layout`, `auth`, `settings`, `dashboard`, `administration`, `cohort-definitions`, `concept-sets`, `data-explorer`, `ingestion`, `analyses`, `studies`, `profiles`, `vocabulary`, `commons`, `help`, `errors`.
- Use stable semantic keys, not English source strings, for frontend product UI.
- Set `fallbackLng` to English, not `dev`.
- Set `returnEmptyString: false`.
- Add browser detection only after user preference precedence is defined.
- Prefer lazy namespace loading so the initial bundle does not include every language.

Add dependencies if using HTTP/lazy public assets:

- `i18next-browser-languagedetector`
- `i18next-http-backend`

Consider `i18next-icu` only if the product needs ICU message syntax for complex gender/select/plural messages. i18next has plural support already, but CLDR categories make complex clinical copy easier with ICU.

### Frontend Locale Preference Flow

Order of locale resolution:

1. Explicit user profile setting, if authenticated.
2. Query parameter such as `?lng=es-ES` for QA/deep links.
3. Locally cached setting for unauthenticated users.
4. Browser language.
5. System default.
6. English fallback.

Persist:

- `users.locale`
- `users.timezone`
- optional `users.numbering_system`
- optional `users.first_day_of_week`

Frontend behavior:

- Add a Language & Region section to Settings.
- Update `document.documentElement.lang`.
- Update `document.documentElement.dir`.
- Send `Accept-Language` and `X-Parthenon-Locale` from `api-client.ts`.
- Expose `useLocale()` and `useFormatter()` hooks.

### Formatting Layer

Create locale-aware helpers:

- `formatDate(date, preset)`
- `formatDateTime(date, preset)`
- `formatTime(date, preset)`
- `formatRelativeTime(date)`
- `formatNumber(value, options)`
- `formatPercent(value, options)`
- `formatCurrency(value, currency, options)`
- `formatUnit(value, unit, options)`
- `makeCollator(options)`

Replace direct `toLocaleString`, `toLocaleDateString`, `new Intl.NumberFormat()`, hardcoded `en-US`, `date-fns` formatting strings, and direct `localeCompare` where user-visible order matters.

Important policy:

- Locale controls formatting.
- Currency remains a data/business value, not automatically changed by locale.
- Scientific/statistical output should preserve agreed precision and symbols.
- SQL, JSON, identifiers, OMOP concept IDs, and diagnostic logs should not be localized.

### Backend Locale Middleware

Add:

- `backend/config/parthenon-locales.php`
- `backend/app/Http/Middleware/SetRequestLocale.php`
- migration for `users.locale` and `users.timezone`
- profile update request changes
- auth user response changes

Middleware responsibilities:

- Resolve locale from authenticated user, `X-Parthenon-Locale`, `Accept-Language`, or default.
- Validate against supported locale list.
- Map BCP 47 to Laravel locale names.
- Call `App::setLocale($laravelLocale)`.
- Set Carbon locale where useful.
- Optionally expose locale in response header for diagnostics.

Backend translation organization:

- `backend/lang/en/api.php`
- `backend/lang/en/auth.php`
- `backend/lang/en/profile.php`
- `backend/lang/en/emails.php`
- `backend/lang/en/help.php`
- `backend/lang/en/finngen.php`
- Laravel validation translations from published language files.

Use keyed PHP arrays for API and email messages. Avoid Laravel JSON translation files for core backend code unless there is a specific translator-workflow reason; stable keys make API and frontend mapping easier.

### API Error Contract

Move toward a stable localized envelope:

```json
{
  "code": "PROFILE_AVATAR_SAVE_FAILED",
  "message": "Failed to save avatar file",
  "message_key": "profile.avatar_save_failed",
  "params": {}
}
```

Rules:

- API `message` may be localized for direct display.
- `code` and `message_key` stay stable for frontend fallback.
- Logs and audit trails store codes/raw details, not translated strings.
- Validation errors use Laravel translation and field label maps.
- Upstream/service errors should be classified and mapped when shown to users.

### Help, Changelog, Emails, And Exports

Help:

- Move to `backend/resources/help/{locale}/{key}.json`.
- Implement fallback chain in `HelpController`.
- Include `locale` and `fallback_used` in development responses or logs.
- Reconcile `frontend/public/help` with backend help. Prefer one source of truth.

Changelog:

- Short term: English-only with clear label.
- Production native: localize release-note headings and user-facing release notes per locale, or show English changelog outside the "native" certification criteria.

Emails:

- Translate subjects in `Mailable::envelope()`.
- Translate Blade copy with `__()`.
- Add `<html lang="{{ str_replace('_', '-', app()->getLocale()) }}" dir="{{ ... }}">`.
- Localize dates in survey invitation expiration text.
- Use recipient locale where known; otherwise request/system fallback.

Exports:

- Translate static labels in export views.
- Use locale-aware date/number formatting.
- Keep raw scientific results/code/identifiers unchanged.
- Decide whether exported documents are generated in the viewer locale, study locale, or requested export locale.

### Clinical Vocabulary And Data

Add a locale-aware terminology policy:

- Product UI copy: always translated for supported locales.
- OMOP concept display: prefer same-language `concept_synonym_name` when available.
- OMOP canonical concept name: fallback when synonym unavailable.
- Source values: do not machine-translate automatically; display source text unless a curated mapping exists.
- User-generated content: preserve original text; optionally show AI-assisted translation only as an explicit secondary action with governance.
- Clinical notes: preserve original; use `language_concept_id` to label and route display behavior.

Implementation tasks:

- Add locale-to-OMOP-language-concept mapping.
- Extend vocabulary/concept search endpoints with `locale`.
- Return `display_name`, `display_locale`, `canonical_name`, and `fallback_reason` where useful.
- Add indexes for synonym lookup by `concept_id` and `language_concept_id` if not already present.
- Add frontend UI affordance for fallback, especially in clinical decision workflows.

### Abby And AI

Add locale to AI request context:

- `locale`
- `language_name`
- `direction`
- `output_language_policy`

Prompt policy:

- Answer in the user's active language unless the user explicitly asks otherwise.
- Keep SQL, JSON, code, OMOP identifiers, file paths, and exact clinical terms unchanged unless explaining them.
- For text-to-SQL: user question may be non-English; generated SQL remains SQL; explanation/local errors use active locale.
- For cohort generation: allow non-English prompts, but persist design artifacts as structured JSON with localized display strings separate from stable identifiers.
- For publication/narrative generation: generate in requested manuscript language and preserve regulatory/statistical terminology.

Governance:

- Do not send PHI/user clinical content to external translation services without product/security approval.
- Machine-translated clinical content must be labeled unless reviewed.
- Translation memory/glossary should include Parthenon terms, OHDSI terms, OMOP domains, and Abby vocabulary.

### RTL And Layout

Add a direction metadata map:

```ts
{
  "en-US": { dir: "ltr" },
  "ar": { dir: "rtl" },
  "he": { dir: "rtl" }
}
```

Required CSS/UI changes:

- Replace directional spacing with logical properties where product layout should mirror.
- Avoid hardcoded `left`/`right` in user-facing layout except intentional spatial UI like charts/maps.
- Use `text-align: start/end` for text.
- Add `dir="auto"` to user-generated inputs, chat messages, notes, comments, wiki content, study descriptions, and source data display.
- Check tables, drawers, modals, command palette, charts, maps, and sidebars in RTL.
- Ensure icons that imply direction are mirrored only when semantically appropriate.

## Extraction And Tooling Plan

### String Inventory

Create scripts:

- `frontend/scripts/i18n-scan.ts`
- `frontend/scripts/i18n-extract.ts`
- `frontend/scripts/i18n-coverage.ts`
- `backend/artisan parthenon:i18n-scan` or a PHP script for backend messages.

Scanner should classify:

- JSX text.
- JSX attributes: `title`, `aria-label`, `placeholder`, `alt`, `label`.
- Toast/error strings.
- Button labels.
- Table/chart labels.
- Empty-state text.
- Template literals.
- Backend response messages.
- Blade static text.
- Help JSON content.

Allowlist:

- Routes and API paths.
- CSS classes.
- Permission names and role identifiers.
- Query keys.
- SQL and code snippets.
- Proper nouns and product names.
- Test strings when not user-facing.

### CI Gates

Add gates gradually:

1. Warn-only missing extraction report.
2. Fail on new hardcoded JSX text in migrated namespaces.
3. Fail on missing English base keys.
4. Fail on missing supported-locale keys for Tier A languages.
5. Fail on unsafe localized interpolation, missing variables, or broken JSON.

Suggested checks:

- Translation JSON schema validation.
- Key parity across locales.
- Interpolation variable parity.
- Plural form coverage.
- No duplicate keys with conflicting English.
- Pseudolocale build.
- `./deploy.sh --frontend` for shipped assets, per repository instruction.

### Pseudolocalization

Add pseudolocale early:

- Expand strings by 25-40%.
- Add bracket markers.
- Preserve interpolation tokens.
- Preserve code fragments.
- Optionally simulate RTL with a separate pseudolocale.

Use it to catch:

- Truncation.
- Fixed-width buttons.
- Bad table headers.
- Hardcoded English.
- Missing keys.
- Layout shifts.

## Implementation Phases

### Phase 0: Decisions And Scope Lock

Duration: 3-5 days

Deliverables:

- Confirm initial supported locale list.
- Confirm what "native" includes for v1: web app, public survey, emails, help, exports, installer, docs.
- Choose translation storage location: repo JSON, backend-served JSON, or external TMS integration.
- Decide if machine translation can be used for drafts.
- Decide review level for clinical/medical text.
- Define terminology glossary owners.

Acceptance:

- Written scope and tier definitions.
- Locale list with BCP 47 tags, native names, direction, fallback chain, and support tier.

### Phase 1: Foundation

Duration: 2-3 weeks

Frontend tasks:

- Add i18n module and locale registry.
- Wire `main.tsx`/`App.tsx` to initialize i18n.
- Add language detector or custom resolver.
- Add locale settings UI.
- Add locale-aware request headers in `api-client.ts`.
- Add formatter helpers.
- Add pseudolocale.
- Convert layout/navigation/header/settings/auth shell to translation keys.

Backend tasks:

- Add user `locale` and `timezone` migration.
- Add fillable/casts/type updates.
- Add locale middleware.
- Add localized profile/settings endpoints.
- Add base `lang/en/*.php` structure.
- Convert existing FinnGen translation pattern into broader API pattern.

Acceptance:

- User can change language setting and see shell/nav/settings update.
- Browser preference works for unauthenticated login/register.
- `Accept-Language` and `X-Parthenon-Locale` flow to backend.
- HTML `lang`/`dir` updates.
- Pseudolocale shows expanded shell text.
- Existing tests pass.

### Phase 2: Frontend Extraction Waves

Duration: 4-8 weeks

Wave A: shared app shell and public/entry flows

- Layout, header, sidebar, command palette.
- Auth/login/register/OIDC callback.
- Settings/profile/security/notifications.
- Help slide-over shell.
- Toast and shared UI components.
- Public shared cohort and public survey routes.

Wave B: research core

- Cohort definitions.
- Concept sets.
- Vocabulary.
- Studies/study designer/study packages.
- Analyses hub and detail pages.
- Jobs.

Wave C: data and admin

- Data sources.
- Ingestion/ETL/aqueduct/source profiler.
- Data explorer/Ares/DQD.
- Administration pages.
- System health/service detail.

Wave D: specialized modules

- Patient profiles.
- Patient similarity.
- Risk scores.
- Standard PROs.
- Genomics/FinnGen.
- Imaging.
- HEOR/GIS/Morpheus.
- Commons/wiki/messages.
- Publish/investigation/exports.

Acceptance:

- Migrated namespaces have no new hardcoded user-facing JSX text.
- English namespace files are complete for each migrated feature.
- Pseudolocale passes smoke navigation.
- At least one pilot locale can navigate migrated flows.

### Phase 3: Backend, Help, Emails, And Exports

Duration: 2-4 weeks, overlaps Phase 2

Tasks:

- Convert common API response messages to keyed translations.
- Localize Laravel validation messages and field labels.
- Implement help locale fallback.
- Localize email subjects and Blade templates.
- Localize export labels.
- Decide changelog behavior.
- Add backend tests for locale negotiation and fallback.

Acceptance:

- API returns localized messages for common profile/auth/help/admin errors.
- Help content resolves `{locale}/{key}.json` with fallback.
- Emails render with correct `lang`/`dir`.
- Export labels are localized where product-owned.

### Phase 4: Clinical Terminology And AI

Duration: 3-5 weeks for first pass

Tasks:

- Map supported locales to OMOP language concepts.
- Prefer localized synonyms in vocabulary search/detail responses.
- Add concept fallback metadata.
- Add active locale to Abby and AI endpoints.
- Update AI prompts to respond in active locale.
- Add tests for non-English prompts and localized explanations.
- Add glossary/terminology file for translators and AI prompts.

Acceptance:

- Vocabulary search can show same-language synonym when available.
- Missing synonym falls back safely.
- Abby answers in active locale for general explanations.
- SQL/code outputs remain intact.
- AI-generated clinical text has review/governance language in place.

### Phase 5: RTL, Accessibility, And Visual QA

Duration: 1-3 weeks

Tasks:

- Add RTL canary locale.
- Convert major directional CSS to logical properties.
- Add Playwright tests for LTR, pseudolocale, and RTL smoke routes.
- Verify keyboard/focus behavior in mirrored layouts.
- Verify `dir="auto"` in user-generated and source-data text.
- Run accessibility checks for labels and language attributes.

Acceptance:

- Arabic/Hebrew canary renders without major layout breakage in shell, tables, forms, drawers, modals, and chat/wiki content.
- Screenshots show no clipped primary actions under pseudolocale.
- Accessibility labels are translated or intentionally stable.

### Phase 6: Translation Production And Release

Duration: 1-3 weeks per production locale, parallelizable

Tasks:

- Export strings to translators/TMS.
- Translate product UI.
- Translate help content and emails.
- Review clinical/research terminology.
- Import translations.
- Run automated parity checks.
- Linguistic QA by native reviewer.
- Product QA in target workflows.
- Release as Tier A or Tier B language.

Acceptance:

- Translation coverage meets threshold.
- Human reviewer signs off.
- No critical UI truncation.
- No clinical terminology blockers.
- Known fallback cases documented.

## Detailed Work Breakdown

### Epic 1: Locale Model And User Preference

Tasks:

- Add `locale` and `timezone` columns to `users`.
- Update `User` fillable/casts.
- Update auth response format.
- Update frontend `User` type.
- Add `Language & Region` settings panel.
- Update profile API payloads.
- Persist language changes optimistically and rollback on error.
- Add unauthenticated language preference storage.

Tests:

- User locale persists across login/logout.
- Auth user includes locale/timezone.
- Frontend applies locale after auth hydration.

### Epic 2: Frontend i18n Runtime

Tasks:

- Add `SUPPORTED_LOCALES`.
- Add `getLocaleDirection`.
- Initialize i18next before render.
- Add namespace loader.
- Add pseudolocale generator.
- Add missing-key logger in development.
- Add Suspense/loading behavior or `useSuspense: false`.

Tests:

- `t()` resolves common/layout keys.
- Fallback language works.
- Missing keys are surfaced in development.
- Pseudolocale preserves interpolation.

### Epic 3: Shared Components And Navigation

Tasks:

- Localize `Sidebar` nav labels and help labels.
- Localize `Header`, `UserDropdown`, source selector placeholders.
- Localize `CommandPalette`.
- Localize shared `Button`, `DataTable`, `Drawer`, `Modal`, `Toast`, `EmptyState`, `CodeBlock`.
- Ensure `aria-label`, `title`, `alt`, and placeholders are translated.

Tests:

- Navigation labels change by locale.
- Command palette search still finds translated labels and stable keywords.
- Accessibility name snapshots update.

### Epic 4: Formatter Migration

Tasks:

- Implement formatter helpers.
- Replace direct `toLocale*` calls.
- Replace hardcoded `en-US`.
- Replace user-visible `localeCompare` with `Intl.Collator`.
- Create date/time presets: `shortDate`, `mediumDate`, `dateTime`, `time`, `monthYear`.
- Create number presets: integer, compact, decimal, percent, currency, unit.

Tests:

- Dates differ correctly between `en-US`, `de-DE`, and `ja-JP`.
- Arabic locale can use appropriate digits where runtime supports it.
- Sorting respects locale collator in at least one tested list.

### Epic 5: Backend Localization

Tasks:

- Add middleware and config.
- Convert auth/profile/common controller messages.
- Add validation language files.
- Convert FinnGen file structure as model for more domains.
- Add response helper for localized error envelopes.
- Add tests for locale headers and user preference precedence.

Tests:

- `X-Parthenon-Locale: es-ES` returns Spanish profile success/error after translations exist.
- Unsupported locale falls back safely.
- Validation errors localize field labels.

### Epic 6: Help And Content

Tasks:

- Move help files into locale folders.
- Implement fallback lookup.
- Add translation schema validation for help JSON.
- Localize `HelpSlideOver` static labels.
- Decide whether `frontend/public/help` is deprecated or separately localized.

Tests:

- Existing help key resolves in English.
- Missing locale file falls back to English.
- Missing key returns localized "not found" message.

### Epic 7: Emails And Exports

Tasks:

- Add email translation keys.
- Update `TempPasswordMail`, `AdminBroadcastMail`, survey invitation mail.
- Add locale-aware date formatting in email views.
- Add `lang`/`dir`.
- Translate investigation dossier static labels.
- Define export locale parameter.

Tests:

- Email snapshots for English and pilot locale.
- RTL email smoke rendering.
- Export snapshot labels localized.

### Epic 8: Clinical Terminology

Tasks:

- Create locale-to-OMOP-language-concept map.
- Update vocabulary search/details endpoints.
- Update frontend concept display components.
- Add fallback indicator where useful.
- Add docs for what clinical data is not translated.

Tests:

- A seeded synonym in target language displays.
- Missing synonym falls back to canonical concept name.
- Source values remain unchanged.

### Epic 9: AI Localization

Tasks:

- Add locale metadata to Abby payloads.
- Update backend AI services to include target language instruction.
- Add locale-specific glossary context.
- Add policy to preserve SQL/JSON/code.
- Add tests with non-English prompts.

Tests:

- Abby general answer in pilot locale.
- Text-to-SQL accepts pilot-language prompt and emits SQL.
- Cohort explanation localizes prose but preserves concept identifiers.

### Epic 10: Governance And Translation Operations

Tasks:

- Select translation workflow: repo PRs, TMS, vendor, or hybrid.
- Create glossary: Parthenon, Abby, OHDSI, OMOP, CDM, cohort, concept set, incidence rate, estimation, prediction, SCCS, HEOR, DQD, Ares, FinnGen.
- Create style guide by language.
- Define reviewer roles.
- Define fallback and versioning policy.
- Add translation release checklist.

Acceptance:

- Translation updates are reviewable.
- Product owners can see coverage.
- New feature PRs cannot silently add English-only UI after migration.

## Testing Strategy

Unit tests:

- Locale resolver.
- Formatter helpers.
- Pseudolocale transformer.
- Translation key parity.
- Laravel middleware.
- Help fallback.
- Backend localized response helper.

Integration tests:

- Login/register/profile/settings.
- API error localization.
- Vocabulary synonym lookup by locale.
- Abby locale propagation.

Playwright/e2e:

- `en-US` baseline smoke.
- Pseudolocale smoke across core routes.
- Pilot locale smoke.
- RTL canary smoke.
- Public survey route.
- Shared cohort route.

Visual checks:

- Header/sidebar.
- Tables with long translated headers.
- Modals and drawers.
- Charts and legends.
- Command palette.
- Forms with validation.
- Chat/wiki/user-generated content with mixed LTR/RTL.

Accessibility checks:

- `html[lang]`.
- `html[dir]`.
- Translated accessible names.
- No English-only `aria-label`.
- Keyboard navigation in RTL.

Performance checks:

- Initial bundle size before/after.
- Locale namespace lazy loading.
- Cache headers for locale JSON.
- Avoid loading all languages for every user.

## Release Plan

### Milestone 1: i18n Foundation Demo

Scope:

- Shell/nav/header/settings/auth.
- User language preference.
- Pseudolocale.
- Backend locale middleware.

Exit:

- Demo switching English/pseudolocale/pilot locale without reload where possible.

### Milestone 2: Research Core Pilot

Scope:

- Cohort definitions, concept sets, vocabulary, analyses/studies landing pages.
- Help fallback.
- Common backend messages.

Exit:

- Pilot locale supports a researcher creating/finding a cohort and navigating core workflows.

### Milestone 3: Full Web App Extraction

Scope:

- All major frontend features.
- Admin/data/ETL modules.
- Public survey/shared cohort.

Exit:

- English extracted; pseudolocale coverage near complete; hardcoded English gate active.

### Milestone 4: Native Pilot Locale Release

Scope:

- Pilot locale translated and reviewed.
- Emails/help/public flows included.
- AI locale-aware for key workflows.

Exit:

- Tier A pilot release.

### Milestone 5: Language Pack Expansion

Scope:

- Add Wave 1 locales.
- RTL canary promoted when ready.

Exit:

- Language packs released in tiers with documented fallback.

## Estimates

Engineering:

- Foundation: 2-3 weeks.
- Full English extraction and tooling: 6-10 weeks.
- Backend/content/email/export localization: 2-4 weeks, partially parallel.
- Clinical terminology and AI localization first pass: 3-5 weeks.
- RTL hardening: 1-3 weeks.

Translation/review:

- Pilot locale: 2-4 weeks including QA.
- Additional LTR locale after pipeline is stable: 1-3 weeks.
- RTL locale: 2-4 weeks, because layout QA is heavier.
- Clinical/research-heavy locale pack: add review time.

Team model:

- 1 frontend lead.
- 1 backend lead.
- 1 QA/playwright owner.
- 1 product/content owner.
- Translator/reviewer per locale.
- Clinical terminology reviewer for research/medical copy.

Calendar expectation:

- Pilot native locale: about 8-12 weeks from start if scoped tightly.
- Broad Tier A coverage for 5-8 locales: about 4-6 months with parallel translation.
- "All available languages": ongoing program.

## Risks And Mitigations

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Under-counted strings | Schedule slips | Build scanner and coverage dashboard early. |
| English in backend errors | Non-native user experience | Stable API error envelope and backend translation pass. |
| Clinical mistranslation | Safety/trust risk | Human clinical review, glossary, source-data fallback policy. |
| AI ignores locale | Inconsistent experience | Add locale to prompts, tests, and response policies. |
| RTL breaks layout | Unusable for Arabic/Hebrew | Add RTL canary early; use logical CSS; Playwright screenshots. |
| Bundle bloat | Slower app load | Lazy load namespaces/languages. |
| Translator churn | Inconsistent terminology | Translation memory, glossary, stable keys. |
| Keys drift across branches | Missing translations | CI key parity and missing-key reports. |
| User-generated content direction issues | Broken mixed-language display | Use `dir="auto"` for runtime/user content. |
| Locale vs clinical data confusion | Users assume source values translated | Explicit fallback labels and documentation. |

## Open Decisions

1. Which locales are Tier A for the first release?
2. Is the first pilot `es-ES`, `fr-FR`, or another locale?
3. Is Arabic a release locale or an internal RTL canary first?
4. Does "native" include installer GUI and public install pages in v1?
5. Do exports use viewer locale, study locale, or explicit export locale?
6. Should frontend translation assets live in `public/locales` or be bundled by source imports?
7. Should we adopt a TMS now or start with repo-managed JSON?
8. Are machine translations acceptable for draft UI copy?
9. Who signs off clinical/research terminology?
10. Should API responses be localized server-side, client-side from `message_key`, or both?

## Recommended First Sprint

1. Add `config/parthenon-locales.php` with `en-US`, `pseudo`, one pilot locale, and `ar` canary metadata.
2. Add user `locale` and `timezone`.
3. Add frontend `i18n` module and pseudolocale.
4. Localize app shell/nav/header/settings/login.
5. Add request locale headers and backend locale middleware.
6. Add formatter helpers and migrate shell/settings/auth date/number usages.
7. Add scanner in warn-only mode.
8. Add Playwright smoke for English, pseudolocale, and Arabic canary shell.

This sprint creates the spine. After that, feature extraction can proceed in parallel without each feature inventing its own localization pattern.
