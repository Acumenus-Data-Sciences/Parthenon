# Synthetic Augmentation Plan

## Position

Synthetic augmentation is feasible here, but only as a separate layer. It should never be mixed into observed tables without an explicit provenance flag.

Recommended rule:
- `mimic_export.*` remains observed-only
- synthetic tables live in `mimic_synth.*`
- every synthetic row includes `data_origin = 'synthetic'`
- every downstream dataset keeps the observed/synthetic split recoverable

## Good use cases

- model pretraining
- UI demos
- benchmark scaffolding
- stress-testing pipelines
- bootstrapping missing modalities for internal experimentation

## Bad use cases

- clinical outcomes research
- causal inference
- safety evaluation
- anything presented as if the missing events were real observations

## Best augmentation targets

### 1. Synthetic lab events

Anchor on:
- `mimic_export.mimic_orders` where `is_lab_order = true`
- admission timing from `mimic_export.mimic_admissions`

Generate:
- `itemid`
- `label`
- `charttime`
- `specimen`
- `valuenum`
- `value`
- `valueuom`
- `flag`

Condition on:
- order name
- service line
- admission length
- patient age and sex
- timing relative to admission/discharge

Preferred method:
- fit empirical distributions per order family
- sample realistic panel components only for known order groups
- enforce physiologic bounds and inter-lab correlations

### 2. Synthetic medication administration

Anchor on:
- `mimic_export.mimic_orders` where `is_medication_order = true`
- transfer/admission timelines

Generate:
- administration time
- dose
- dose unit
- route
- action
- status

Condition on:
- medication name
- order time
- care setting
- length of stay

Preferred method:
- derive administration windows from order timing
- use dose templates by medication family
- generate repeated administrations only when the medication class is compatible with scheduled dosing

### 3. Synthetic chart events

Anchor on:
- `mimic_export.mimic_admissions`
- `mimic_export.mimic_transfers`
- sparse vital signs from source encounters where available

Generate:
- heart rate
- systolic BP
- diastolic BP
- temperature
- respiratory rate
- SpO2

Condition on:
- unit type / transfer stream
- mortality flag
- proximity to admission and discharge
- observed baseline vitals if present

Preferred method:
- use piecewise time-series generation
- impose diurnal smoothness
- correlate vitals within physiologic patterns

## Recommended implementation pattern

### Option A: empirical generator

Use your own observed distributions from this warehouse.

Pros:
- fastest
- easiest to audit
- low dependency risk

Cons:
- weaker joint realism
- limited rare-event fidelity

### Option B: conditional generative model

Train a model on a real reference dataset that actually contains the missing modalities, then condition on your observed anchors.

Pros:
- better joint realism
- can model trajectories

Cons:
- higher complexity
- stronger governance requirements

## Minimal schema proposal

### mimic_synth.synthetic_labevents

- `subject_id`
- `hadm_id`
- `source_order_id`
- `charttime`
- `itemid`
- `label`
- `value`
- `valuenum`
- `valueuom`
- `flag`
- `generation_model`
- `generation_version`
- `data_origin`

### mimic_synth.synthetic_emar

- `subject_id`
- `hadm_id`
- `source_order_id`
- `charttime`
- `medication`
- `dose`
- `dose_unit`
- `route`
- `action`
- `generation_model`
- `generation_version`
- `data_origin`

### mimic_synth.synthetic_chartevents

- `subject_id`
- `hadm_id`
- `charttime`
- `itemid`
- `label`
- `value`
- `valuenum`
- `valueuom`
- `generation_model`
- `generation_version`
- `data_origin`

## Guardrails

- never overwrite observed rows
- never drop provenance
- version the generator
- store the conditioning inputs used for each synthetic batch
- validate marginals and correlations before release
- document which fields are observed versus inferred versus synthetic

## Recommended next step

Start with synthetic labs only. They are easiest to anchor on real order data and easiest to validate quantitatively against a reference corpus.
