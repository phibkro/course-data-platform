# ADR-009: Defer the knowledge graph while preserving compatibility

- Status: Accepted
- Date: 2026-07-20

## Context

Course and programme comparison by credits or titles is useful but shallow. A future knowledge graph could represent disciplines, subject areas, concepts, skills, prerequisite knowledge, and coverage depth. It could explain content overlap and estimate personal readiness from a student's prior evidence.

A reliable graph is complex: course descriptions rarely specify coverage depth, assumed knowledge, assessment weight, or concept boundaries precisely.

## Decision

Do not implement concept extraction or a full ontology in the current roadmap slice. Preserve compatible graph primitives:

- typed edges;
- validity period;
- provenance and evidence excerpts;
- confidence and authority level;
- derivation algorithm version;
- human review state.

Reserve a separate knowledge bounded context with future entities:

- KnowledgeConcept;
- ConceptRelation;
- CourseConceptRelation;
- KnowledgeEvidence;
- KnowledgeProfile;
- ReadinessFinding.

The study planner depends only on courses and formal programme requirements today. Later it may consume knowledge-kernel results such as coverage comparison, preparation gaps, and readiness explanations without changing scenario representation.

## Consequences

The system avoids false precision while keeping the planner compatible with future concept-level reasoning. Personalized difficulty will be framed as an evidence-backed knowledge gap, not an absolute course difficulty score.
