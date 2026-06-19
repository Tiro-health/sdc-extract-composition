import type { CompositionSection } from "../types";

export const TEMPLATE_EXTRACT_CONTEXT_URL =
  "http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-templateExtractContext";

export function getContextExpression(section: CompositionSection): string | null {
  const ext = section.extension?.find(
    (e) => e.url === TEMPLATE_EXTRACT_CONTEXT_URL
  );
  return ext?.valueString ?? null;
}

export function isRepeatingContext(expr: string | null): boolean {
  if (!expr) return false;
  if (/^%(?:context|resource)\.where\(/.test(expr)) return false;
  return true;
}

export type ContextType = "always" | "conditional" | "repeating";

const WHERE_PREFIX = /^%(?:context|resource)\.where\(/;

/**
 * Classify a templateExtractContext expression for icon display.
 *
 * - `always`: no expression, blank, or just `%context` (no narrowing).
 * - `conditional`: starts with `%context.where(...)` or `%resource.where(...)` —
 *   filters the current context without changing its shape.
 * - `repeating`: anything else — every other expression narrows or redirects
 *   the context, so the section iterates over the resulting collection.
 */
export function inferContextType(expr: string | null): ContextType {
  if (!expr) return "always";
  const trimmed = expr.trim();
  if (!trimmed || trimmed === "%context") return "always";
  if (WHERE_PREFIX.test(trimmed)) return "conditional";
  return "repeating";
}

export const CONTEXT_COLORS: Record<string, string> = {
  always: "#6b9fd4",
  conditional: "#9b8cc9",
  repeating: "#5fb090",
  // Aliases for editor mode names
  "if": "#9b8cc9",
  "for-each": "#5fb090",
};

export const CONTEXT_ICONS: Record<ContextType, string> = {
  always: "—",
  conditional: "⎇",
  repeating: "↻",
};

export const CONTEXT_LABELS: Record<ContextType, string> = {
  always: "Always",
  conditional: "Conditional",
  repeating: "For each",
};
