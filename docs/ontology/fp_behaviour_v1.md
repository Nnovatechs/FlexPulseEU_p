# FlexPulseEU Behaviour Ontology v1

## Purpose

`fp_behaviour_v1` is the temporary behavioural ontology for the survey generator.

Its job is to provide a stable semantic target for:

- survey design
- question-to-concept mapping
- structured response interpretation
- profiling and cohort comparison
- later migration to an official partner ontology

This ontology is intentionally scoped to behaviour, acceptance, preferences, device readiness, and response context.

It is not intended to represent the full operational energy ecosystem.

## Design rules

- keep the vocabulary stable and reviewable in Git
- keep question design separate from profiling rules and thresholds
- treat raw enrichment inputs as operational data, not as final semantic concepts
- allow surveys to map into the ontology without requiring the final partner OWL

## Storage model

The ontology itself lives in the repository as a versioned project artifact.

The database stores:

- the survey definition
- the mapping contract from question to ontology target
- later, the mapped outputs derived from responses

This means:

- ontology vocabulary in repo
- ontology usage by a survey in database
- ontology-derived outputs in later pipeline stages

## Namespace

All ontology targets in this version live under:

- `fp_behaviour_v1`

## Block overview

### 1. `response_context`

Provides minimal context for interpreting a response and comparing cohorts.

This is not user behaviour by itself, but it is useful analytical context.

Attributes:

- `region_code`
- `country_code`
- `language_code`
- `respondent_segment`
- `completeness_score`
- `response_timestamp`

### 2. `environment_context`

Stores derived contextual variables produced by later enrichment.

This block should contain normalized and analytically useful context, not raw location precision.

Attributes:

- `outdoor_temperature_c`
- `apparent_temperature_c`
- `seasonal_context`
- `extreme_heat_flag`
- `extreme_cold_flag`
- `climate_zone_normalized`
- `weather_context_quality`

### 3. `awareness`

Represents how informed and confident the respondent is about energy flexibility and automation topics.

Attributes:

- `energy_awareness_level`
- `flexibility_awareness_level`
- `automation_awareness_level`
- `self_reported_knowledge_confidence`

### 4. `flex_willingness`

Represents willingness to participate in flexibility-related schemes and the conditions that shape that willingness.

Attributes:

- `participation_level`
- `participation_conditions`
- `participation_barriers`
- `participation_motivators`
- `event_frequency_tolerance`

### 5. `thermal_comfort`

Represents behavioural and preference constraints around comfort and temperature tolerance.

This block is especially relevant for heat pumps, HVAC-related flexibility, and perceived comfort loss.

Attributes:

- `winter_setpoint_c`
- `summer_setpoint_c`
- `comfort_strictness`
- `temperature_variation_tolerance`
- `schedule_flexibility_for_comfort`
- `night_setback_acceptance`

### 6. `trust_automation`

Represents the respondent's trust in automation and the conditions needed for acceptance.

Attributes:

- `automation_trust_level`
- `automation_acceptance_scope`
- `automation_conditions`
- `manual_override_need`
- `explainability_need`
- `bill_protection_need`

### 7. `tariff_preferences`

Represents economic preferences and sensitivity to tariff design, variability, and risk.

Attributes:

- `preferred_tariff_model`
- `bill_variability_tolerance`
- `price_saving_motivation`
- `risk_aversion_level`
- `incentive_sensitivity`

### 8. `device_engagement`

Represents ownership, familiarity, readiness, and interest in distributed energy devices.

This block is intentionally broad enough to support EVs, heat pumps, batteries, PV, and similar assets.

Attributes:

- `owned_devices`
- `interested_devices`
- `device_familiarity`
- `device_control_readiness`
- `device_usage_dependence`
- `ev_ownership`
- `ev_control_readiness`
- `ev_charging_flexibility`
- `heat_pump_ownership`
- `heat_pump_control_readiness`
- `heat_pump_comfort_dependency`
- `battery_ownership`
- `pv_ownership`
- `smart_appliance_readiness`

### 9. `mapping_quality`

Represents the quality and confidence of semantic interpretation.

This block is about mapping reliability, not respondent behaviour.

Attributes:

- `low_confidence`
- `ambiguous_answer`
- `out_of_scope`
- `requires_review`

## What is intentionally out of scope

The following are intentionally not part of this ontology version:

- final thresholds
- final scoring rules
- behavioural clustering logic
- rich OWL class modelling
- detailed electricity market structure
- exact raw postal codes or exact raw city identifiers as final ontology concepts

## Example ontology targets

- `fp_behaviour_v1.awareness.energy_awareness_level`
- `fp_behaviour_v1.flex_willingness.participation_level`
- `fp_behaviour_v1.thermal_comfort.temperature_variation_tolerance`
- `fp_behaviour_v1.trust_automation.automation_trust_level`
- `fp_behaviour_v1.tariff_preferences.risk_aversion_level`
- `fp_behaviour_v1.device_engagement.ev_control_readiness`
- `fp_behaviour_v1.device_engagement.heat_pump_control_readiness`
- `fp_behaviour_v1.environment_context.outdoor_temperature_c`
- `fp_behaviour_v1.mapping_quality.low_confidence`

## Example question-to-target mappings

Examples:

- "How much do you trust automated control of household energy devices?" -> `fp_behaviour_v1.trust_automation.automation_trust_level`
- "Would you allow your EV charging schedule to be optimized automatically?" -> `fp_behaviour_v1.device_engagement.ev_control_readiness`
- "What indoor temperature variation would still feel acceptable?" -> `fp_behaviour_v1.thermal_comfort.temperature_variation_tolerance`
- "Would you participate in a flexibility programme if your bill were protected?" -> `fp_behaviour_v1.flex_willingness.participation_conditions`
