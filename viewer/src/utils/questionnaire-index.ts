import type { Questionnaire } from "../types";

interface QuestionnaireItem {
  linkId: string;
  text?: string;
  type?: string;
  answerOption?: { valueCoding?: { system?: string; code: string; display?: string } }[];
  item?: QuestionnaireItem[];
}

export interface QuestionnaireItemInfo {
  linkId: string;
  text: string;
  type: string;
  /** code → display from answerOption[].valueCoding */
  answerOptions: Map<string, string>;
}

export interface QuestionnaireIndex {
  items: Map<string, QuestionnaireItemInfo>;
  /** Backward-compatible linkId → text map */
  linkIdTextMap: Map<string, string>;
  resolveItemText(linkId: string): string | null;
  resolveCodeDisplay(linkId: string, code: string): string | null;
  resolveItemType(linkId: string): string | null;
}

/**
 * Build a flat map of linkId → item text from all Questionnaire items.
 * @deprecated Use buildQuestionnaireIndex instead.
 */
export function buildLinkIdTextMap(
  questionnaire: Questionnaire
): Map<string, string> {
  return buildQuestionnaireIndex(questionnaire).linkIdTextMap;
}

/**
 * Build a rich index of all Questionnaire items with text, type, and answer options.
 */
export function buildQuestionnaireIndex(
  questionnaire: Questionnaire
): QuestionnaireIndex {
  const items = new Map<string, QuestionnaireItemInfo>();
  const linkIdTextMap = new Map<string, string>();

  function walk(qItems: QuestionnaireItem[]) {
    for (const item of qItems) {
      const answerOptions = new Map<string, string>();
      if (item.answerOption) {
        for (const opt of item.answerOption) {
          if (opt.valueCoding?.code && opt.valueCoding.display) {
            answerOptions.set(opt.valueCoding.code, opt.valueCoding.display);
          }
        }
      }

      const text = item.text ?? item.linkId;
      items.set(item.linkId, {
        linkId: item.linkId,
        text,
        type: item.type ?? "group",
        answerOptions,
      });

      if (item.text) {
        linkIdTextMap.set(item.linkId, item.text);
      }

      if (item.item) {
        walk(item.item);
      }
    }
  }

  const rootItems = (questionnaire as unknown as Record<string, unknown>).item;
  if (Array.isArray(rootItems)) {
    walk(rootItems as QuestionnaireItem[]);
  }

  return {
    items,
    linkIdTextMap,
    resolveItemText(linkId: string): string | null {
      return items.get(linkId)?.text ?? null;
    },
    resolveCodeDisplay(linkId: string, code: string): string | null {
      return items.get(linkId)?.answerOptions.get(code) ?? null;
    },
    resolveItemType(linkId: string): string | null {
      return items.get(linkId)?.type ?? null;
    },
  };
}
