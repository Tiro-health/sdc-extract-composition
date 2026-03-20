import type { Composition, Questionnaire } from "../types";

export function extractComposition(
  questionnaire: Questionnaire
): Composition | null {
  const contained = questionnaire.contained;
  if (!Array.isArray(contained)) return null;

  const composition = contained.find(
    (r): r is Composition => r.resourceType === "Composition"
  );
  return composition ?? null;
}
