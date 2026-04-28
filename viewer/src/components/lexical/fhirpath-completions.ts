import type { QuestionnaireIndex as WasmQuestionnaireIndex } from "fhirpath-rs";
import type { QuestionnaireIndex } from "../../utils/questionnaire-index";

export interface CompletionItem {
  label: string;
  detail: string | null;
  insert_text: string;
  filter_text: string;
  sort_text: string;
  kind: "value" | "code" | "display";
  link_id: string;
  item_type: string;
}

// Only entry-point variables - the rest comes from WASM generate_completions
export const STUB_COMPLETIONS: CompletionItem[] = [
  {
    label: "%context",
    detail: "Current extraction context",
    insert_text: "%context",
    filter_text: "context",
    sort_text: "00-context",
    kind: "value",
    link_id: "",
    item_type: "",
  },
  {
    label: "%resource",
    detail: "The QuestionnaireResponse",
    insert_text: "%resource",
    filter_text: "resource",
    sort_text: "00-resource",
    kind: "value",
    link_id: "",
    item_type: "",
  },
];

// WASM generate_completions emits insert_text relative to the supplied context
// expression (e.g. "item.where(linkId='X').answer.value"). Pills need a
// resolvable head — %resource for the global tree, %context for the
// section-scoped tree.
function withPrefix(prefix: string, items: CompletionItem[]): CompletionItem[] {
  return items.map((it) => ({ ...it, insert_text: `${prefix}.${it.insert_text}` }));
}

// One canonical entry per item — drop the .code / .display variants the engine
// emits for coding types. Users can refine via the pill editor afterward.
function valueOnly(items: CompletionItem[]): CompletionItem[] {
  return items.filter((it) => it.kind === "value");
}

function generateItemCompletions(
  questionnaireIndex: QuestionnaireIndex | undefined,
): CompletionItem[] {
  if (!questionnaireIndex) return [];

  const completions: CompletionItem[] = [];

  for (const [linkId, info] of questionnaireIndex.items) {
    if (info.type === "group" || info.type === "display") continue;

    const text = info.text || linkId;
    const path = info.path;

    completions.push({
      label: text,
      detail: `linkId: ${linkId}`,
      insert_text: `${path}.answer.value`,
      filter_text: `${text} ${linkId} resource`,
      sort_text: `10-${text}`,
      kind: "value",
      link_id: linkId,
      item_type: info.type,
    });
  }

  return completions;
}

export function getFhirPathCompletions(
  contextExpression: string | null | undefined,
  wasmQuestionnaireIndex: WasmQuestionnaireIndex | null,
  questionnaireIndex?: QuestionnaireIndex,
): CompletionItem[] {
  const wasm: CompletionItem[] = [];

  if (wasmQuestionnaireIndex) {
    try {
      const resourceItems = wasmQuestionnaireIndex.generate_completions(
        "%resource",
      ) as CompletionItem[];
      wasm.push(...valueOnly(withPrefix("%resource", resourceItems)));
    } catch {
      // Ignore errors
    }

    if (contextExpression && contextExpression !== "%resource") {
      try {
        const contextItems = wasmQuestionnaireIndex.generate_completions(
          contextExpression,
        ) as CompletionItem[];
        wasm.push(...valueOnly(withPrefix("%context", contextItems)));
      } catch {
        // Ignore errors
      }
    }
  }

  // Fall back to JS-generated completions if WASM returns nothing
  if (wasm.length === 0) {
    const itemCompletions = generateItemCompletions(questionnaireIndex);
    return [...STUB_COMPLETIONS, ...itemCompletions];
  }

  return [...STUB_COMPLETIONS, ...wasm];
}
