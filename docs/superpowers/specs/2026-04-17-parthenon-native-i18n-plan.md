# Parthenon Native i18n Availability Plan

Date: 2026-04-17

Owner: Product/Engineering

Status: Implementation in progress on `main`

Current active branch: `main`

Original implementation branch: `feature/parthenon-native-i18n`

Unified merge branch: `codex/parthenon-i18n-unified`

Merged source branches: `feature/parthenon-native-i18n`, `codex/parthenon-i18n-pr5-message-contract`

Previous isolated Codex branch: `codex/parthenon-i18n-pr5-message-contract`

## Implementation Progress

2026-04-17:

- Created dedicated implementation branch `feature/parthenon-native-i18n`.
- Locked the initial language rollout decision: Spanish (`es-ES`) as the first production pilot, Korean (`ko-KR`) as the parallel production candidate, and Arabic (`ar`) as the internal RTL canary.
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
- Expanded the frontend and backend locale registries with Laravel, Docusaurus, formatting, fallback, release-tier, enabled, and selectability metadata.
- Added backend `ParthenonLocales` support helper and switched locale middleware/profile updates to shared normalization semantics.
- Normalized persisted user locale updates so language-only values such as `ko` save as `ko-KR`.
- Aligned Docusaurus config with English, Spanish, Korean, and Arabic locale builds.
- Added focused frontend/backend locale metadata tests for Spanish, Korean, Arabic, and pseudolocale behavior.
- Verified DB-backed user locale persistence against local PostgreSQL 17 using the `pgsql_testing` connection and `parthenon_testing` database.
- Locked public user-facing language choices to English (`en-US`), Spanish (`es-ES`), and Korean (`ko-KR`). Non-certified Wave 1 locales remain enabled in metadata and translation tooling but are not selectable by users until certified; Arabic (`ar`) and `en-XA` remain QA/internal canaries.
- Added frontend/backend locale metadata parity coverage so Docusaurus, Laravel, and frontend locale metadata cannot drift silently.
- Added development/test missing-key telemetry hooks for structured namespace/key/language reporting.
- Added a targeted locale-save rollback test for failed Settings preference updates.
- Applied the production `users.locale` migration through the protected targeted migration path and verified `admin@acumenus.net` persisted locale cleanup back to `en-US`.
- Deployed frontend/docs assets from the dedicated i18n worktree and remounted the live PHP, nginx, Horizon, and Reverb services on `/home/smudoshi/Github/Parthenon-i18n` so the original `main` checkout remains available for other agents.
- Added a local deployment compose override for the i18n worktree that overlays the production Laravel `storage` and generated API docs directories into the branch-mounted containers; this preserves live runtime data while serving branch code.
- Reran `./deploy.sh --php` with the i18n worktree compose override; deploy smoke passed for `/`, `/login`, `/jobs`, Sanctum CSRF, API 404 handling, and HADES package readiness.
- Live public route smoke passed for `/`, `/login`, `/jobs`, `/docs/`, `/docs/es/`, `/docs/ko/`, and `/docs/ar/`.
- Live authenticated locale smoke passed with `admin@acumenus.net`: `es-ES` save, `ko-KR` save, hidden `fr-FR` rejection with HTTP 422, and cleanup back to `en-US`.
- Added focused Playwright i18n shell coverage in `e2e/tests/i18n-shell.spec.ts` for public language selector options, Spanish/Korean persistence, pseudolocale rendering, and Arabic RTL document metadata. Live production run passed 3/3 tests and restored `admin@acumenus.net` to `en-US`.
- Added `npm run i18n:report`, which writes `frontend/reports/i18n-completeness.json` with per-locale key coverage, missing/empty key counts, and identical-to-source counts for CI and release-readiness review. Current report: 100% key coverage across 12 locales and 5 namespaces; Spanish distinct-value coverage is 94.78% and Korean is 93.74%.
- Began PR5 backend message contract implementation with `App\Support\ApiMessage`. Auth and profile responses now preserve `message` while adding stable `message_key`, optional `message_params`, and `message_meta` with requested/message/fallback locale and fallback status. Added frontend `ApiMessageEnvelope`/`ApiMessageMeta` types for clients adopting the contract.
- Added backend coverage for localized public auth errors, profile/auth message keys, replacement params, and fallback metadata. Focused backend tests pass: `ApiMessageTest`, `AuthTest`, and `UserProfileTest`.
- Extended PR5 to global API exception handling: validation, unauthenticated, and authorization failures now use the same localized `message_key` envelope. Added core Laravel validation language files for every backend i18n locale and converted contextual help error responses to the envelope.
- Added backend coverage for Korean public validation envelopes, Spanish authenticated validation envelopes, localized unauthenticated errors, help error message keys, and all-locale presence of core backend contract keys.
- Deployed the PR5 backend contract update from the i18n worktree. Post-deploy smoke passed for `/`, `/login`, `/jobs`, Sanctum CSRF, API 404 handling, and HADES package readiness.
- Live API contract smoke passed for Korean validation errors, Korean unauthenticated errors, Spanish invalid login errors, authenticated help not-found errors, and public/docs routes.
- Fixed Docusaurus source links that used hard `/docs/...` prefixes so localized builds no longer generate doubled `/docs/{locale}/docs/...` routes. Rebuilt docs for English, Spanish, Korean, and Arabic, synced generated docs assets to the live static root, and verified blog/migration/source target routes return HTTP 200 across all four docs locales.
- Continued PR5 on non-FinnGen study workflows only. `StudyController` create/update/delete/execute/add-analysis/remove-analysis/transition responses now emit localized `study.*` message keys and fallback metadata; domain exceptions keep a stable localized envelope plus diagnostic `detail`.
- Added `study.php` backend language files for every backend i18n locale and frontend typing for study transition responses to extend `ApiMessageEnvelope`.
- Added focused study message-contract tests for Spanish creation, Korean transitions with `message_params`, Spanish invalid transition errors, wrong-study analysis removal errors, and all-locale presence of the new study keys. The host Laravel test run is currently blocked by unrelated root-owned FinnGen files under active development, so the focused backend suite was verified in a temporary backend copy with readable FinnGen stubs and passed 8 tests / 124 assertions. No FinnGen source or tests were modified.
- Extended PR5 to non-FinnGen survey workflows. Public survey link/submission errors and survey campaign state errors now preserve the existing `message` field while adding localized `survey.*` `message_key` and `message_meta` coverage.
- Added `survey.php` backend language files for every backend i18n locale, including Spanish and Korean target copy. Focused survey/message-contract tests pass: 23 tests / 225 assertions against the protected testing database path.
- Fixed API middleware priority so Sanctum-authenticated requests resolve the persisted user locale before localized API messages are rendered; public routes still resolve locale from `X-Parthenon-Locale`, query, and `Accept-Language`.
- Added a warn-only frontend i18n scanner (`npm run i18n:scan`) that reports hardcoded JSX text, user-facing JSX attributes, and common display text properties without blocking feature branches. It writes the full baseline to `frontend/reports/i18n-scan-full.json`.
- Added a scoped PR3/PR4 scanner command (`npm run i18n:scan:pr3-pr4`) for app shell, shared UI, auth, and settings extraction. It writes `frontend/reports/i18n-scan-pr3-pr4.json`. Initial baseline: 208 candidates across 57 files; full frontend baseline: 8,193 candidates across 1,068 files.
- Extracted the first PR3 app-shell cluster: Abby panel chrome and About Abby modal copy now use layout translation keys, with Spanish and Korean public-locale copy and English fallback for hidden Wave 1 locales. Updated scanner baseline: 175 PR3/PR4 candidates and 8,160 full-frontend candidates.
- Extracted the full PR3/PR4 scanner scope for app shell, shared UI, auth, and settings. Setup wizard/onboarding, auth setup steps, shared primitives, tag modals, job progress modal, notification settings header, and intentional non-translatable proper nouns/examples are now covered. Updated scanner baseline: 0 PR3/PR4 candidates across 57 files and 7,985 full-frontend candidates across 1,068 files.
- Verified the current i18n branch with frontend i18n tests, TypeScript project check using the declared TypeScript 6 line, focused ESLint on touched frontend files, `git diff --check`, and backend locale/profile tests against local PostgreSQL 17 `parthenon_testing`.
- Created the isolated Codex worktree `/home/smudoshi/Github/Parthenon-codex-i18n-pr5` on `codex/parthenon-i18n-pr5-message-contract`, transplanted only i18n-owned changes, and explicitly excluded active FinnGen work and generated cohort fixture changes. Clean branch verification passed: no uncommitted FinnGen/cohort fixture paths, `git diff --check`, PHP lint, frontend ESLint, TypeScript project check, i18n scanner/report, i18n Vitest suite, and focused Laravel API message-contract tests against PostgreSQL 17 (`42 passed`, `1 skipped`, `440 assertions`).

2026-04-20:

- Continued the app-first i18n extraction work while explicitly leaving active FinnGen work out of scope.
- Completed the focused app-priority extraction scope. `npm run i18n:scan:app-priority` now reports 0 candidates across 214 files.
- The full frontend scanner remains intentionally broader than the release-priority scope: `npm run i18n:scan` now reports 3,207 candidates across 1,104 files; excluding FinnGen paths leaves 2,835 candidates. The largest non-FinnGen clusters are ETL/CDM schema labels, the Standard PRO curated instrument catalog, Strategus, investigation, profiles/patient similarity, publish/care-gaps/risk-score surfaces, HEOR, Morpheus constants, and technical-tooling surfaces such as Poseidon/code tools.
- Current `npm run i18n:report` shows 100% key coverage and 0 missing keys across 12 locales / 8 namespaces. Spanish is at 94.99% distinct-value coverage and Korean is at 95.49%; hidden Wave 1 locales remain mostly English fallback and are not production-certified yet.
- Added targeted Playwright visual smoke coverage in `e2e/tests/i18n-visual-smoke.spec.ts` for the Dashboard, topnav language selector, Dashboard contextual help, route/error state, and `/admin/auth-providers` app surface across `en-US`, `es-ES`, and `ko-KR`. Chromium visual smoke passed 3/3 and wrote screenshots under `e2e/screenshots/i18n-visual-smoke/`.
- With the app-priority scanner at 0 candidates and the English/Spanish/Korean visual smoke passing, the current i18n branch is ready for the app-priority PR refresh/open step before hidden Wave 1 language-pack drafting.
- Opened app-priority PR #215 from `codex/parthenon-i18n-app-priority`, centered on native app i18n, per-user language preference, pilot contextual help, and Docusaurus native locale infrastructure/chrome as supporting proof. The PR diff contains no FinnGen paths.
- Next language-pack expansion should begin with `fr-FR`, `de-DE`, and `pt-BR` after the English/Spanish/Korean visual smoke checklist and current app-priority PR refresh. Arabic remains an RTL canary, not the next public production language.
- Per direction, moved the app-priority i18n baseline back onto `main` and stopped the stacked PR branch workflow for follow-on i18n work.
- Started the hidden Wave 1 language-pack pass for French, German, and Brazilian Portuguese on `main`. Dashboard resources now have native Wave 1 drafts; shared common UI chrome, Abby panel chrome, route/error copy, analysis labels, and the Administration/Auth Providers app surface have targeted Wave 1 drafts. `npm run i18n:report` now shows `fr-FR` at 12.61% distinct values, `de-DE` at 12.56%, and `pt-BR` at 12.90%, with 100% key presence and 0 missing keys. `npm run i18n:scan:app-priority` remains at 0 candidates across 214 files.
- At that checkpoint, remaining Wave 1 language-pack work before public selection was setup/onboarding auth strings, the `commons` namespace, and the remaining app namespace keys beyond the targeted administration/auth-provider draft; then hidden-locale visual smoke for `fr-FR`, `de-DE`, and `pt-BR`.
- Pushed the i18n baseline and Wave 1 draft work directly to `origin/main`, closed obsolete PR #215, deleted the remote i18n branch, and pruned local i18n branch references.
- Continued from `main` with a Commons shell draft for French, German, and Brazilian Portuguese. `commons` now has native coverage for channel shell, presence, calls, right-panel collaboration chrome, channel/direct-message creation, chat basics, notifications, and announcements while deeper Abby/wiki Commons content remains on English fallback. Current report: `fr-FR` 18.75%, `de-DE` 18.80%, and `pt-BR` 19.33% distinct values with 100% key presence and 0 missing keys. `npm run i18n:scan:app-priority` remains at 0 candidates.
- Closed out the remaining PR queue against `main`: merged the clean Dependabot PRs for FastAPI and GitHub Actions updates, then landed the i18next 26.0.6 bump directly on `main` with the required `initAsync` initialization update. Local frontend validation passed with `npm ci --legacy-peer-deps`, `npx tsc --noEmit`, `npm run lint` (warnings only, existing backlog), `npx vitest run`, focused i18n Vitest, `npm run i18n:report`, and `npm run build`.
- Completed the Wave 1 setup/auth pass for French, German, and Brazilian Portuguese, including setup wizard controls, welcome checklist, password setup, system health, AI provider, authentication provider, onboarding tour, data-source import, and completion copy. Remaining identical auth strings are intentional protocol/product/filename terms such as HEOR, OMOP CDM, LDAP/OAuth/OIDC/SAML, `.install-credentials`, `daimon`, and Basic auth. Current report: `fr-FR` 23.26%, `de-DE` 23.29%, and `pt-BR` 23.81% distinct values with 100% key presence and 0 missing keys.
- Completed the full Wave 1 Commons namespace pass for French, German, and Brazilian Portuguese, including channel shell, presence, calls, collaboration panels, channel/direct-message creation, chat composer/actions/reactions/object references, notifications, announcements, Abby institutional-memory UI, source attribution, and wiki ingestion/chat/PDF/activity surfaces. `commons` now reports 99.49% distinct values for each Wave 1 locale; the only identical keys are intentional proper/model identifiers (`abby.name`, `abby.modelLabel`). Current overall report: `fr-FR` 27.43%, `de-DE` 27.35%, and `pt-BR` 27.69% distinct values with 100% key presence and 0 missing keys.
- Completed the Wave 1 app-namespace `covariates` and `jobs` pass for French, German, and Brazilian Portuguese. The pass covers covariate domain groups/labels/time windows plus the jobs list, filters, actions, detail drawer sections/labels, and stalled/running/failed count messages. Remaining identical keys inside these two app areas are intentional abbreviations/product names only: CHADS2, CHA2DS2-VASc, SCCS, and Achilles. Current overall report: `fr-FR` 31.24%, `de-DE` 31.16%, and `pt-BR` 31.50% distinct values with 100% key presence and 0 missing keys; app namespace distinct coverage is now `fr-FR` 10.55%, `de-DE` 10.34%, and `pt-BR` 10.55%.
- Completed the Wave 1 app-namespace `vocabulary` pass for French, German, and Brazilian Portuguese. The pass covers the Concept Mapping Assistant, concept detail, semantic search, keyword search panel, concept comparison, add-to-concept-set modal, Vocabulary Browser page chrome, hierarchy browser, and hierarchy tree. Remaining identical vocabulary keys are intentional technical/proper tokens or true same-spelling UI terms: glyph labels (`-`), OMOP vocabulary names/codes, `Hecate`, `S`/`C` standard abbreviations, `Solr`/`PG`, count suffix formatting, and language-native cognates such as French `Observation`, `Classification`, `Code`, and `concepts` plus German `Code`. Current overall report: `fr-FR` 37.00%, `de-DE` 37.00%, and `pt-BR` 37.37% distinct values with 100% key presence and 0 missing keys; app namespace distinct coverage is now `fr-FR` 18.24%, `de-DE` 18.13%, and `pt-BR` 18.38%. Remaining app fallback groups are `administration`, `studies`, and `dataExplorer`.
- Completed the Wave 1 app-namespace `dataExplorer` pass for French, German, and Brazilian Portuguese. The pass covers Data Explorer page chrome, tabs, source selector, OMOP domains, overview metrics/cards, charts, domain/concept/temporal panels, Achilles/Heel, DQD, and all Ares surfaces including network overview, feasibility, annotations, coverage, DQ history, unmapped codes, concept comparison, releases, diversity, and cost. Remaining identical data-explorer keys are intentional product/standard names, compact graph labels, placeholder-only formats, chart percentile markers, and true same-spelling clinical/UI tokens such as `Ares`, `Achilles`, `SLA`, `ETL`, `CDM`, `P10`/`P25`/`P75`/`P90`, placeholder formats, and language-native cognates. Current overall report: `fr-FR` 52.66%, `de-DE` 52.90%, and `pt-BR` 53.29% distinct values with 100% key presence and 0 missing keys; app namespace distinct coverage is now `fr-FR` 39.10%, `de-DE` 39.31%, and `pt-BR` 39.59%. Remaining app fallback groups are `administration` and `studies`.
- Completed the Wave 1 app-namespace `studies` pass for French, German, and Brazilian Portuguese. The pass covers studies list/search/table states, creation wizard, study detail/dashboard tabs, analyses/results/synthesis surfaces, federated Arachne execution, artifacts, sites, cohorts, team, milestones, activity, OHDSI Study Design Compiler, and the study workbench path. Remaining identical studies keys are intentional product/standard identifiers, placeholder-only formats, phase labels, and true same-spelling clinical/UI terms such as `Solr`, `PLE`, `PLP`, `SCCS`, `CDM`, `DQD`, `IRB`, `ClinicalTrials.gov`, `OHDSI #{{id}}`, `{{label}} ({{count}})`, `{{size}} KB`, and language-native cognates. Current overall report: `fr-FR` 70.94%, `de-DE` 71.39%, and `pt-BR` 72.25% distinct values with 100% key presence and 0 missing keys; app namespace distinct coverage is now `fr-FR` 63.45%, `de-DE` 63.94%, and `pt-BR` 64.85%. Remaining app fallback group is `administration`.
- Completed the Wave 1 app-namespace `administration` pass for French, German, and Brazilian Portuguese. The pass preserves existing non-English admin translations and fills the remaining dashboard, users/roles, auth providers, LiveKit, FHIR, PACS/Orthanc, Solr, GIS, Chroma/vector, Atlas migration, vocabulary import, system health, FHIR sync/export, Acropolis services, user audit, broadcast email, service detail, and honest-broker administration surfaces. Remaining identical app keys are now the intentional technical/proper/format/cognate tail across completed app groups, including service/product names, code identifiers, fixed URLs, masked secrets, units, placeholder-only formats, and native same-spelling labels. Current overall report: `fr-FR` 93.44%, `de-DE` 94.05%, and `pt-BR` 95.65% distinct values with 100% key presence and 0 missing keys; app namespace distinct coverage is now `fr-FR` 93.43%, `de-DE` 94.13%, and `pt-BR` 96.02%. There is no remaining large untranslated Wave 1 app fallback group for these three locales.
- Promoted completed Wave 1 app locales `fr-FR`, `de-DE`, and `pt-BR` to public-selectable app languages in frontend and backend locale metadata. User preference persistence now accepts those locales; remaining hidden preview locales are `fi-FI`, `ja-JP`, `zh-Hans`, and `hi-IN`, with `ar` and `en-XA` still internal QA/canary locales. Docusaurus public docs locales remain `en`, `es`, and `ko` until docs-content translation catches up.
- Started the next hidden Wave 1 language-pack pass for Finnish, Japanese, and Simplified Chinese on `main`. Dashboard resources, shared common UI chrome, Abby panel chrome, and setup/onboarding/auth strings now have native drafts for `fi-FI`, `ja-JP`, and `zh-Hans`. Current `npm run i18n:report` shows `fi-FI` at 13.14%, `ja-JP` at 13.24%, and `zh-Hans` at 13.27% distinct values with 100% key presence and 0 missing keys. `npm run i18n:scan:app-priority` remains at 0 candidates across 214 files. Remaining work before public selection is the `commons` namespace, the app namespace groups, and hidden-locale visual smoke for these three locales.
- Completed the next hidden Wave 1 Commons namespace pass for Finnish, Japanese, and Simplified Chinese on `main`. The pass covers Commons channel shell, LiveKit calls, presence, right-panel collaboration chrome, channel/direct-message creation, chat composer/actions/reactions/object references, notifications, announcements, Abby institutional-memory UI, source attribution, and wiki ingestion/chat/PDF/activity surfaces. Current `npm run i18n:report` shows `fi-FI` at 23.24%, `ja-JP` at 23.39%, and `zh-Hans` at 23.42% distinct values with 100% key presence and 0 missing keys; `commons` namespace distinct coverage is now `fi-FI` 97.47%, `ja-JP` 97.97%, and `zh-Hans` 97.97%. `npm run i18n:scan:app-priority` remains at 0 candidates across 214 files. Remaining work before public selection is app `covariates`/`jobs`, `vocabulary`, `dataExplorer`, `studies`, `administration`, and hidden-locale visual smoke for these three locales.
- Completed the next hidden Wave 1 app-namespace `covariates` and `jobs` pass for Finnish, Japanese, and Simplified Chinese. The pass covers covariate domain groups/labels/time windows plus the jobs list, filters, actions, detail drawer sections/labels, and stalled/running/failed count messages. Remaining identical keys inside these two app areas are intentional abbreviations/product names only, including CHADS2, CHA2DS2-VASc, SCCS, Achilles, FHIR, GIS, Poseidon ETL, and Dagster Run ID. Current `npm run i18n:report` shows `fi-FI` at 26.99%, `ja-JP` at 27.14%, and `zh-Hans` at 27.17% distinct values with 100% key presence and 0 missing keys; app namespace distinct coverage is now 5.00% for all three locales. Remaining app fallback groups are `vocabulary`, `dataExplorer`, `studies`, and `administration`.
- Completed the next hidden Wave 1 app-namespace `vocabulary` pass for Finnish, Japanese, and Simplified Chinese. The pass covers the Concept Mapping Assistant, concept detail, semantic search, keyword search panel, concept comparison, add-to-concept-set modal, Vocabulary Browser page chrome, hierarchy browser, and hierarchy tree. Remaining identical vocabulary keys are intentional technical/proper tokens and code-system labels such as Ariadne, Hecate, OMOP, Solr, PG, SNOMED CT, ICD-10-CM, RxNorm, LOINC, CPT-4, HCPCS, MedDRA, and standard/classification abbreviations. Current `npm run i18n:report` shows `fi-FI` at 32.84%, `ja-JP` at 32.94%, and `zh-Hans` at 32.99% distinct values with 100% key presence and 0 missing keys; app namespace distinct coverage is now `fi-FI` 12.79%, `ja-JP` 12.72%, and `zh-Hans` 12.75%. Remaining app fallback groups are `dataExplorer`, `studies`, and `administration`.
- Completed the next hidden Wave 1 app-namespace `dataExplorer` pass for Finnish, Japanese, and Simplified Chinese. The pass covers Data Explorer page chrome, tabs, source selector, OMOP domains, overview metrics/cards, charts, domain/concept/temporal panels, Achilles/Heel, DQD, and all Ares surfaces including network overview, feasibility, annotations, coverage, DQ history, unmapped codes, concept comparison, releases, diversity, and cost. Remaining identical data-explorer keys are intentional product/standard names, compact graph labels, placeholder-only formats, chart percentile markers, and protocol tokens such as Ares, Achilles, DQD, DQ, CDM, ETL, FHIR, GIS, SLA, ADI, CONSORT, US Census 2020, P10/P25/P75/P90, and model/code identifiers. Current `npm run i18n:report` shows `fi-FI` at 48.60%, `ja-JP` at 48.68%, and `zh-Hans` at 48.73% distinct values with 100% key presence and 0 missing keys; app namespace distinct coverage is now `fi-FI` 33.79%, `ja-JP` 33.68%, and `zh-Hans` 33.72%. Remaining app fallback groups are `studies` and `administration`.
- Completed the next hidden Wave 1 app-namespace `studies` pass for Finnish, Japanese, and Simplified Chinese. The pass covers studies list/search/table states, creation wizard, study detail/dashboard tabs, analyses/results/synthesis surfaces, federated Arachne execution, artifacts, sites, cohorts, team, milestones, activity, OHDSI Study Design Compiler, and the study workbench path. Remaining identical studies keys are intentional product/standard identifiers, placeholder-only formats, phase labels, and protocol terms such as Solr, PLE, PLP, SCCS, CDM, DQD, IRB, ClinicalTrials.gov, OHDSI #{{id}}, {{label}} ({{count}}), {{size}} KB, and HADES/OHDSI/Arachne identifiers. Current `npm run i18n:report` shows `fi-FI` at 67.32%, `ja-JP` at 67.48%, and `zh-Hans` at 67.61% distinct values with 100% key presence and 0 missing keys; app namespace distinct coverage is now `fi-FI` 58.74%, `ja-JP` 58.74%, and `zh-Hans` 58.87%. Remaining app fallback group is `administration`.
- Completed the next hidden Wave 1 app-namespace `administration` pass for Finnish, Japanese, and Simplified Chinese. The pass covers dashboard/admin navigation, Acropolis services, broadcast email, user modal, LiveKit, authentication providers, roles and permissions, PACS/Orthanc, Solr, AI providers, GIS import, Chroma/vector administration, Atlas migration, vocabulary import, system health, FHIR connections/sync/export, honest broker, user audit, service detail, and related operations surfaces. Remaining identical app keys are the intentional technical/proper/format tail across completed app groups, including service/product names, code identifiers, fixed URLs, masked secrets, units, placeholder-only formats, and standards/protocol tokens. Current `npm run i18n:report` shows `fi-FI` at 93.34%, `ja-JP` at 94.49%, and `zh-Hans` at 94.60% distinct values with 100% key presence and 0 missing keys; app namespace distinct coverage is now `fi-FI` 93.40%, `ja-JP` 94.72%, and `zh-Hans` 94.83%. There is no remaining large untranslated Wave 1 app fallback group for these three locales; remaining work before public selection is hidden-locale visual smoke and locale metadata promotion.
- Promoted completed next Wave 1 app locales `fi-FI`, `ja-JP`, and `zh-Hans` to public-selectable app languages in frontend and backend locale metadata, and expanded the i18n visual smoke matrix to cover them alongside English, Spanish, and Korean. User preference persistence now accepts Finnish, Japanese, and Simplified Chinese; remaining hidden preview locale is `hi-IN`, with `ar` and `en-XA` still internal QA/canary locales. `npx playwright test tests/i18n-visual-smoke.spec.ts --project=chromium` passed 6/6 after the production frontend deploy. Docusaurus public docs locales remain `en`, `es`, and `ko` until docs-content translation catches up.
- Completed and promoted the final hidden Wave 1 app locale, Hindi (`hi-IN`), on `main`. Hindi now has native dashboard, shared shell, setup/onboarding/auth, `commons`, and app namespace resources; the placeholder/protected-term audit reports 0 issues, and `npm run i18n:report` shows `hi-IN` at greater than 95% distinct overall coverage with 100% key presence and 0 missing keys. User preference persistence now accepts Hindi; `ar` and `en-XA` remain internal QA/canary locales. Docusaurus public docs locales remain `en`, `es`, and `ko` until docs-content translation catches up.
- Completed the data-source setup and ingestion extraction wave on `main`, explicitly including `src/features/data-sources`, `src/features/ingestion`, and FHIR ingestion/export chrome under `src/features/etl/components/FhirIngestionPanel.tsx` and `src/features/etl/components/fhir`. The focused wave scanner reports 0 candidates across 46 files, `npm run i18n:scan:app-priority` remains at 0 candidates, and the full scanner now reports 5,265 total candidates / 4,893 non-FinnGen candidates. New app-namespace strings live in `frontend/src/i18n/dataSourceIngestionResources.ts`, with exact-match terminology reuse seeded from the existing language packs and protected FHIR/OMOP/CDM/source identifiers preserved.
- Completed the cohort authoring and diagnostics extraction wave on `main`, covering `src/features/cohort-definitions` across cohort list/detail, expression editor, validation, diagnostics, attrition, patient list, Circe SQL, wizard, temporal presets, and shared cohort surfaces. The focused wave scanner now reports 0 candidates across 62 files, `npm run i18n:scan:app-priority` remains at 0 candidates, and the full scanner is down to 4,600 total candidates / 4,228 non-FinnGen candidates. New app-namespace strings live in `frontend/src/i18n/cohortDefinitionResources.ts`, while generated SQL, JSON, and OHDSI/Circe/source identifiers remain protected.
- Completed the full analytics extraction wave on `main`, covering `src/features/analyses`, `src/features/estimation`, `src/features/prediction`, `src/features/pathways`, `src/features/sccs`, `src/features/self-controlled-cohort`, and `src/features/evidence-synthesis`. The focused analytics wave scanner now reports 0 candidates across 75 files, `npm run i18n:scan:app-priority` remains at 0 candidates, and the full scanner is down to 3,878 total candidates / 3,506 non-FinnGen candidates. New app-namespace strings live in `frontend/src/i18n/analysisResources.ts`, while method labels, package names, and source-data values remain protected where needed.
- Completed the Standard PROs UI extraction wave on `main`, covering `src/features/standard-pros/components`, `src/features/standard-pros/pages`, and user-facing import/error helper paths under `src/features/standard-pros/lib`. The focused Standard PROs UI scanner reports 0 candidates across 10 files, `npm run i18n:scan:app-priority` remains at 0 candidates, and the full scanner is now down to 3,607 total candidates / 3,235 non-FinnGen candidates. The full `src/features/standard-pros` folder still reports 99 candidates across 23 files, all confined to `src/features/standard-pros/data/instruments.ts`, which remains intentionally excluded as curated instrument content rather than generic UI copy. New app-namespace strings live in `frontend/src/i18n/standardProsResources.ts`, with shared Standard PROs label helpers in `frontend/src/features/standard-pros/lib/i18n.ts`.

2026-04-21:

- Completed the imaging, genomics, and radiogenomics extraction wave on `main`, covering `src/features/imaging`, `src/features/genomics`, and `src/features/radiogenomics`. The focused scans now report 0 candidates across the imaging (14 files), genomics (9 files), and radiogenomics (4 files) wave scopes; `npm run i18n:scan:app-priority` remains at 0 candidates, and the full scanner is down to 3,207 total candidates / 2,835 non-FinnGen candidates. New app-namespace strings live in `frontend/src/i18n/imagingGenomicsResources.ts`, while DICOM/OHIF/PACS identifiers, modality/source codes, measurement units, and backend significance matching keys remain protected where needed.
- Completed the Strategus and study-package extraction wave on `main`, covering `src/features/strategus/pages/StudyPackagePage.tsx`, `src/features/strategus/components/ModuleConfigPanels.tsx`, `src/features/strategus/components/JsonSpecEditor.tsx`, and the supporting Strategus metadata helpers under `src/features/strategus/lib` and `src/features/strategus/types.ts`. The focused Strategus wave scanner now reports 0 candidates across 6 files, `npm run i18n:scan:app-priority` remains at 0 candidates, and the full scanner is down to 3,079 total candidates / 2,707 non-FinnGen candidates. New app-namespace strings live in `frontend/src/i18n/strategusResources.ts`, while Strategus module names, OHDSI package identifiers, JSON keys, and generated specification text remain protected with explicit `i18n-exempt` annotations where needed.
- Current `npm run i18n:report` remains at 100% key presence and 0 missing keys across all 12 locales / 8 namespaces after the Strategus wave. Because the new Strategus extraction adds a fresh app-namespace key set with English fallback in the non-English packs, distinct-value coverage is now `es-ES` 57.33%, `fr-FR` 56.46%, `de-DE` 56.87%, `pt-BR` 57.80%, `fi-FI` 56.43%, `ja-JP` 57.13%, `zh-Hans` 57.19%, `ko-KR` 57.70%, `hi-IN` 57.51%, `ar` 3.39%, with `en-US` and `en-XA` at 100%. This is structurally complete extraction coverage, not yet a fresh native-language drafting pass for the newly added Strategus keys.
- Completed the profiles and patient-similarity extraction wave on `main`, covering `src/features/profiles` and `src/features/patient-similarity`. The focused wave scanner now reports 0 candidates across 72 files. New app-namespace strings live in `frontend/src/i18n/profileSimilarityResources.ts`, with supporting label helpers in `frontend/src/features/profiles/lib/i18n.ts` and `frontend/src/features/patient-similarity/lib/i18n.ts`. Patient/person labels, source-controlled clinical values, concept IDs, MRNs, vocabulary routes, trajectory math labels, and research identifiers remain protected where needed while the surrounding UI chrome is now localized.
- The full frontend scanner now reports 2,547 total candidates / 2,175 non-FinnGen candidates after the profiles and patient-similarity wave. The dedicated `npm run i18n:scan:app-priority` script remains the operational release-facing shell gate and still reports 0 candidates across 214 files; the unsupported ad hoc `npm run i18n:scan -- --app-priority` invocation should not be used for milestone accounting.
- Current `npm run i18n:report` still shows 100% key presence and 0 missing keys across all 12 locales / 8 namespaces after the profiles and patient-similarity wave. Because the new profile/similarity extraction adds another large app-namespace key set with English fallback in the non-English packs, distinct-value coverage is now `es-ES` 52.26%, `fr-FR` 51.46%, `de-DE` 51.84%, `pt-BR` 52.69%, `fi-FI` 51.43%, `ja-JP` 52.08%, `zh-Hans` 52.13%, `ko-KR` 52.59%, `hi-IN` 52.42%, `ar` 3.09%, with `en-US` and `en-XA` at 100%. This remains structurally complete extraction coverage, not yet a fresh native-language drafting pass for the newly added profile and patient-similarity keys.
- Completed the publish, care gaps, and risk-scores extraction wave on `main`, covering `src/features/publish`, `src/features/care-gaps`, and `src/features/risk-scores`. The focused wave scanner now reports 0 candidates across 75 files, `npm run i18n:scan:app-priority` remains at 0 candidates across 214 files, and the full scanner is down to 2,099 total candidates / 1,727 non-FinnGen candidates. New app-namespace strings live in `frontend/src/i18n/publishCareGapRiskResources.ts`, with supporting label helpers in `frontend/src/features/publish/lib/i18n.ts`, `frontend/src/features/publish/lib/sectionConfig.ts`, `frontend/src/features/care-gaps/lib/i18n.ts`, and `frontend/src/features/risk-scores/lib/i18n.ts`. Template names/section titles, publish export/table captions, care-gap status/category labels, and risk-score workflow chrome are now localized while study titles, clinical/source values, concept IDs, JSON, and standards identifiers remain protected where needed.
- Current `npm run i18n:report` still shows 100% key presence and 0 missing keys across all 12 locales / 8 namespaces after the publish/care-gaps/risk-scores wave. Because this extraction adds another large app-namespace key set with English fallback in the non-English packs, distinct-value coverage is now `es-ES` 48.37%, `fr-FR` 47.63%, `de-DE` 47.98%, `pt-BR` 48.77%, `fi-FI` 47.61%, `ja-JP` 48.20%, `zh-Hans` 48.25%, `ko-KR` 48.68%, `hi-IN` 48.52%, `ar` 2.86%, with `en-US` and `en-XA` at 100%. This remains structurally complete extraction coverage, not yet a fresh native-language drafting pass for the newly added publish, care-gap, and risk-score keys.
- Completed the investigation clinical-workflows extraction wave on `main`, covering `src/features/investigation` across the landing/new-investigation shell, phenotype builder/validation/codewas/cohort tooling, clinical gallery/config/tracking/history/results, genomic evidence search/upload/chart/table surfaces, synthesis dossier/export/versioning, and shared investigation-side panels. The focused investigation wave scanner now reports 0 candidates across 63 files, `npm run i18n:scan:app-priority` remains at 0 candidates across 214 files, and the full scanner is down to 1,749 total candidates / 1,377 non-FinnGen candidates. New app-namespace strings live in `frontend/src/i18n/investigationResources.ts`, with supporting label helpers in `frontend/src/features/investigation/lib/i18n.ts`. OHDSI/FinnGen/source identifiers, JSON keys, concept IDs, clinical values, and scientific shorthand remain protected where needed while the surrounding investigation workflow chrome now resolves through app i18n resources.
- Current `npm run i18n:report` still shows 100% key presence and 0 missing keys across all 12 locales / 8 namespaces after the investigation wave. Because this extraction adds another large app-namespace key set with English fallback in the non-English packs, distinct-value coverage is now `es-ES` 45.60%, `fr-FR` 44.91%, `de-DE` 45.23%, `pt-BR` 45.98%, `fi-FI` 44.88%, `ja-JP` 45.44%, `zh-Hans` 45.49%, `ko-KR` 45.89%, `hi-IN` 45.75%, `ar` 2.70%, with `en-US` and `en-XA` at 100%. This remains structurally complete extraction coverage, not yet a fresh native-language drafting pass for the newly added investigation keys.
- Completed the HEOR extraction wave on `main`, covering `src/features/heor` across the HEOR hub, analysis detail workspace, claims explorer, budget-impact chart, cost-effectiveness plane, scenario comparison chart, tornado diagram, and the supporting HEOR label helper layer. The focused HEOR wave scanner now reports 0 candidates across 13 files, `npm run i18n:scan:app-priority` remains at 0 candidates across 214 files, and the full scanner is down to 1,614 total candidates / 1,242 non-FinnGen candidates. New app-namespace strings live in `frontend/src/i18n/heorResources.ts`, with supporting label helpers in `frontend/src/features/heor/lib/i18n.ts`. Payer/claims/source terminology, Solr command text, currency figures, and ICER/QALY shorthand remain protected where needed while the surrounding HEOR workflow chrome now resolves through app i18n resources.
- Current `npm run i18n:report` still shows 100% key presence and 0 missing keys across all 12 locales / 8 namespaces after the HEOR wave. Because this extraction adds another app-namespace key set with English fallback in the non-English packs, distinct-value coverage is now `es-ES` 44.61%, `fr-FR` 43.93%, `de-DE` 44.25%, `pt-BR` 44.98%, `fi-FI` 43.91%, `ja-JP` 44.45%, `zh-Hans` 44.50%, `ko-KR` 44.89%, `hi-IN` 44.75%, `ar` 2.64%, with `en-US` and `en-XA` at 100%. This remains structurally complete extraction coverage, not yet a fresh native-language drafting pass for the newly added HEOR keys.
- Completed the Morpheus extraction wave on `main`, covering `src/features/morpheus` across the inpatient dashboard, patient journey, location track, medication timeline, diagnoses summary, labs, vitals, microbiology/antibiogram views, concept drawer, dataset selector, export flow, and supporting Morpheus label helpers/constants. The focused Morpheus wave scanner now reports 0 candidates across 33 files, `npm run i18n:scan:app-priority` remains at 0 candidates across 214 files, and the full scanner is down to 1,412 total candidates / 1,040 non-FinnGen candidates. New app-namespace strings live in `frontend/src/i18n/morpheusResources.ts`, with supporting label helpers in `frontend/src/features/morpheus/lib/i18n.ts`. Microbiology/source terminology, organism names, specimen labels, antibiotic names, units, and dataset/source identifiers remain protected where needed while the surrounding inpatient workflow chrome now resolves through app i18n resources.
- Current `npm run i18n:report` still shows 100% key presence and 0 missing keys across all 12 locales / 8 namespaces after the Morpheus wave. Because this extraction adds another app-namespace key set with English fallback in the non-English packs, distinct-value coverage is now `es-ES` 43.49%, `fr-FR` 42.83%, `de-DE` 43.15%, `pt-BR` 43.85%, `fi-FI` 42.81%, `ja-JP` 43.34%, `zh-Hans` 43.39%, `ko-KR` 43.77%, `hi-IN` 43.63%, `ar` 2.57%, with `en-US` and `en-XA` at 100%. This remains structurally complete extraction coverage, not yet a fresh native-language drafting pass for the newly added Morpheus keys.
- Completed the ETL source-profiler and Aqueduct extraction wave on `main`, covering `src/features/etl/pages/SourceProfilerPage.tsx`, the profiler chrome components (`ScanHistorySidebar`, `ScanProgressIndicator`, `CompletenessHeatmap`, `DataQualityScorecard`, `TableSizeChart`, `FkRelationshipGraph`, `TableAccordion`, `PiiBadge`, and `profiler-badges`), and the Aqueduct canvas/modal/editor surfaces under `src/features/etl/components/aqueduct`. The focused ETL/Aqueduct wave scanner now reports 0 candidates across 19 files, `npm run i18n:scan:app-priority` remains at 0 candidates across 214 files, and the full scanner is down to 1,270 total candidates / 898 non-FinnGen candidates. New app-namespace strings live in `frontend/src/i18n/etlAqueductResources.ts`, with supporting label helpers in `frontend/src/features/etl/lib/i18n.ts`. Table names, schema names, CDM column identifiers, OMOP/FHIR/SQL/JSON tokens, and the static `src/features/etl/lib/cdm-schema-v54.ts` standards documentation remain protected where needed while the surrounding ETL workflow chrome now resolves through app i18n resources.
- Current `npm run i18n:report` still shows 100% key presence and 0 missing keys across all 12 locales / 8 namespaces after the ETL/Aqueduct wave. Because this extraction adds another app-namespace key set with English fallback in the non-English packs, distinct-value coverage is now `es-ES` 42.56%, `fr-FR` 41.92%, `de-DE` 42.22%, `pt-BR` 42.91%, `fi-FI` 41.89%, `ja-JP` 42.41%, `zh-Hans` 42.46%, `ko-KR` 42.83%, `hi-IN` 42.70%, `ar` 2.52%, with `en-US` and `en-XA` at 100%. This remains structurally complete extraction coverage, not yet a fresh native-language drafting pass for the newly added ETL source-profiler and Aqueduct keys.
- Completed the GIS / Poseidon / code-explorer / text-to-SQL / Jupyter extraction wave on `main`, covering `src/features/gis`, `src/features/poseidon`, `src/features/code-explorer`, `src/features/text-to-sql`, and `src/features/jupyter`. The focused wave scanner now reports 0 candidates across 90 files, `npm run i18n:scan:app-priority` remains at 0 candidates across 214 files, and the full scanner is down to 1,013 total candidates / 641 non-FinnGen candidates. New app-namespace strings live in `frontend/src/i18n/gisToolsResources.ts`, with supporting helper layers in `frontend/src/features/gis/lib/i18n.ts`, `frontend/src/features/poseidon/lib/i18n.ts`, `frontend/src/features/code-explorer/lib/i18n.ts`, and `frontend/src/features/text-to-sql/lib/i18n.ts`. Translation keys, measurement units, tool/protocol identifiers, and backend/source-driven labels remain protected where needed while the surrounding GIS/orchestration/query-workbench chrome now resolves through app i18n resources.
- Current `npm run i18n:report` still shows 100% key presence and 0 missing keys across all 12 locales / 8 namespaces after the GIS/tooling wave. Because this extraction adds another app-namespace key set with English fallback in the non-English packs, distinct-value coverage is now `es-ES` 40.65%, `fr-FR` 40.03%, `de-DE` 40.33%, `pt-BR` 40.99%, `fi-FI` 40.01%, `ja-JP` 40.51%, `zh-Hans` 40.55%, `ko-KR` 40.91%, `hi-IN` 40.78%, `ar` 2.41%, with `en-US` and `en-XA` at 100%. This remains structurally complete extraction coverage, not yet a fresh native-language drafting pass for the newly added GIS/tooling keys.
- Completed the concept-set and shared-research-primitives extraction wave on `main`, covering `src/features/concept-sets`, `src/components/concept/ConceptSearchInput.tsx`, `src/components/charts/SignificanceVerdictBadge.tsx`, and `src/components/workbench/primitives.tsx`. The focused wave scanner now reports 0 candidates across 19 files, `npm run i18n:scan:app-priority` remains at 0 candidates across 214 files, and the full scanner is down to 912 total candidates / 540 non-FinnGen candidates. New app-namespace strings live in `frontend/src/i18n/conceptSetResources.ts`, with supporting helper labels in `frontend/src/features/concept-sets/lib/i18n.ts`. Separator glyphs, run-status payload values, and data-driven vocabulary/source values remain protected where needed while the surrounding concept-set workflow chrome now resolves through app i18n resources.
- Current `npm run i18n:report` still shows 100% key presence and 0 missing keys across all 12 locales / 8 namespaces after the concept-set/shared-primitives wave. Because this extraction adds another app-namespace key set with English fallback in the non-English packs, distinct-value coverage is now `es-ES` 40.07%, `fr-FR` 39.47%, `de-DE` 39.75%, `pt-BR` 40.41%, `fi-FI` 39.44%, `ja-JP` 39.94%, `zh-Hans` 39.98%, `ko-KR` 40.33%, `hi-IN` 40.20%, `ar` 2.37%, with `en-US` and `en-XA` at 100%. This remains structurally complete extraction coverage, not yet a fresh native-language drafting pass for the newly added concept-set/shared-primitives keys.
- Completed the small-workbench extraction wave on `main`, covering `src/features/study-agent`, `src/features/phenotype-library`, `src/features/community-workbench-sdk`, `src/features/workbench`, and `src/features/etl/pages/EtlToolsPage.tsx`, plus the supporting phenotype/workbench helper layers. The focused wave scanner now reports 0 candidates across 14 files, `npm run i18n:scan:app-priority` remains at 0 candidates across 214 files, and the full scanner is down to 816 total candidates / 444 non-FinnGen candidates. New app-namespace strings live in `frontend/src/i18n/smallWorkbenchResources.ts`, with supporting helper labels in `frontend/src/features/phenotype-library/lib/i18n.ts` and `frontend/src/features/workbench/lib/i18n.ts`. FinnGen-branded launcher copy remains explicitly deferred with `i18n-exempt` handling per the scoped FinnGen exclusion while the surrounding study-designer, phenotype-library, community-SDK, workbench, and ETL-tools chrome now resolves through app i18n resources.
- Current `npm run i18n:report` still shows 100% key presence and 0 missing keys across all 12 locales / 8 namespaces after the small-workbench wave. Because this extraction adds another app-namespace key set with English fallback in the non-English packs, distinct-value coverage is now `es-ES` 39.53%, `fr-FR` 38.93%, `de-DE` 39.22%, `pt-BR` 39.86%, `fi-FI` 38.91%, `ja-JP` 39.40%, `zh-Hans` 39.44%, `ko-KR` 39.79%, `hi-IN` 39.66%, `ar` 2.34%, with `en-US` and `en-XA` at 100%. This remains structurally complete extraction coverage, not yet a fresh native-language drafting pass for the newly added small-workbench keys.
- Completed the legacy Abby AI extraction wave on `main`, covering `src/features/abby-ai`, including the legacy cohort-builder side panel, action-plan card, and research-profile panel. The focused wave scanner now reports 0 candidates across 10 files, `npm run i18n:scan:app-priority` remains at 0 candidates across 214 files, and the full scanner is down to 786 total candidates / 414 non-FinnGen candidates. New app-namespace strings live in `frontend/src/i18n/abbyLegacyResources.ts`, with supporting Abby label helpers in `frontend/src/features/abby-ai/lib/i18n.ts`. Dynamic plan step labels and result payloads remain treated as internal/tool-generated data rather than static UI chrome while the surrounding Abby workflow text now resolves through app i18n resources.
- Current `npm run i18n:report` still shows 100% key presence and 0 missing keys across all 12 locales / 8 namespaces after the legacy Abby wave. Because this extraction adds one more app-namespace key set with English fallback in the non-English packs, distinct-value coverage is now `es-ES` 39.36%, `fr-FR` 38.76%, `de-DE` 39.05%, `pt-BR` 39.69%, `fi-FI` 38.74%, `ja-JP` 39.22%, `zh-Hans` 39.27%, `ko-KR` 39.61%, `hi-IN` 39.49%, `ar` 2.33%, with `en-US` and `en-XA` at 100%. This remains structurally complete extraction coverage, not yet a fresh native-language drafting pass for the newly added Abby keys. With this wave complete, the ordinary non-FinnGen app-surface extraction backlog is exhausted; the remaining non-FinnGen scanner candidates are entirely concentrated in the generated/static policy bucket (`src/features/etl/lib/cdm-schema-v54.ts` and `src/features/standard-pros/data/instruments.ts`).
- Completed the generated/static policy pass on `main`, covering `frontend/scripts/i18n-scan.mjs`, `src/features/etl/lib/cdm-schema-v54.ts`, and `src/features/standard-pros/data/instruments.ts`. Added explicit top-of-file `i18n-exempt-file` support for source-of-truth data assets, then marked the generated OMOP schema prose file and the curated Standard PRO catalog names with that policy. `npm run i18n:scan` now reports 372 total candidates / 0 non-FinnGen candidates across 1,125 scanned files, with the remaining scanner backlog entirely FinnGen-scoped per the standing exclusion. `npm run i18n:scan:app-priority` remains at 0 candidates across 214 files, `npm run i18n:report` remains at 100% key presence with 0 missing keys across all 12 locales / 8 namespaces, and distinct-value coverage is unchanged from the legacy Abby checkpoint because this pass introduced no new translation keys.
- Started the post-extraction native-language drafting/backfill phase on `main` with the HEOR wave for French (`fr-FR`), German (`de-DE`), and Brazilian Portuguese (`pt-BR`). `frontend/src/i18n/heorResources.ts` now carries native overrides instead of pure English fallback for those three locales, covering 165/183 distinct HEOR strings in French, 167/183 in German, and 169/183 in Brazilian Portuguese; the remaining identical strings are the intentional acronym/unit tail such as HEOR, ROI, QALY, WTP, ICER, NMB, and Solr. `npm run i18n:report` remains at 100% key presence / 0 missing keys and now improves overall distinct coverage to `fr-FR` 40.49%, `de-DE` 40.80%, and `pt-BR` 41.46%.
- Continued the post-extraction drafting/backfill phase with the ETL and Aqueduct tranche for French (`fr-FR`), German (`de-DE`), and Brazilian Portuguese (`pt-BR`). `frontend/src/i18n/etlAqueductResources.ts` now carries native overrides across the source profiler and Aqueduct mapping surfaces, and `frontend/src/i18n/smallWorkbenchResources.ts` now carries native overrides for the ETL tools launcher copy that remained under the small-workbench bundle. Current ETL distinct counts are `fr-FR` 182/200, `de-DE` 188/200, and `pt-BR` 190/200; the remaining identical strings are the expected technical tail such as JSON, CSV, `<1%`, `OMOP CDM v5.4`, `S`, and a few same-spelling cognates like `Tables`, `Type`, and `Status`. `npm run i18n:report` remains at 100% key presence / 0 missing keys and now improves overall distinct coverage to `fr-FR` 42.40%, `de-DE` 42.77%, and `pt-BR` 43.45%.
- Continued the post-extraction drafting/backfill phase with the investigation tranche for French (`fr-FR`), German (`de-DE`), and Brazilian Portuguese (`pt-BR`). `frontend/src/i18n/investigationResources.ts` now carries native overrides across the evidence-investigation shell, landing flow, phenotype authoring, clinical analysis launcher/results, genomic evidence, and synthesis surfaces. Current investigation distinct counts are `fr-FR` 427/471, `de-DE` 427/471, and `pt-BR` 433/471; the remaining identical strings are the expected technical or intentionally deferred tail such as FinnGen-tab labels still excluded from scope, `Atlas JSON`, `Open Targets`, notation like `p = {{value}}`, time-range shorthands like `1-3 min`, and ML/acronym labels such as `AdaBoost`, `SCCS`, `AUC / AUROC`, `PPV`, and `NPV`. `npm run i18n:report` remains at 100% key presence / 0 missing keys and now improves overall distinct coverage to `fr-FR` 46.88%, `de-DE` 47.25%, and `pt-BR` 48.00%.
- Continued the post-extraction drafting/backfill phase with the cohort-definition tranche for French (`fr-FR`), German (`de-DE`), and Brazilian Portuguese (`pt-BR`). `frontend/src/i18n/cohortDefinitionResources.ts` now carries native overrides across cohort authoring/list/detail/diagnostics/patient-membership chrome, including the wizard shell, cohort expression flow, generation status, review workflow, and validation/diagnostics controls. Current cohort-definition distinct counts are `fr-FR` 312/557, `de-DE` 314/557, and `pt-BR` 318/557; the remaining identical strings are now concentrated in the technical/proper/same-spelling tail such as `95% CI`, `Circe Compiler`, `Codeset #`, `Concept Set #`, `Cohort A`, `Cohort B`, `Export .md`, `PRS`, `PPV`, `NPV`, `F1`, and a smaller set of deeper cohort-authoring guidance copy still pending a later drafting pass. `npm run i18n:report` remains at 100% key presence / 0 missing keys and now improves overall distinct coverage to `fr-FR` 50.16%, `de-DE` 50.55%, and `pt-BR` 51.33%.
- Continued the post-extraction drafting/backfill phase with the analysis tranche for French (`fr-FR`), German (`de-DE`), and Brazilian Portuguese (`pt-BR`). `frontend/src/i18n/analysisResources.ts` now carries native overrides across the shared analysis shell, delete/execute/status flows, cohort-balance and diagnostics chrome, incidence/estimation/evidence-synthesis labels, prediction/pathway setup prompts, and the common no-data/result-state surfaces. Current analysis distinct counts are `fr-FR` 256/552, `de-DE` 265/552, and `pt-BR` 268/552; the remaining identical strings are now concentrated in the expected technical/statistical tail such as `AUC`, `AUPRC`, `IRR`, `Brier`, `ROC`, `PS AUC`, `Cox proportional hazards`, `Random forest`, `Wt%`, `Time-at-Risk`, and a smaller set of deeper method descriptions and same-spelling cognates still suitable for a later pass. `npm run i18n:report` remains at 100% key presence / 0 missing keys and now improves overall distinct coverage to `fr-FR` 52.84%, `de-DE` 53.33%, and `pt-BR` 54.14%.
- Continued the post-extraction drafting/backfill phase with the profile-similarity tranche for French (`fr-FR`), German (`de-DE`), and Brazilian Portuguese (`pt-BR`). `frontend/src/i18n/profileSimilarityResources.ts` now carries native overrides across the patient-profile shell, cohort browser, labs/notes/visits/timeline chrome, patient-similarity workflow, comparison narratives, cohort export/expand flows, chart explanations, landscape/phenotype diagnostics, network-fusion panels, and researcher-interpretation surfaces. Current profile-similarity distinct counts are `fr-FR` 576/640, `de-DE` 599/640, and `pt-BR` 609/640; the remaining identical strings are now concentrated in the expected technical/proper/same-spelling tail such as `N/A`, `MRN`, `AUC`, `Caliper`, `Embedding`, `|SMD|`, `cohort-members-page{{page}}.csv`, `Patient A`, `Patient B`, and a smaller set of same-spelling profile terms/cognates like `Procedure`, `Observation`, `Normal`, `Status`, and `Date`. `npm run i18n:report` remains at 100% key presence / 0 missing keys and now improves overall distinct coverage to `fr-FR` 58.89%, `de-DE` 59.61%, and `pt-BR` 60.54%.
- Continued the post-extraction drafting/backfill phase with the publish/care-gaps/risk-scores tranche for French (`fr-FR`), German (`de-DE`), and Brazilian Portuguese (`pt-BR`). `frontend/src/i18n/publishCareGapRiskResources.ts` now carries native overrides across the risk-score hub/create/detail/results flow, care-gap bundle design/compliance/population views, and publish document-selection/configuration/preview/export surfaces, including the major template descriptions and section labels. Current publish/care-gap/risk-score distinct counts are `fr-FR` 507/572, `de-DE` 533/572, and `pt-BR` 537/572; the remaining identical strings are now concentrated in the expected technical/proper/same-spelling tail such as `N/A`, `ms`, `SCCS`, `DOCX`, `PDF`, `Figures ZIP`, `Microsoft Word`, `Rate/1000PY`, `95% CI`, `HR`, `IRR`, `AUC`, `AUPRC`, `I²`, placeholder examples like `e.g., E11%` / `CMS122v11`, and a smaller set of same-spelling UI cognates like `Status`, `Score`, `Patients`, `Configuration`, and `Cardiovascular`. `npm run i18n:report` remains at 100% key presence / 0 missing keys and now improves overall distinct coverage to `fr-FR` 64.21%, `de-DE` 65.20%, and `pt-BR` 66.17%.
- Continued the post-extraction drafting/backfill phase with the Strategus tranche for French (`fr-FR`), German (`de-DE`), and Brazilian Portuguese (`pt-BR`). `frontend/src/i18n/strategusResources.ts` now carries native overrides across the study-package wizard, validation/execution flow, JSON preview/editor chrome, cohort-sharing screens, module-settings sections/field labels, and most module descriptions. Current Strategus distinct counts are `fr-FR` 144/167, `de-DE` 148/167, and `pt-BR` 148/167; the remaining identical strings are now concentrated in the expected technical/proper/same-spelling tail such as `Auto`, `Status`, `JSON`, `Bayesian`, model names like `Lasso Logistic Regression`, `Gradient Boosting`, `Random Forest`, `Deep Learning`, preserved OHDSI/Strategus module identifiers like `Cohort Generator`, `Cohort Method`, `Patient Level Prediction`, `Self-Controlled Case Series`, `Evidence Synthesis`, and a few same-spelling UI cognates like `Description`, `Modules`, and `Source`. `npm run i18n:report` remains at 100% key presence / 0 missing keys and now improves overall distinct coverage to `fr-FR` 65.72%, `de-DE` 66.76%, and `pt-BR` 67.72%.
- Continued the post-extraction drafting/backfill phase with the Standard PROs tranche for French (`fr-FR`), German (`de-DE`), and Brazilian Portuguese (`pt-BR`). `frontend/src/i18n/standardProsResources.ts` now carries native overrides across the library/coverage/builder/conduct/public-survey chrome, the major overview/problem/solution/roadmap copy, analytics/check descriptions, survey builder workflow, campaign management surfaces, and instrument-detail states. Current Standard PROs distinct counts are `fr-FR` 393/428, `de-DE` 402/428, and `pt-BR` 410/428; the remaining identical strings are now concentrated in the expected proper/technical/same-spelling tail such as `Standard PROs+`, `PROMIS`, `LOINC`, `SNOMED`, `OMOP`, response-type tokens like `Likert`, `NRS`, `VAS`, import/file terms like `REDCap Dictionary CSV`, `FHIR Questionnaire JSON`, example payload placeholders, and a smaller set of same-spelling UI cognates like `Instrument`, `Version`, `Name`, and `Description`. `npm run i18n:report` remains at 100% key presence / 0 missing keys and now improves overall distinct coverage to `fr-FR` 69.84%, `de-DE` 70.98%, and `pt-BR` 72.03%.

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
- Help-content, route, user-profile, settings endpoint, and Docusaurus documentation site review.

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
- Docusaurus documentation site under `docs/site/`.
- Docusaurus blog content under `docs/blog/`.
- Docusaurus static build output under `docs/dist/` and `docs/site/build/` as generated artifacts, not translation source.
- README/docs/public documentation outside the Docusaurus site.
- Export PDFs and generated documents.
- Admin broadcast emails.
- Survey invitation emails and public survey route.

These should not block the first web-app pilot, but they must be included before claiming full native product availability.

### Docusaurus Documentation Site

Relevant files:

- `docs/site/docusaurus.config.ts`
- `docs/site/package.json`
- `docs/site/sidebars.ts`
- `docs/site/docs/**`
- `docs/site/src/**`
- `docs/blog/**`
- `docs/dist/**`
- `deploy.sh`
- `docker/nginx/default.conf.template`

Findings:

- The Docusaurus v3 user manual is a shipped platform surface served under `/docs/`.
- Docusaurus currently has `i18n.defaultLocale: "en"` and `locales: ["en"]`; no production documentation locales are configured yet.
- The site includes MDX manual pages, generated OpenAPI reference pages, a development blog, Mermaid diagrams, local Lunr search, optional Algolia configuration, and nginx/static deploy plumbing.
- `docs/site/package.json` already has `write-translations`, which is the Docusaurus extraction command for theme/navbar/footer strings.
- `docs/dist/` and `docs/site/build/` are generated outputs and should not be translated directly.
- API route names, endpoint paths, schema names, code blocks, CLI commands, SQL, JSON, and OpenAPI identifiers must remain stable; explanatory prose around them can be localized.
- Docusaurus search must be locale-aware. Local Lunr indexes need per-locale language support where available; Algolia DocSearch would need separate locale facets or indices.

## Definition Of "Native Availability"

A locale is production-supported only when all criteria below are true:

1. Users can choose it in settings, and unauthenticated users can be served it by browser preference or URL/query override.
2. `<html lang>` and `<html dir>` are correct.
3. Navigation, layout, page titles, buttons, forms, modals, table headers, chart labels, validation text, empty states, toasts, help drawer content, public survey copy, and accessibility labels are translated.
4. API error/status messages shown to users are localized or mapped to localized frontend keys.
5. Dates, times, numbers, percentages, currency, units, pluralized phrases, and sorting use the active locale.
6. Emails and export documents generated by Parthenon use recipient/request locale when known.
7. Docusaurus manual pages, docs-site chrome, docs navigation/sidebar labels, docs search, API-reference prose where product-owned, and blog/release-note surfaces included in the release tier are available in that locale.
8. Abby and other AI-generated explanations use the active locale by default, while code/SQL/artifacts remain intact.
9. Clinical terminology uses available same-language OMOP synonyms or clearly falls back to the canonical term.
10. English appears only for proper nouns, code identifiers, unavailable source data, untranslated user-generated content, logs, or documented fallback cases.
11. The locale has passed automated missing-key checks, pseudolocale checks, Playwright smoke tests, Docusaurus build/link/search checks, RTL tests if applicable, and human linguistic QA.

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
- Pseudolocale: `en-XA`
- First production pilot: `es-ES`
- Parallel production candidate: `ko-KR`
- Internal RTL canary: `ar`
- Initial Tier A target candidates: `es-ES`, `ko-KR`
- Wave 1 production candidates: `es-ES`, `fr-FR`, `de-DE`, `pt-BR`, `fi-FI`, `ja-JP`, `zh-Hans`, `ko-KR`, `hi-IN`, `ar`

Current public-selectable languages:

- `en-US`: English baseline.
- `es-ES`: Spanish production pilot.
- `fr-FR`: French Wave 1 app candidate.
- `de-DE`: German Wave 1 app candidate.
- `pt-BR`: Brazilian Portuguese Wave 1 app candidate.
- `fi-FI`: Finnish Wave 1 app candidate.
- `ja-JP`: Japanese Wave 1 app candidate.
- `zh-Hans`: Simplified Chinese Wave 1 app candidate.
- `ko-KR`: Korean production candidate.
- `hi-IN`: Hindi Wave 1 app candidate.

Current internal/QA-only languages:

- `ar`: RTL canary for layout, bidirectional text, and Docusaurus/docs readiness.
- `en-XA`: pseudolocale for expansion and missing extraction checks.

Rationale:

- `es-ES` is the fastest first production pilot because it exercises the full localization pipeline with lower layout risk and strong translation tooling support.
- `ko-KR` should run beside Spanish because it stress-tests non-Latin typography, line wrapping, search/tokenization assumptions, clinical terminology policy, and AI tone/register.
- `es`, `fr`, `de`, `pt-BR` cover common international product expectations.
- `fi-FI` is valuable because FinnGen is a major Parthenon feature.
- `ja-JP`, `zh-Hans`, and `ko-KR` expose East Asian layout, font coverage, line-breaking, and search/sort behavior.
- `hi-IN` exposes Indic-script shaping, Devanagari font coverage, Hindi plural/phrase behavior, and India-specific number/date formatting concerns.
- `ar` forces RTL, bidirectional text, and logical CSS discipline early. It should stay active in engineering smoke tests even if it is not release-blocking for the first production language pack.

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
- Phrase Strings provides key-oriented software localization, while Phrase TMS covers larger help, Docusaurus MDX, blog, export, and email content.
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
- Docusaurus manual/blog prose and generated-doc explanatory prose after code/API artifacts are protected.
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
- Docusaurus MDX/prose refinement after raw MT, while preserving frontmatter, admonitions, MDX imports, links, code fences, Mermaid syntax, and OpenAPI identifiers.
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

The default implementation should allow Class 0 through the Phrase/DeepL/OpenAI workflow, block Class 3, and mark Class 1/2 for explicit policy approval. Docusaurus pages are mostly Class 0, but embedded code/API/schema blocks and generated OpenAPI identifiers are Class 4 and must be protected by the exporter before translation.

### Best-Practice Localization Rules

Follow these rules regardless of provider:

- Use stable semantic keys, not source-English-as-key, for product UI.
- Preserve i18next/ICU placeholders exactly. Translation QA must fail if `{count}`, `{{name}}`, `<0>...</0>`, or HTML/tag placeholders differ.
- Use CLDR plural categories instead of English singular/plural assumptions.
- Set document `lang` and `dir` from the selected locale and use markup, not CSS alone, for bidi direction.
- Use `dir="auto"` or equivalent isolation for mixed-direction user/runtime text.
- Prefer logical CSS properties (`margin-inline-start`, `padding-inline-end`, etc.) as the UI is converted.
- Store a product termbase with "do not translate" entries for Parthenon, Abby, OMOP, OHDSI, CDM, SQL, ICD, SNOMED, LOINC, RxNorm, Atlas, cohort, concept set, and other clinical/product terms.
- Preserve Markdown/MDX structure in docs translations: frontmatter keys, imports/exports, admonition syntax, heading IDs, link targets, code fences, Mermaid diagrams, JSX components, API paths, and anchor slugs.
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
- 25 Docusaurus MDX sections, including one page with frontmatter, one with Mermaid, one with admonitions, one with code fences, and one generated API-reference page.
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
  - `LocaleAssetExporter` to generate TMS upload files from frontend/backend namespaces, help JSON, email/export templates, and Docusaurus MDX/blog/theme strings.
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

1. Add a `translation_assets` tooling path that exports frontend/backend locale namespaces, help JSON, and Docusaurus source content to a TMS-ready JSON/CSV/MDX bundle.
2. Add placeholder/term/MDX structure QA scripts that run locally and in CI.
3. Add provider-neutral backend service interfaces and a no-op/local-file provider.
4. Add a DeepL/OpenAI prototype behind feature flags for Class 0 strings only.
5. Run the bakeoff before purchasing or committing to production provider credentials.

Implementation update:

- Added `scripts/i18n/export-translation-assets.mjs` as the first repo-managed `translation_assets` pipeline.
- Added `scripts/i18n/validate-translation-assets.mjs` as the first local asset QA gate.
- Added `scripts/i18n/import-translation-assets.mjs` as the first safe reviewed-asset import/staging path.
- Added provider-neutral backend translation contracts, DTOs, data-class policy, placeholder integrity checks, and a local provider that never calls an external service.
- Added `translation:draft-assets` as a provider-backed Artisan command for drafting/reviewing exported message rows before import.
- Default export locale set is the public pilot set: `en-US`, `es-ES`, and `ko-KR`.
- Export outputs are written under `output/translation-assets/**` and are intentionally ignored build artifacts.
- The exporter emits:
  - frontend i18next namespace JSON plus `messages.json` and `messages.csv`;
  - backend Laravel lang JSON plus `messages.json` and `messages.csv`;
  - contextual help JSON plus `messages.json` and `messages.csv`;
  - Docusaurus source MDX/blog copies, `documents.json`, `documents.csv`, locale metadata, copied docs-site config/sidebar sources, and MDX protection notes.
- The validator checks placeholder parity, HTML/MDX tag parity, protected-term warnings, Docusaurus copied source files, balanced code fences, preserved frontmatter, and generated-output leakage.
- The importer validates first, stages frontend/backend reviewed JSON for review, supports deterministic help JSON apply, and supports Docusaurus translated MDX apply from `docusaurus/translated/{docusaurusLocale}/{docs|blog}/**`.
- Generated docs surfaces are excluded: `docs/site/build/**`, `docs/dist/**`, and `docs/site/.docusaurus/**`.
- The backend `finngen` namespace is excluded while FinnGen remains under active development.
- Package shortcuts:
  - `cd frontend && npm run i18n:export-assets`
  - `cd frontend && npm run i18n:validate-assets`
  - `cd frontend && npm run i18n:import-assets`
  - `cd docs/site && npm run i18n:export-assets`
  - `cd docs/site && npm run i18n:validate-assets`
  - `cd docs/site && npm run i18n:import-assets`
- Smoke export result for the pilot set:
  - frontend: 951 source keys, 1,902 target rows;
  - backend: 87 source keys, 174 target rows;
  - help: 456 source strings, 912 target rows;
  - Docusaurus: 146 source documents, including 91 docs pages and 55 blog posts.
- Smoke validation result for the pilot set: 0 errors, with 896 expected contextual-help missing-translation warnings until help topics are translated beyond the Dashboard pilot.
- Smoke import dry-run result for the pilot set: validation passed, staged 2 frontend locale JSON files, 2 backend locale JSON files, 1 Spanish help topic, and 2 Docusaurus locale dropoff plans.
- Backend translation contract tests pass with an in-memory test database: provider binding, source fallback behavior, placeholder/tag review, PHI blocking, and placeholder extraction.
- Backend draft command tests pass with an in-memory test database: missing-row drafting, local source fallback marking, and fail-on-review placeholder enforcement.
- Smoke provider draft result for the current pilot bundle: local provider drafted 896 missing contextual-help rows, with 0 review failures and 896 source-fallback warnings.
- Korean Dashboard contextual help is localized. Help validation now reports 896 missing contextual-help rows instead of 904.
- Spanish and Korean core contextual help is localized for Abby AI, Studies, Cohort Builder, Concept Set Builder, Data Explorer, Analyses, Jobs, Administration, and Vocabulary Search.
- Smoke validation after the core help pack reports 0 errors and 762 missing contextual-help warnings. Smoke import dry-run now previews 20 localized help files across Spanish and Korean.
- Spanish and Korean analysis/cohort/data-quality contextual help is localized for Characterization, Incidence Rates, Population-Level Estimation, Patient-Level Prediction, Treatment Pathways, Evidence Synthesis, SCCS, Cohort Builder primary criteria/inclusion/exit subpages, Data Quality Dashboard, Achilles Heel, and Source Profiler.
- Smoke validation after the analysis/cohort/data-quality help pack reports 0 errors and 568 missing contextual-help warnings. Smoke import dry-run now previews 46 localized help files across Spanish and Korean.
- Spanish and Korean administration contextual help is localized for AI Providers, Auth Providers, FHIR Connections, FHIR Export, FHIR Sync Monitor, Notifications, Roles, Solr, System Health, Users, Vocabulary, WebAPI Registry, and the Administration overview.
- Smoke validation after the administration help pack reports 0 errors and 346 missing contextual-help warnings. Smoke import dry-run now previews 72 localized help files across Spanish and Korean.
- Spanish and Korean contextual help now covers every English help topic in `backend/resources/help`, including care gaps, data ingestion, data sources, ETL/FHIR tooling, genomics, GIS, HEOR, imaging, Jupyter, mapping, patient profiles/timelines/similarity, publishing, query assistant, study designer, and study packages.
- Smoke validation after the full help pack reports 0 errors and 0 warnings across the pilot translation asset bundle. Smoke import dry-run now previews 112 localized help files across Spanish and Korean, and `translation:draft-assets` reports 0 candidate rows.
- Added a contextual-help regression test that requires every English help topic to have Spanish and Korean pilot files with matching help keys, so new help pages cannot silently fall back in the public pilot languages.
- Added native Docusaurus i18n catalogs for Spanish (`es`) and Korean (`ko`) covering generated theme strings, navbar labels, footer labels, docs sidebar labels, and blog chrome.
- Added the Docusaurus navbar locale dropdown and limited public docs-site locales to the current pilot set (`en`, `es`, `ko`) so unfinished QA-only locales are not exposed in the docs UI.
- Docusaurus locale build smoke checks pass for Spanish and Korean with `npx docusaurus build --locale es --out-dir build-es-smoke` and `npx docusaurus build --locale ko --out-dir build-ko-smoke`. Both builds report the existing `vscode-languageserver-types` dynamic require warning only.
- Added Spanish and Korean native MDX translations for the Docusaurus user-manual entry page (`intro.mdx`) as the first docs-content slice. Locale build smoke checks pass when run sequentially; Docusaurus locale builds should not be run in parallel because they share the generated `.docusaurus` cache.
- Added Spanish and Korean native MDX translations for the Docusaurus Dashboard page (`part1-getting-started/00-dashboard.mdx`) so the public pilot docs include a localized high-visibility feature page.
- Added `scripts/i18n/report-docusaurus-coverage.mjs` and `cd docs/site && npm run i18n:coverage` to report docs/blog source counts, translated Spanish/Korean counts, missing files by locale, and Docusaurus chrome catalog presence. Current coverage report: 91 docs and 55 blog posts in source; Spanish and Korean each have 2/91 docs translated, 0/55 blog posts translated, 5/5 chrome catalogs present.
- Added Spanish and Korean native MDX translations for `part1-getting-started/01-introduction.mdx`. Current coverage report: Spanish and Korean each have 3/91 docs translated, 0/55 blog posts translated, and 5/5 chrome catalogs present.
- Added Spanish and Korean native MDX translations for `part1-getting-started/02-data-sources.mdx`, preserving stable in-page anchors for localized section headings. Current coverage report: Spanish and Korean each have 4/91 docs translated, 0/55 blog posts translated, and 5/5 chrome catalogs present.
- Added Spanish and Korean native MDX translations for `part2-vocabulary/03-vocabulary-browser.mdx`, preserving the stable `#vocabulary-versions` anchor used by the Concept Sets page. Current coverage report: Spanish and Korean each have 5/91 docs translated, 0/55 blog posts translated, and 5/5 chrome catalogs present.
- Added Spanish and Korean native MDX translations for `part2-vocabulary/04-concept-sets.mdx`, keeping the OHDSI/Atlas-compatible JSON export example unchanged. Current coverage report: Spanish and Korean each have 6/91 docs translated, 0/55 blog posts translated, and 5/5 chrome catalogs present.
- Added Spanish and Korean native MDX translations for `part3-cohorts/06-building-cohorts.mdx`, preserving CIRCE, SQL, and example cohort identifiers. Current coverage report: Spanish and Korean each have 7/91 docs translated, 0/55 blog posts translated, and 5/5 chrome catalogs present.
- Added Spanish and Korean native MDX translations for `part6-data-explorer/18-characterization-achilles.mdx`, preserving Achilles schema, service, and analysis identifier names. Current coverage report: Spanish and Korean each have 8/91 docs translated, 0/55 blog posts translated, and 5/5 chrome catalogs present.
- Added Spanish and Korean native MDX translations for `part6-data-explorer/19-data-quality-dashboard.mdx`, preserving DQD, Achilles Heel, and threshold terminology. Current coverage report: Spanish and Korean each have 9/91 docs translated, 0/55 blog posts translated, and 5/5 chrome catalogs present.
- Added Spanish and Korean native MDX translations for `part8-administration/22-user-management.mdx`, preserving role, token, mail-driver, and Artisan command identifiers. Current coverage report: Spanish and Korean each have 10/91 docs translated, 0/55 blog posts translated, and 5/5 chrome catalogs present.
- Added `docs/site/.npmrc` with `legacy-peer-deps=true` so plain `npm ci` in the docs package follows the documented React 19/local-search peer dependency workaround until the local-search package peer range catches up.
- Re-centered the next phase on app surfaces before additional docs content. Added the `app` i18next namespace for cross-app route/error/covariate copy, localized that slice in English, Spanish, and Korean, and added `npm run i18n:scan:app-priority` for Studies, Jobs, Administration/Honest Broker, Vocabulary/Mapping Assistant, Data Explorer, shared analysis controls, route errors, and global error copy. The extracted app-foundation slice now reports 0 scanner candidates across its 4 touched app files. Studies list/create, Jobs page/detail drawer, Study Design Workbench, Study Detail frame, Study Designer, Study Dashboard, Study Analyses tab, Study Results tab, Federated Execution tab, Study Artifacts, Sites, Cohorts, Team, Milestones, Activity, StudyList, Administration/Honest Broker, Vocabulary/Mapping Assistant, and the first Data Explorer shell/overview/execution-tab/Ares-hub plus Ares Unmapped Codes, Concept Comparison, Releases, Diversity, Cost, Feasibility, and Network Overview slices are also extracted and deployed. The full Studies feature scan now reports 0 candidates across 21 files, Honest Broker reports 0 candidates, Mapping Assistant reports 0 candidates, Data Explorer shell/overview/Achilles/DQD/Ares-hub/Unmapped-Codes/Concept-Comparison/Releases/Diversity/Cost/Feasibility/Network-Overview slice reports 0 candidates across 17 files, the remaining Data Explorer backlog is 229 candidates across 101 files, and the current app-priority backlog is 1,030 candidates across 214 files.
- Completed the Ares app-surface localization checkpoint for English, Spanish, and Korean. The full `frontend/src/features/data-explorer/components/ares` scanner now reports 0 candidates across 54 files, including hub/breadcrumbs, Unmapped Codes, Concept Comparison, Releases, Diversity, Cost, Feasibility, Network Overview, Annotations, Coverage, DQ History, and all supporting Ares helper charts/forms. Current focused app-priority backlog after this checkpoint is 855 candidates across 214 files, with remaining work now concentrated outside Ares, especially high-volume Administration and Vocabulary panels plus non-Ares Data Explorer surfaces.
- Completed the first high-volume Administration app-surface checkpoint for English, Spanish, and Korean. `AdminDashboardPage`, `AtlasMigrationWizard`, `FhirConnectionsPage`, `SystemHealthPage`, `VocabularyPage`, `FhirSyncDashboardPage`, and `GisDataPanel` now report 0 scanner candidates across the focused Administration slice. The broader Administration scan dropped from 695 candidates to 409 candidates across 66 files, and the focused app-priority scan dropped to 569 candidates across 214 files. Verification passed with `npm run i18n:report` (0 missing keys), focused Administration scanners, focused ESLint, `npx tsc --noEmit`, and `COMPOSE_PROJECT_NAME=parthenon ./deploy.sh --frontend`; deploy smoke passed for `/`, `/login`, and `/jobs`. The next app-first targets are Vocabulary detail/search panels, Chroma/Vector administration panels, PACS administration, Users/Roles/Auth Providers, Service Detail/User Audit, and the remaining non-Ares Data Explorer surfaces.

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

### Docusaurus Site

Docusaurus is part of native platform availability, not a separate optional documentation project.

Source surfaces:

- `docs/site/docs/**`: user manual, migration guide, architecture pages, generated API docs output checked into the Docusaurus docs tree.
- `docs/blog/**`: development blog and release communication where product-facing.
- `docs/site/docusaurus.config.ts`: navbar, footer, tagline, metadata, locale config, search config.
- `docs/site/sidebars.ts`: sidebar labels and generated API sidebar labels.
- `docs/site/src/**`: custom pages/components/CSS that contain user-visible documentation chrome.

Generated surfaces:

- `docs/dist/**` and `docs/site/build/**` are build output. Never translate these directly.
- Build localized docs with the Docusaurus source/i18n folders and deploy with `./deploy.sh --docs`.

Docusaurus i18n tasks:

- Expand `docs/site/docusaurus.config.ts` from `locales: ["en"]` to the supported docs locale set, using Docusaurus-compatible locale IDs.
- Run `npm run write-translations` from `docs/site` to extract theme/navbar/footer strings.
- Add Docusaurus i18n folders for each Tier A docs locale, for example `docs/site/i18n/{locale}/docusaurus-plugin-content-docs/current/**`, `docs/site/i18n/{locale}/docusaurus-plugin-content-blog/**`, and theme translation JSON.
- Localize MDX prose, headings, sidebar/category labels, navbar/footer labels, page titles/descriptions, admonition prose, alt text, and search metadata.
- Preserve frontmatter keys, explicit `id` and `slug` values, link targets, heading anchors used by in-app help, MDX imports/exports, JSX component names/props that are code, admonition markers, code fences, Mermaid diagrams, API paths, and OpenAPI schema identifiers.
- Decide whether translated docs use localized slugs or stable English slugs. Recommendation: keep stable route slugs for in-app help links and use localized titles/headings. If localized slugs are later required, add redirect maps and help-link locale routing.
- Configure docs search per locale. For local Lunr, verify language support and index generation for each locale. For Algolia, use locale-aware indices/facets and keep `/docs/{locale}/...` routing searchable.
- Ensure OpenAPI generated docs separate immutable API artifacts from translatable summaries/descriptions. Endpoint paths, HTTP methods, request/response field names, enum values, and examples remain unchanged.
- Include docs in the same termbase as the app. Product terms, clinical vocabulary, abbreviations, and code-like tokens must stay consistent across app UI, help JSON, Docusaurus, emails, exports, and Abby.

Docusaurus acceptance:

- `./deploy.sh --docs` succeeds for all enabled docs locales.
- `/docs/` and locale-specific docs routes render with correct `lang`/`dir`.
- Sidebar, navbar, footer, search UI, blog archive, docs pages, and API reference chrome are localized.
- In-app help `docs_url` links resolve for each locale or intentionally fall back to the English route.
- Localized search returns results for translated pages and does not cross-pollute unrelated locales.
- Link checking passes with known `/docs/api` integration exceptions documented.
- RTL docs locale smoke tests cover navigation, sidebars, code blocks, Mermaid diagrams, tables, admonitions, and search.

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
- Docusaurus MDX prose, frontmatter titles/descriptions, sidebar labels, navbar/footer labels, blog metadata, docs custom components, and OpenAPI generated prose.

Allowlist:

- Routes and API paths.
- CSS classes.
- Permission names and role identifiers.
- Query keys.
- SQL and code snippets.
- Markdown/MDX code fences, imports/exports, Mermaid syntax, frontmatter keys, explicit route slugs/IDs, Docusaurus config keys, OpenAPI operation IDs, schema names, field names, enum values, and examples where the value is part of an API contract.
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
- Confirm what "native" includes for v1: web app, public survey, emails, help, exports, installer, Docusaurus docs site, Docusaurus blog/release notes, generated API docs, and public/static docs.
- Choose translation storage location: repo JSON, backend-served JSON, or external TMS integration.
- Decide if machine translation can be used for drafts.
- Decide review level for clinical/medical text.
- Define terminology glossary owners.
- Decide whether docs locales keep stable English route slugs or localized slugs with redirects. Recommendation: stable slugs for v1.

Acceptance:

- Written scope and tier definitions.
- Locale list with BCP 47 tags, native names, direction, fallback chain, and support tier.
- Documentation surfaces are explicitly assigned to Tier A/B/C rules, including Docusaurus manual, blog, generated API docs, and in-app help docs links.

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

Docusaurus tasks:

- Add supported docs locales to `docs/site/docusaurus.config.ts`.
- Run Docusaurus translation extraction for navbar/footer/theme strings.
- Add docs locale routing strategy and fallback policy to the in-app help link resolver.
- Add a Docusaurus source inventory to the i18n scanner without touching generated `docs/dist/**`.

Acceptance:

- User can change language setting and see shell/nav/settings update.
- Browser preference works for unauthenticated login/register.
- `Accept-Language` and `X-Parthenon-Locale` flow to backend.
- HTML `lang`/`dir` updates.
- Pseudolocale shows expanded shell text.
- Docusaurus can build with the base English locale after i18n config changes.
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

### Phase 3: Backend, Help, Docusaurus, Emails, And Exports

Duration: 2-4 weeks, overlaps Phase 2

Tasks:

- Convert common API response messages to keyed translations.
- Localize Laravel validation messages and field labels.
- Implement help locale fallback.
- Configure Docusaurus locale directories for Tier A docs locales.
- Localize Docusaurus docs-site chrome, sidebars, and top-priority manual pages.
- Add Docusaurus MDX structure validation to prevent broken frontmatter, links, code fences, Mermaid diagrams, admonitions, imports, and OpenAPI identifiers.
- Wire in-app help docs links to locale-specific Docusaurus routes with English fallback.
- Add docs search validation for each docs locale.
- Localize email subjects and Blade templates.
- Localize export labels.
- Decide changelog behavior.
- Add backend tests for locale negotiation and fallback.

Acceptance:

- API returns localized messages for common profile/auth/help/admin errors.
- Help content resolves `{locale}/{key}.json` with fallback.
- Docusaurus builds through `./deploy.sh --docs` and produces localized route output for enabled docs locales.
- Localized Docusaurus pages preserve code/API artifacts and pass link/search smoke checks.
- Help `docs_url` links resolve in the active locale or use documented English fallback.
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
- Add Docusaurus RTL smoke tests for `/docs/`, a manual page, an API reference page, blog index, search, a Mermaid page, and a table-heavy page.
- Verify keyboard/focus behavior in mirrored layouts.
- Verify `dir="auto"` in user-generated and source-data text.
- Run accessibility checks for labels and language attributes.

Acceptance:

- Arabic/Hebrew canary renders without major layout breakage in shell, tables, forms, drawers, modals, and chat/wiki content.
- Arabic/Hebrew Docusaurus routes render navigation, sidebar, search, admonitions, code blocks, tables, and diagrams without major layout breakage.
- Screenshots show no clipped primary actions under pseudolocale.
- Accessibility labels are translated or intentionally stable.

### Phase 6: Translation Production And Release

Duration: 1-3 weeks per production locale, parallelizable

Tasks:

- Export strings to translators/TMS.
- Translate product UI.
- Translate help content and emails.
- Translate Docusaurus manual/blog/docs-site chrome for the target tier.
- Review clinical/research terminology.
- Import translations.
- Run automated parity checks.
- Run Docusaurus build/link/search checks.
- Linguistic QA by native reviewer.
- Product QA in target workflows.
- Release as Tier A or Tier B language.

Acceptance:

- Translation coverage meets threshold.
- Human reviewer signs off.
- Docusaurus target-locale docs meet the same release tier as the app surface, or the fallback is explicitly documented for Tier B/C.
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

### Epic 7: Docusaurus Documentation Site

Tasks:

- Add Docusaurus locale configuration in `docs/site/docusaurus.config.ts`.
- Run `npm run write-translations` from `docs/site` and commit generated translation JSON.
- Add `docs/site/i18n/{locale}/...` source folders for manual pages, blog posts, and theme strings.
- Localize `docs/site/docs/**` MDX prose and `docs/blog/**` content by tier.
- Localize navbar/footer/sidebar labels and docs metadata.
- Preserve route IDs/slugs, heading IDs used by help links, MDX imports, code fences, Mermaid diagrams, and OpenAPI identifiers.
- Add MDX structure checks for translated docs.
- Add docs search checks per locale.
- Build and deploy docs with `./deploy.sh --docs`.

Tests:

- Docusaurus builds for English and pilot locale.
- Localized docs route resolves from in-app `docs_url`.
- Search returns locale-specific results.
- API reference identifiers remain unchanged.
- RTL docs smoke route renders sidebar, search, tables, code, and Mermaid diagrams.

### Epic 8: Emails And Exports

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

### Epic 9: Clinical Terminology

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

### Epic 10: AI Localization

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

### Epic 11: Governance And Translation Operations

Tasks:

- Select translation workflow: repo PRs, TMS, vendor, or hybrid.
- Create glossary: Parthenon, Abby, OHDSI, OMOP, CDM, cohort, concept set, incidence rate, estimation, prediction, SCCS, HEOR, DQD, Ares, FinnGen.
- Create style guide by language.
- Define reviewer roles.
- Define fallback and versioning policy.
- Define documentation localization policy for manual pages, blog posts, release notes, generated API docs, and in-app help `docs_url` fallback.
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
- Docusaurus translation asset inventory and MDX structure validation.
- Backend localized response helper.

Integration tests:

- Login/register/profile/settings.
- API error localization.
- Vocabulary synonym lookup by locale.
- Abby locale propagation.
- Help `docs_url` locale fallback to Docusaurus routes.

Playwright/e2e:

- `en-US` baseline smoke.
- Pseudolocale smoke across core routes.
- Pilot locale smoke.
- RTL canary smoke.
- Public survey route.
- Shared cohort route.
- Docusaurus manual route, API reference route, blog index, search, Mermaid page, and table-heavy page.

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
- Docusaurus page language, direction, skip links, sidebar navigation, search dialog labels, and code block controls.

Performance checks:

- Initial bundle size before/after.
- Locale namespace lazy loading.
- Cache headers for locale JSON.
- Avoid loading all languages for every user.
- Docusaurus build size, per-locale search index size, static asset cache behavior, and docs route generation time.

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
- Docusaurus locale config and top-priority docs route fallback from in-app help.

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
- Emails/help/Docusaurus/public flows included.
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
- Docusaurus documentation localization infrastructure: 1-2 weeks.
- Docusaurus content translation/review: 1-4 weeks per target docs tier, depending on how much manual/blog/API prose is included.
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

## Branch Execution Plan

This section turns the strategy above into a branch-level implementation checklist for `feature/parthenon-native-i18n`. The branch should stay reviewable by landing small PR-sized slices that each leave the platform in a working state.

### Initial Phase TODOs

#### Phase A: Branch And Scope Lock

- [x] Create `feature/parthenon-native-i18n`.
- [x] Record Spanish (`es-ES`) as the first production pilot.
- [x] Record Korean (`ko-KR`) as the parallel production candidate.
- [x] Record Arabic (`ar`) as an internal RTL canary.
- [x] Keep `en-XA` as the layout-expansion pseudolocale.
- [x] Decide whether non-pilot Wave 1 locales are public-selectable previews or hidden until certified.
- [ ] Decide whether installer GUI and public install pages are included in v1 native scope.
- [ ] Decide whether Docusaurus v1 Tier A includes the manual only or also blog, API docs, migration guide, and release notes.

#### Phase B: Canonical Locale Registry

- [x] Expand locale metadata to include BCP 47 tag, Laravel tag, Docusaurus tag, English label, native label, direction, date locale, number locale, fallback chain, release tier, and QA/public-selectability flags.
- [x] Use the same normalization semantics in frontend and backend: exact match, case-insensitive match, underscore-to-hyphen match, language-only fallback, then `en-US`.
- [x] Normalize the persisted user locale before saving it.
- [x] Return the normalized locale in `/api/v1/user/locale`.
- [x] Expose release-tier metadata to frontend UI and future translation tooling.
- [x] Align Docusaurus `i18n` config with the initial docs locale set: English, Spanish, Korean, and Arabic canary.
- [x] Add tests proving Spanish, Korean, Arabic, and pseudolocale metadata stay valid.

#### Phase C: Runtime And Preference Hardening

- [x] Confirm topnav selector and Settings `Language & Region` use canonical metadata, with user-facing controls limited to public-selectable locales.
- [x] Confirm preference precedence: authenticated user locale, explicit request/query locale, stored local browser preference, browser language, default English.
- [x] Confirm locale changes update `document.documentElement.lang` and `dir`.
- [x] Confirm API requests send both `Accept-Language` and `X-Parthenon-Locale`.
- [x] Add a targeted test for failed locale saves rolling back optimistic frontend state.
- [x] Add missing-key telemetry in development/test mode.
- [x] Add frontend/backend locale metadata parity checks to prevent registry drift.
- [x] Validate the signed-in language preference flow against the deployed app with the admin smoke account.

#### Phase D: First Translation Coverage Slice

- [x] Treat shell/auth/settings/help as the first Spanish/Korean production coverage slice.
- [x] Add or verify Spanish and Korean resources for shell, auth, settings, profile, help chrome, backend auth, backend profile, and backend help strings.
- [ ] Keep Arabic and `en-XA` in smoke tests for layout and direction only.
- [x] Add missing-key telemetry in warn-only mode.
- [x] Add hardcoded user-facing string scanner/reporting in warn-only mode.
- [x] Add a translation completeness report for `en-US`, `es-ES`, `ko-KR`, `ar`, and `en-XA`.
- [x] Run focused frontend and backend locale tests before expanding into more surfaces.

#### Next Phase TODOs

Current ordering: adhere to the original app-first plan. Product/app surfaces take priority until the pilot app experience is convincingly native in English, Spanish, and Korean. Docusaurus remains in the program, but additional docs-content translation waits behind app-surface extraction and visual proof.

- [x] Finish the high-visibility Docusaurus docs pilot for Spanish and Korean: Introduction, Data Sources, Vocabulary Browser, Concept Sets, Building Cohorts, Achilles Characterization, Data Quality Dashboard, and User Management are complete.
- [x] Add Docusaurus translation coverage tracking that reports source docs/blog counts, translated Spanish/Korean counts, and missing files by locale without failing CI until thresholds are agreed.
- [x] Resolve or document the docs dependency install path: `docs/site` now has a package-scoped `.npmrc` so `npm ci` uses `legacy-peer-deps=true` for the React 19/local-search peer range conflict.
- [x] Extract the next app-surface wave from the full scanner, starting with cross-app route errors, global error boundary copy, shared analysis controls, Studies, Jobs, Administration/Honest Broker, Vocabulary/Mapping Assistant, and Data Explorer surfaces. Cross-app route errors, global error boundary copy, shared analysis covariate controls, Studies, Jobs page/detail drawer, Administration/Honest Broker, Vocabulary/Mapping Assistant, and the app-priority Administration / Vocabulary / Data Explorer surfaces are now extracted. The focused app-priority scanner now reports 0 candidates across 214 files. The full frontend scanner remains broader than the release-priority app scope and reports 5,704 candidates across 1,103 files, or 5,332 candidates when active FinnGen paths are excluded.
- [x] Add `npm run i18n:scan:app-priority` or an equivalent focused scanner scope for the app-first wave so progress can be measured separately from Docusaurus and generated/static surfaces.
- [x] Triage the full frontend scanner backlog into release-blocking user surfaces, generated/static data surfaces, intentional non-translatable strings, and later extraction waves. Current scan after the imaging/genomics/radiogenomics wave: 3,207 total candidates, 372 FinnGen candidates excluded from this i18n track, and 2,835 non-FinnGen candidates. Detailed triage and extraction order are captured in `docs/superpowers/specs/2026-04-20-i18n-full-scanner-backlog-triage.md`.
- [x] Complete the data-source setup and ingestion extraction wave from the full scanner. `src/features/data-sources`, `src/features/ingestion`, and FHIR ingestion/export chrome now report 0 candidates across 46 files; after the later imaging/genomics/radiogenomics wave the full scanner stands at 3,207 total candidates and 2,835 non-FinnGen candidates.
- [x] Complete the cohort authoring and diagnostics extraction wave from the full scanner. `src/features/cohort-definitions` now reports 0 candidates across 62 files, including list/detail, expression editor, validation, diagnostics, attrition, patient list, Circe SQL, wizard, temporal presets, and shared cohort surfaces; after the later imaging/genomics/radiogenomics wave the full scanner stands at 3,207 total candidates and 2,835 non-FinnGen candidates.
- [x] Complete the analysis design and results extraction wave from the full scanner. `src/features/analyses`, `src/features/estimation`, `src/features/prediction`, `src/features/pathways`, `src/features/sccs`, `src/features/self-controlled-cohort`, and `src/features/evidence-synthesis` now report 0 candidates in the focused analytics wave command across 75 files; after the later imaging/genomics/radiogenomics wave the full scanner stands at 3,207 total candidates and 2,835 non-FinnGen candidates.
- [x] Complete the Standard PROs UI extraction wave from the full scanner. `src/features/standard-pros/components`, `src/features/standard-pros/pages`, and the user-facing Standard PROs import/error helper paths now report 0 candidates across the focused wave command. The full `src/features/standard-pros` folder is down to 99 candidates across 23 files, all intentionally confined to `src/features/standard-pros/data/instruments.ts` as curated instrument content.
- [x] Complete the imaging, genomics, and radiogenomics extraction wave from the full scanner. `src/features/imaging`, `src/features/genomics`, and `src/features/radiogenomics` now report 0 candidates across the focused wave scans (14 imaging files, 9 genomics files, and 4 radiogenomics files). DICOM/OHIF/PACS identifiers, modality/source codes, measurement units, and backend significance matching keys remain protected via targeted translation keys or explicit exemptions.
- [x] Run visual smoke screenshots for app Dashboard, topnav language selector, Dashboard contextual help, route/error states, and the next translated app surface in English, Spanish, and Korean. `e2e/tests/i18n-visual-smoke.spec.ts` covers `en-US`, `es-ES`, and `ko-KR`; Chromium passed 3/3 with screenshots under `e2e/screenshots/i18n-visual-smoke/`.
- [x] Refresh or open the PR once the next app-surface slice is complete, with the branch story centered on native app i18n, per-user language preference, complete pilot contextual help, and Docusaurus native locale infrastructure/chrome as supporting proof rather than the main thrust. Opened PR #215 from `codex/parthenon-i18n-app-priority`.
- [x] Complete the Wave 1 language-pack drafting pass for `fr-FR`, `de-DE`, and `pt-BR`; app-priority resources now report greater than 93% distinct overall coverage for each locale and the three locales are public-selectable app languages. Keep Arabic as an RTL canary until right-to-left visual certification is complete.
- [x] Complete the next hidden Wave 1 language-pack drafting pass for `fi-FI`, `ja-JP`, and `zh-Hans`, following the same namespace order: setup/shared shell, `commons`, app `covariates`/`jobs`, `vocabulary`, `dataExplorer`, `studies`, then `administration`; these three locales now report greater than 93% distinct overall coverage and are public-selectable app languages.
- [x] Complete and promote the final hidden Wave 1 app locale, `hi-IN`; Hindi now follows the same resource order, clears the placeholder/protected-term audit, reports greater than 95% distinct overall coverage, and is public-selectable in frontend and backend locale metadata.

Branch goals:

1. Establish one canonical locale registry for the platform, docs, backend, and translation tooling.
2. Make the signed-in app remember a per-user preferred language and apply it consistently.
3. Convert user-facing strings into stable translation keys with English as the source language.
4. Add CI and scanner coverage so new pages and features cannot silently bypass i18n.
5. Bring Docusaurus into the same localization program as the product UI.
6. Define the translation operations path for AI drafts, TMS sync, review, fallback, and release.
7. Prepare the branch for progressive language-pack production without blocking feature delivery.

### Branch Working Agreement

- Keep English source strings stable once extracted. Renames should be treated as migration work because they invalidate translation memory.
- Prefer one PR per surface or capability. Avoid broad "translate everything" PRs that mix runtime changes, content changes, and visual fixes.
- Every PR that adds user-facing text must either add translation keys or explicitly document why the text is source-data, code, or intentionally untranslated.
- Missing translations are allowed during feature development only when the fallback is visible in tooling and safe at runtime.
- Release branches should fail on missing Tier A translations for release-blocking surfaces.
- Feature branches should warn on missing translations unless the feature is marked release-ready.
- Docusaurus source content is translated from `docs/site/**` and related source directories, never from generated `docs/dist/**` or `docs/site/build/**`.
- Clinical vocabulary/source values are not machine-translated as if they were UI copy. They use source terminology tables, explicit fallback labels, or curated terminology assets.
- AI-generated copy must receive the user's locale, source/fallback metadata, and formatting conventions. It must not invent translated clinical labels when source data is unavailable.

### Definition Of Ready For Each PR

Before starting a PR slice:

- The target surface and ownership are named.
- English source strings and translation namespace are identified.
- Fallback behavior is defined.
- Tests or verification commands are listed.
- Any data/privacy class for text sent to an external translation service is identified.
- Docusaurus impact is checked if the PR changes public docs, docs navigation, release notes, generated API documentation, or help links.

### Definition Of Done For Each PR

A PR slice is done when:

- New user-facing strings are extracted to the agreed namespace or intentionally exempted.
- Existing supported locales either have translations, pseudolocale coverage, or documented fallback.
- `en-XA` can expose layout expansion issues for the changed frontend surface.
- RTL behavior is checked when layout or chrome changes.
- Backend responses include stable message keys where clients need localized rendering.
- Docusaurus changes build through `./deploy.sh --docs` when docs are touched.
- Frontend changes deploy through `./deploy.sh --frontend` when shipped assets are touched.
- Scanner, typecheck, unit, and smoke checks are updated or explicitly deferred with a follow-up item.

### PR Sequence

#### PR 0: Branch Setup And Plan Lock

Scope:

- Create `feature/parthenon-native-i18n`.
- Add this execution checklist.
- Confirm the branch status and existing dirty files.
- Lock Spanish (`es-ES`) as the first production pilot, Korean (`ko-KR`) as the parallel production candidate, and Arabic (`ar`) as the internal RTL canary.

Acceptance criteria:

- Branch exists locally.
- Plan names branch, PR sequence, acceptance gates, and open decisions.
- Plan records the initial Spanish/Korean rollout decision and Arabic canary stance.
- No runtime code behavior changes are introduced by this PR.

Verification:

- `git status --short --branch`
- `git diff --check`

Status: Complete for planning scope; implementation continues with PR 1.

#### PR 1: Canonical Locale Registry And User Preference Contract

Scope:

- Finalize a shared locale registry for frontend, Laravel, Docusaurus, and translation tooling.
- Confirm BCP 47 tags: `en-US`, `es-ES`, `fr-FR`, `de-DE`, `pt-BR`, `fi-FI`, `ja-JP`, `zh-Hans`, `ko-KR`, `hi-IN`, `ar`, `en-XA`.
- Ensure user preference persistence uses one canonical field and one migration path.
- Add fallback chains and native language labels.
- Document locale metadata fields: `tag`, `base`, `laravel`, `docusaurus`, `nativeName`, `englishName`, `dir`, `dateLocale`, `numberLocale`, `enabled`, `releaseTier`.

Acceptance criteria:

- Frontend selector, backend middleware, API headers, and settings page use the same registry semantics.
- Unsupported locale input normalizes to the safest supported fallback.
- Per-user locale preference survives logout/login and browser refresh.
- Server-side locale negotiation order is documented and covered by tests.
- Locale metadata is available to docs tooling without duplicating divergent values.

Verification:

- Backend locale negotiation tests.
- Frontend language selector tests.
- Manual smoke: change language in topnav, refresh, log out, log back in, confirm preference.

Status: Complete for the initial implementation slice, with the Wave 1 app promotions now layered on top. Canonical metadata, backend normalization, frontend metadata tests, backend unit tests, DB-backed profile feature tests, Docusaurus locale config, targeted production migration, frontend deploy, PHP deploy, and live admin preference smoke are complete. Public app user-facing selectors expose `en-US`, `es-ES`, `fr-FR`, `de-DE`, `pt-BR`, `fi-FI`, `ja-JP`, `zh-Hans`, `ko-KR`, and `hi-IN`; QA locales stay available to metadata/tooling.

#### PR 2: Frontend i18n Runtime Hardening

Scope:

- Stabilize i18next initialization, namespace loading, fallback behavior, and document `lang`/`dir` updates.
- Standardize hooks/helpers for translation, formatting, and locale-aware routes.
- Add pseudolocale generation for `en-XA`.
- Add missing-key telemetry hooks in development.

Acceptance criteria:

- App shell renders with English, pseudolocale, and Arabic direction without runtime errors.
- Missing keys are visible in development and test output.
- Locale changes do not require full page reload unless explicitly required.
- Route changes preserve selected locale and layout direction.

Verification:

- Frontend unit tests for locale provider and formatter helpers.
- Playwright smoke for `en-US`, `en-XA`, and `ar` app shell.
- `./deploy.sh --frontend`

Status: Complete for the current branch slice. Runtime locale application, request headers, formatter metadata, public selector hardening, locale metadata parity tests, missing-key telemetry, warn-only hardcoded string scanner/reporting, Playwright shell coverage for `en-US`, `en-XA`, and `ar`, and a JSON translation completeness report artifact are implemented. Future PR 2 hardening can promote the report from advisory to release-gating once Tier A thresholds are finalized.

#### PR 3: App Shell, Navigation, And Shared Components Extraction

Scope:

- Complete extraction for topnav, sidebar, command palette, breadcrumbs, modals, toasts, common buttons, empty states, loading states, and error boundaries.
- Define shared namespaces for common UI language.
- Add scanner rules for JSX/TSX hardcoded strings.

Acceptance criteria:

- No hardcoded user-facing strings remain in shared shell components except approved exemptions.
- Shared components accept translated labels or translation keys consistently.
- Scanner runs in warn-only mode on feature branches.
- Pseudolocale shows no major clipping in app shell.

Verification:

- Hardcoded-string scanner report.
- Component tests for shared components.
- Playwright shell smoke across desktop and mobile.

Status: Scoped scanner extraction complete for the initial branch slice. `npm run i18n:scan:pr3-pr4` now reports 0 candidates across 57 app shell/shared UI/auth/settings files. The full frontend scanner baseline is 7,985 candidates across 1,068 frontend source files. Formal shell Playwright coverage is in place. Remaining PR 3 work is component-level shared UI tests where useful and expanding extraction beyond the PR3/PR4 starter scope.

#### PR 4: Core Auth, Settings, Profile, And Account Surfaces

Scope:

- Finish extraction and locale behavior for login, registration, password reset, forced password change, OIDC callback states, settings, profile, avatar controls, account/security, notifications, and language/region settings.
- Ensure backend auth/profile messages are localized or emit stable message keys.

Acceptance criteria:

- Auth and settings flows are usable in `en-US`, `en-XA`, pilot locale, and Arabic canary.
- Form labels, validation, submit states, backend errors, and success messages are localized.
- User locale/timezone settings update the current session without stale display state.

Verification:

- Frontend form tests.
- Backend profile/auth message tests.
- End-to-end smoke for login and settings language update.

Status: Initial auth/settings extraction complete for the scanner scope. The unauthenticated auth flow was already localized; this pass added native Spanish/Korean coverage for the setup wizard, onboarding tour, system health, AI provider, authentication provider, data source, complete, and notification settings surfaces. Backend profile/locale tests pass against `parthenon_testing`; fresh live end-to-end browser smoke now covers the topnav selector, Spanish/Korean preference persistence, pseudolocale shell rendering, and Arabic RTL metadata.

#### PR 5: Backend Message Contract And API Localization

Scope:

- Standardize API responses with `message_key`, localized `message`, optional `params`, and fallback metadata.
- Convert common Laravel validation/auth/profile/help errors to translation files.
- Add request locale middleware coverage for `X-Parthenon-Locale`, user profile, query override, and `Accept-Language`.
- Decide when client-side rendering should use `message_key` instead of trusting server-rendered `message`.

Acceptance criteria:

- API clients receive stable keys for localizable responses.
- Validation messages can be localized without changing API shape.
- Fallback responses are identifiable for telemetry and QA.
- Unsupported locale requests do not crash or leak raw keys to production users.

Verification:

- Laravel feature tests for middleware negotiation.
- API response snapshot tests for localized and fallback cases.
- Contract documentation update.

Status: In progress. The reusable `ApiMessage` envelope is implemented and wired through auth/profile/help/study responses while preserving existing `message` compatibility. Global API exception handling now standardizes validation, unauthenticated, and authorization failures with localized `message_key`, optional `message_params`, `message_meta`, and existing `errors` compatibility. Non-FinnGen survey public-link/submission errors and campaign state errors now use localized `survey.*` keys across every backend i18n locale. Focused tests cover Spanish public auth localization, Korean public validation errors, Spanish authenticated validation errors, localized unauthenticated errors, profile/help/study/survey message keys, replacement params, fallback metadata, and all-locale presence of core backend contract keys. FinnGen controller migration is intentionally deferred while that area is under active development. Remaining PR 5 work is the larger migration of domain-specific controller success/error strings across analyses, cohort authoring, study sub-resources, and admin operational endpoints.

#### PR 6: Formatting Layer Migration

Scope:

- Migrate date, time, timezone, number, percent, currency, compact number, relative time, and list formatting to locale-aware helpers.
- Audit direct uses of `toLocaleString`, Moment/Day.js formatting, raw currency symbols, and English-only date text.
- Define explicit export formatting behavior for viewer locale, study locale, and requested export locale.

Acceptance criteria:

- User-visible formatting uses shared helpers or documented exceptions.
- Timezone and locale are treated separately.
- CSV/PDF/export formatting rules are deterministic and documented.
- Tests cover representative locales: `en-US`, `fi-FI`, `pt-BR`, `ja-JP`, `hi-IN`, and `ar`.

Verification:

- Formatter unit tests.
- Export snapshot tests where export surfaces exist.
- Pseudolocale and RTL visual smoke for changed pages.

#### PR 7: Feature Surface Extraction Waves

Scope:

- Extract remaining product areas in batches: dashboards, study setup, cohort builder, phenotyping workflows, search, results views, data tables, saved designs, admin pages, notifications, and collaboration surfaces.
- Keep each extraction wave scoped to one product area.
- Add namespace ownership notes for future development.

Acceptance criteria:

- Each extracted surface has English keys, pseudolocale coverage, and fallback-safe runtime behavior.
- Clinical/source-data fields remain explicitly marked as source values.
- No product area mixes translated UI labels with machine-translated clinical source values.
- Newly discovered hardcoded strings become tracked follow-up items if not fixed in the same PR.

Verification:

- Scanner delta report per wave.
- Unit or component tests for high-use components.
- Playwright smoke for the product area.

#### PR 8: Help, Changelog, Emails, And Exports

Scope:

- Localize help lookup, changelog chrome/content strategy, transactional emails, notification templates, export labels, report titles, and generated file metadata.
- Add English fallback metadata for translated content gaps.
- Define translation ownership for long-form content.

Acceptance criteria:

- Help UI can resolve locale-specific content with English fallback.
- Emails include locale-aware subject, body, footer, and action labels.
- Exports contain localized UI labels but preserve data values and identifiers.
- Missing localized long-form content is visible to QA and content owners.

Verification:

- Help lookup tests.
- Email rendering snapshots.
- Export snapshot tests.
- Manual smoke for localized help and fallback.

#### PR 9: Docusaurus Native i18n Foundation

Scope:

- Configure `docs/site/docusaurus.config.ts` for the production locale registry.
- Add Docusaurus locale directories and translation files for navbar, footer, sidebars, theme strings, docs chrome, and selected pilot docs.
- Define doc ID, slug, redirect, search index, and versioning policy.
- Ensure app help links route to localized Docusaurus pages when available and English fallback otherwise.

Acceptance criteria:

- Docusaurus builds for base English and at least one pilot locale.
- Navbar/footer/sidebar strings are extracted and translatable.
- MDX code fences, imports, admonitions, tabs, and OpenAPI identifiers are preserved.
- Generated docs output is not hand-edited.
- Localized docs routes either resolve correctly or fall back predictably.

Verification:

- `./deploy.sh --docs`
- Docusaurus route smoke for English and pilot locale.
- Link check for localized docs.
- MDX placeholder/code-fence integrity check.

#### PR 10: Translation Operations And AI Provider Abstraction

Scope:

- Add provider-neutral translation interfaces and policy layer for TMS sync, AI draft generation, terminology checks, placeholder integrity, and import/export.
- Implement initial repo-managed JSON/MDX workflow if the TMS contract is not signed yet.
- Add adapters or stubs for Phrase, DeepL, and OpenAI-assisted QA according to the service strategy.
- Enforce data classification rules before sending text to external providers.

Acceptance criteria:

- Translation jobs can export changed English source strings.
- AI draft generation is separated from human approval.
- Placeholders, ICU variables, Markdown links, MDX syntax, code fences, and product terms are protected.
- PHI/restricted data classes are blocked from external translation by default.
- Translation memory and terminology inputs are part of the workflow, not afterthoughts.

Verification:

- Unit tests for provider interface and policy decisions.
- Placeholder integrity tests.
- Dry-run export/import command.
- Fixture-based MDX translation round-trip.

#### PR 11: Clinical Terminology And Source Data Localization

Scope:

- Inventory clinical vocabulary display fields and classify them as UI label, curated terminology, source vocabulary, user-entered content, or generated narrative.
- Add locale-aware terminology lookup where curated multilingual data exists.
- Add explicit fallback badges/copy for source values shown in English.
- Protect ontology codes, phenotype definitions, cohort criteria, and identifiers from unsafe translation.

Acceptance criteria:

- Clinical/source values are not blindly machine-translated.
- Users can distinguish localized UI from untranslated source vocabulary.
- Terminology fallback is auditable.
- AI summaries cite source/fallback status when clinical labels are unavailable in the selected locale.

Verification:

- Terminology lookup tests.
- Cohort/phenotype display snapshots.
- AI prompt fixture tests for locale and fallback metadata.

#### PR 12: AI Localization And Narrative Quality

Scope:

- Pass locale, fallback chain, terminology constraints, measurement/date conventions, and user-facing tone rules into Abby and other AI-assisted narrative surfaces.
- Add prompt templates or structured response schemas for localized output.
- Add QA checks for locale mismatch, untranslated UI boilerplate, hallucinated clinical terms, broken placeholders, and unsafe fallback hiding.

Acceptance criteria:

- AI responses use the selected locale for eligible user-facing narrative.
- Protected identifiers, codes, variables, and clinical source terms remain intact.
- Locale fallback behavior is visible in generated output where it matters.
- Generated narrative can be evaluated with fixtures before release.

Verification:

- AI localization fixture tests.
- Prompt/schema validation.
- Human review sample set for pilot locale.

#### PR 13: RTL, Accessibility, And Visual QA

Scope:

- Harden Arabic RTL layout, bidirectional text, icons, charts, tables, modals, forms, and navigation.
- Validate keyboard navigation, screen reader labels, focus order, accessible names, and language attributes.
- Add screenshot diff coverage for representative pages.

Acceptance criteria:

- `dir="rtl"` applies correctly for Arabic without breaking LTR locales.
- Icons and directional affordances mirror only when semantically appropriate.
- Tables, charts, and code blocks remain readable.
- Accessible names and language metadata reflect the selected locale.

Verification:

- Playwright desktop/mobile screenshots for `en-US`, `en-XA`, pilot locale, and `ar`.
- Accessibility scan for representative pages.
- Manual RTL review checklist.

#### PR 14: Language Pack Production And Release Gates

Scope:

- Produce reviewed Tier A language packs.
- Add release-branch CI gates for missing translations and untranslated critical paths.
- Add language-pack metadata: completion percentage, review status, fallback count, release eligibility, and last synced source commit.
- Add rollout controls and telemetry for locale adoption and fallback frequency.

Acceptance criteria:

- Tier A locales meet completeness and review thresholds.
- Release-blocking surfaces cannot ship with silent English fallback.
- Tier B/C locales can exist as preview/draft without being represented as fully native.
- Product, docs, backend, email, export, help, and AI surfaces have a coherent release status per locale.

Verification:

- Translation completeness report.
- Release-branch CI gate.
- Locale smoke matrix.
- Rollback/fallback test.

### Branch-Level CI And Automation Roadmap

Add the following gates progressively:

1. Warn-only hardcoded string scanner for frontend source.
2. Warn-only missing-key scanner for supported locales.
3. Pseudolocale generation and smoke test.
4. Backend translation key coverage test.
5. Docusaurus i18n build and link check for touched docs.
6. Placeholder and ICU integrity validator.
7. MDX/code-fence integrity validator.
8. Release-branch failure for Tier A missing translations.
9. Translation completeness report posted to PRs.
10. Locale fallback telemetry in staging.

### Branch Backlog Triage Rules

- Fix in the current PR when the missing i18n work is inside the touched surface and low risk.
- Create a tracked follow-up when extraction touches shared architecture, clinical/source data semantics, or docs translation policy.
- Block merge when a new user-facing release surface cannot be reached in English, pseudolocale, and the selected pilot locale.
- Block release when a Tier A locale silently falls back on a release-blocking path.
- Do not block feature development on reviewed translations for all languages; block only on extractability, fallback safety, and release-tier policy.

## Risks And Mitigations

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Under-counted strings | Schedule slips | Build scanner and coverage dashboard early. |
| English in backend errors | Non-native user experience | Stable API error envelope and backend translation pass. |
| Clinical mistranslation | Safety/trust risk | Human clinical review, glossary, source-data fallback policy. |
| AI ignores locale | Inconsistent experience | Add locale to prompts, tests, and response policies. |
| RTL breaks layout | Unusable for Arabic/Hebrew | Add RTL canary early; use logical CSS; Playwright screenshots. |
| Bundle bloat | Slower app load | Lazy load namespaces/languages. |
| Docusaurus route/link drift | Help links and docs navigation break per locale | Keep stable slugs for v1, validate `docs_url` per locale, and build docs through `./deploy.sh --docs`. |
| Docusaurus search misses translated content | Users cannot find localized docs | Generate/check per-locale search indexes or configure Algolia with locale-aware indices/facets. |
| MDX translation breaks docs build | Docs deployment fails | Protect frontmatter/imports/code/Mermaid/OpenAPI tokens and add MDX structure validation before import. |
| Translator churn | Inconsistent terminology | Translation memory, glossary, stable keys. |
| Keys drift across branches | Missing translations | CI key parity and missing-key reports. |
| User-generated content direction issues | Broken mixed-language display | Use `dir="auto"` for runtime/user content. |
| Locale vs clinical data confusion | Users assume source values translated | Explicit fallback labels and documentation. |

## Open Decisions

Resolved on 2026-04-17:

- First production pilot: `es-ES`.
- Parallel production candidate: `ko-KR`.
- Initial Tier A target candidates: `es-ES`, `ko-KR`, pending final linguistic QA and release certification.
- Arabic stance: `ar` remains an internal RTL canary first, not a first-release blocker unless explicitly promoted.

Still open:

1. Does "native" include installer GUI and public install pages in v1?
2. Which Docusaurus surfaces are Tier A in v1: manual only, blog/release notes, generated API docs, migration guide, or all docs?
3. Should Docusaurus keep stable English slugs for all locales, or eventually support localized slugs with redirects?
4. Do exports use viewer locale, study locale, or explicit export locale?
5. Should frontend translation assets live in `public/locales` or be bundled by source imports?
6. Should we adopt a TMS now or start with repo-managed JSON?
7. Are machine translations acceptable for draft UI copy and documentation prose?
8. Who signs off clinical/research terminology?
9. Should API responses be localized server-side, client-side from `message_key`, or both?

## Recommended First Sprint

1. Add `config/parthenon-locales.php` with `en-US`, `pseudo`, one pilot locale, and `ar` canary metadata.
2. Add user `locale` and `timezone`.
3. Add frontend `i18n` module and pseudolocale.
4. Localize app shell/nav/header/settings/login.
5. Add request locale headers and backend locale middleware.
6. Add formatter helpers and migrate shell/settings/auth date/number usages.
7. Add scanner in warn-only mode.
8. Add Docusaurus inventory and base i18n config for `docs/site`, keeping `docs/dist/**` generated.
9. Add Playwright smoke for English, pseudolocale, Arabic canary shell, and English Docusaurus route health.

This sprint creates the spine. After that, feature extraction can proceed in parallel without each feature inventing its own localization pattern.
