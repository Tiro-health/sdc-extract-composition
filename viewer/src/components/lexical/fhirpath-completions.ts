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
  /** True if the path traverses any repeating ancestor */
  traverses_repeating?: boolean;
  /**
   * Cardinality the suggestion's expression evaluates to in the active
   * `$extract` context. Always populated by the WASM path (fhir-sdc-rs ≥ 0.3.2)
   * and stamped by the JS fallback below. Optional in the type so existing
   * callers that build items by hand still compile.
   */
  cardinality?: "singleton" | "collection";
}

const STUB_COMPLETIONS: CompletionItem[] = [];

function withPrefix(prefix: string, items: CompletionItem[]): CompletionItem[] {
  return items.map((it) => ({ ...it, insert_text: `${prefix}.${it.insert_text}` }));
}

function valueOnly(items: CompletionItem[]): CompletionItem[] {
  return items.filter((it) => it.kind === "value");
}

function dedupeKey(item: CompletionItem): string {
  return `${item.link_id}|${item.cardinality ?? ""}`;
}

// Anchor linkId — the linkId in the deepest `where(linkId='...')` segment of
// the contextExpression. Only used to decorate the two anchor-own rows with a
// "all iterations" / "current iteration" hint; the dedupe itself runs on
// (link_id, cardinality) so it doesn't need this.
function extractAnchorLinkId(contextExpression: string | null | undefined): string | null {
  if (!contextExpression) return null;
  const matches = [...contextExpression.matchAll(/where\(linkId='([^']+)'\)/g)];
  return matches.length ? matches[matches.length - 1][1] : null;
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
      cardinality: info.repeats ? "collection" : "singleton",
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
  const resourceKeys = new Set<string>();
  const anchorLinkId = extractAnchorLinkId(contextExpression);

  if (wasmQuestionnaireIndex) {
    try {
      const resourceItems = wasmQuestionnaireIndex.generate_completions(
        "%resource",
      ) as CompletionItem[];
      const safeResourceItems = valueOnly(resourceItems).filter(
        (it) => !it.traverses_repeating,
      );
      const stamped = safeResourceItems.map((it) =>
        anchorLinkId &&
        it.link_id === anchorLinkId &&
        it.cardinality === "collection"
          ? { ...it, detail: "all iterations" }
          : it,
      );
      for (const it of stamped) resourceKeys.add(dedupeKey(it));
      wasm.push(...withPrefix("%resource", stamped));
    } catch (e) {
      console.error("[completions] %resource error:", e);
    }

    if (contextExpression && contextExpression !== "%resource") {
      try {
        const contextItems = wasmQuestionnaireIndex.generate_completions(
          contextExpression,
        ) as CompletionItem[];
        const uniqueContextItems = valueOnly(contextItems)
          .filter((it) => !it.traverses_repeating)
          .filter((it) => !resourceKeys.has(dedupeKey(it)));
        const stamped = uniqueContextItems.map((it) =>
          anchorLinkId && it.link_id === anchorLinkId
            ? { ...it, detail: "current iteration" }
            : it,
        );
        wasm.push(...withPrefix("%context", stamped));
      } catch (e) {
        console.error("[completions] %context error:", e);
      }
    }
  }

  if (wasm.length === 0) {
    const itemCompletions = generateItemCompletions(questionnaireIndex);
    return [...STUB_COMPLETIONS, ...itemCompletions];
  }

  return [...STUB_COMPLETIONS, ...wasm];
}
