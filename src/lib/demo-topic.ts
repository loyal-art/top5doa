// Fixed shape for demo topics used by the anonymous archetype quiz.
//
// Five attributes is a deliberate floor, not a preference: the archetype match
// is a dot product over the attribute ranking, and fewer than five attributes
// yields too few distinguishable outcomes for the archetype to mean anything.
// Do not make these configurable below their current values.
export const DEMO_SUBJECT_COUNT = 2;
export const DEMO_ATTRIBUTE_COUNT = 5;

export type TopicMode = "standard" | "demo";
