# FlexPulse-EU — Publication Topics

## About this document

This note presents three candidate publication directions we have been exploring based on the FlexPulse-EU work.

These topics are exploratory at this stage. They are based on our own development work — the agent orchestration, system architecture, behavioural schema, and validation methodology built within the project — together with the public scope information from the O-CEI open call.

---

## Paper 1 — Contract-Based Agentic LLM Measurement Planning for Psychological Parameterization in Adaptive Surveys

**Draft abstract:**

Recent research has shown that large language models can support survey-question and questionnaire generation, yet this paper addresses a more specific methodological problem: how to generate adaptive survey instruments when the intended output is not only respondent-facing questions, but downstream behavioural, psychological, or sociological parameterization. We propose a contract-based agentic LLM measurement-planning framework for this setting. In the implemented workflow, a role-specialized measurement-planning agent first converts selected behavioural constructs into an executable measurement strategy, deciding measurement type, evidence depth, facet coverage, polarity, aggregation logic, threshold profiles, and mapping requirements. A separate survey-writing agent then realizes that accepted strategy as respondent-facing items without changing the measurement intent. The platform compiles both stages into a contract layer — survey definition, measurement plan, and mapping contract — which freezes the intended relationship between construct, item, response value, and behavioural output. After publication, responses are not interpreted by an LLM; they are processed deterministically according to the previously planned mapping and aggregation logic. Implemented in FlexPulse-EU for residential energy-flexibility contexts, the framework provides a traceable route from behavioural concept selection to structured profile values and cohort analytics. The contribution is a practical architecture for moving LLM-based survey generation beyond question drafting toward auditable, schema-linked behavioural parameterization.

---

## Paper 2 — The FlexPulse Behavioural Schema: An Executable Construct Framework for Energy Flexibility Profiling

**Draft abstract:**

Residential energy flexibility is shaped by more than technical asset availability or a single measure of willingness to participate. Existing research on demand response and flexibility markets repeatedly points to behavioural heterogeneity: awareness, trust, perceived control, comfort expectations, tariff risk, complexity, household routines, automation acceptance, and economic motivation all influence whether flexibility is acceptable, reliable, and scalable. This paper proposes the FlexPulse Behavioural Schema, an executable behavioural construct framework for representing these factors as structured, machine-readable dimensions of energy-flexibility profiling. The schema organises household flexibility behaviour into primary profile axes, behavioural modulators, applicability factors, context signals, and quality signals. Primary axes describe core behavioural parameters such as awareness of energy systems, flexibility willingness, thermal comfort norms, tariff preference orientation, trust in automation, and DER engagement. Modulators capture explanatory constraints and motivations such as manual override need, explainability need, bill stability need, event-frequency tolerance, savings motivation, and routine dependency. Applicability factors encode factual segmentation variables such as owned or interested DER assets, preferred tariff model, and comfort setpoints, while context and quality signals support climate, location, language, and mapping-quality interpretation. Unlike a static questionnaire taxonomy, the schema is operational: each concept has a stable namespace, concept key, role, dimension, output type, optional constraints, and compatible measurement strategies. In FlexPulse-EU, this schema becomes the semantic backbone for agentic LLM measurement planning, survey generation, deterministic response mapping, and cohort analytics. The contribution is a reusable parametrization layer that transforms socio-behavioural knowledge about residential flexibility into traceable behavioural descriptors suitable for adaptive surveys, profile generation, and pilot-facing analytics.

---

## Paper 3 — From Behavioural Surveys to Pilot Intelligence: A Traceable Pipeline for Residential Energy Flexibility

**Draft abstract:**

Residential energy-flexibility pilots increasingly combine smart meters, DER assets, dynamic tariffs, automation, and user-facing engagement. However, pilot teams still need structured behavioural evidence explaining not only whether flexibility is technically available, but why households may accept, reject, constrain, or sustain flexible actions under specific domestic conditions. This paper presents FlexPulse-EU as a traceable behavioural intelligence pipeline for residential energy-flexibility pilots. The pipeline combines an executable behavioural construct schema with contract-based agentic LLM measurement planning: pilot teams select relevant behavioural constructs; the platform generates, validates, translates, and publishes survey instruments; submitted responses are enriched with controlled context signals; deterministic mapping transforms answers into schema-aligned profile values, tags, facets, and metadata; and cohort analytics expose behavioural patterns by audience, geography, language, climate context, and profile subgroup with evidence labels for small segments. The contribution is not a replacement for smart-meter-based flexibility quantification or real pilot evaluation, but an operational bridge between behavioural science and pilot decision support. FlexPulse-EU provides a way to collect and structure the subjective, contextual, and psychological signals that are usually missing from technical flexibility analytics. A final version of the paper should incorporate Stage 3 hosted deployment evidence, real or pilot-like response collection*, stakeholder feedback, and examples of how behavioural descriptors support flexibility programme design, segmentation, communication, or interoperability workflows.

- Note: the real-scenario evidence referenced for the stronger version of this paper would come from FlexPulse-EU's own independent validation activities — survey responses collected through the project team's own channels and validation testing — not from Pilot 1 operational data.

---

*These are early-stage outlines shared for discussion. Drafts will be circulated as the manuscripts develop.*