import type { Questionnaire } from "../types";

interface QuestionnaireItem {
  linkId: string;
  text?: string;
  item?: QuestionnaireItem[];
}

/**
 * Build a flat map of linkId → item text from all Questionnaire items.
 */
export function buildLinkIdTextMap(
  questionnaire: Questionnaire
): Map<string, string> {
  const map = new Map<string, string>();

  function walk(items: QuestionnaireItem[]) {
    for (const item of items) {
      if (item.text) {
        map.set(item.linkId, item.text);
      }
      if (item.item) {
        walk(item.item);
      }
    }
  }

  const items = (questionnaire as unknown as Record<string, unknown>).item;
  if (Array.isArray(items)) {
    walk(items as QuestionnaireItem[]);
  }

  return map;
}
