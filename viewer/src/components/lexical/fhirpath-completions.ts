import type { QuestionnaireIndex as WasmQuestionnaireIndex } from "fhirpath-rs";
import type { QuestionnaireIndex } from "../../utils/questionnaire-index";

export type Cardinality = "singleton" | "collection";

export interface CompletionItem {
  label: string;
  detail: string | null;
  insert_text: string;
  filter_text: string;
  sort_text: string;
  kind: "value" | "code" | "display";
  link_id: string;
  item_type: string;
  /**
   * True when accepting this suggestion crosses a repeating boundary the
   * typed prefix has not. The leaf itself repeating does NOT flag the
   * item — that's the start of the branch, not a descent past one.
   */
  traverses_repeating?: boolean;
  /**
   * Whether the expression resolves to a single value or a collection.
   * Stamped by the JS layer (combines `traverses_repeating` with the
   * leaf's `repeats` flag, and treats an anchor's own value under
   * `%context` as singleton — extract iterates the anchor one element
   * at a time). Absent on raw WASM output.
   */
  cardinality?: Cardinality;
}

// No stub completions - UI handles context/resource scoping automatically
const STUB_COMPLETIONS: CompletionItem[] = [];

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

// The deepest linkId in a context expression is the anchor — the item the
// user has already drilled into. Returns null when there is no
// `where(linkId='...')` segment (e.g. bare `%resource` / `%context`).
function extractAnchorLinkId(
  contextExpression: string | null | undefined,
): string | null {
  if (!contextExpression) return null;
  const matches = [...contextExpression.matchAll(/where\(linkId='([^']+)'\)/g)];
  return matches.length ? matches[matches.length - 1][1] : null;
}

// Anchor-own completions under %context emit bare `answer.value` / `value`
// (no `where(...)` segment, since the relative path starts inside the
// anchor). Use this to distinguish the singleton "current iteration" view
// from a list-shaped descent.
function isContextAnchorOwn(insertText: string): boolean {
  return !insertText.includes("where(");
}

function computeCardinality(
  it: CompletionItem,
  prefix: "%resource" | "%context",
  qi: QuestionnaireIndex | undefined,
): Cardinality {
  if (it.traverses_repeating) return "collection";
  if (prefix === "%context" && isContextAnchorOwn(it.insert_text)) {
    return "singleton";
  }
  return qi?.resolveItemRepeats(it.link_id) ? "collection" : "singleton";
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
  // Dedupe key is `linkId:cardinality`: the same linkId can legitimately
  // appear twice when its two forms have different cardinality (e.g. at a
  // repeating anchor, %resource → list, %context → current iteration).
  const resourceKeys = new Set<string>();

  // For the menu's "current iteration" / "all iterations" tag, we also
  // need to know whether the anchor of the typed prefix is the one that
  // repeats — that's where the two-form duplication actually occurs.
  const anchorLinkId = extractAnchorLinkId(contextExpression);
  const anchorRepeats = !!(
    anchorLinkId && questionnaireIndex?.resolveItemRepeats(anchorLinkId)
  );

  if (wasmQuestionnaireIndex) {
    try {
      const resourceItems = wasmQuestionnaireIndex.generate_completions(
        "%resource",
      ) as CompletionItem[];
      const safeResourceItems = valueOnly(resourceItems)
        .filter((it) => !it.traverses_repeating)
        .map((it) => ({
          ...it,
          cardinality: computeCardinality(it, "%resource", questionnaireIndex),
        }))
        .map((it) =>
          anchorRepeats && it.link_id === anchorLinkId
            ? { ...it, detail: "all iterations" }
            : it,
        );
      for (const it of safeResourceItems) {
        if (it.link_id) resourceKeys.add(`${it.link_id}:${it.cardinality}`);
      }
      wasm.push(...withPrefix("%resource", safeResourceItems));
    } catch (e) {
      console.error("[completions] %resource error:", e);
    }

    if (contextExpression && contextExpression !== "%resource") {
      try {
        const contextItems = wasmQuestionnaireIndex.generate_completions(
          contextExpression,
        ) as CompletionItem[];
        // Drop items that traverse a repeating boundary; drop %context
        // duplicates of %resource that share BOTH linkId and cardinality
        // (same value). When the two forms differ in cardinality — e.g.
        // anchor own under a repeating anchor — both stay.
        const uniqueContextItems = valueOnly(contextItems)
          .filter((it) => !it.traverses_repeating)
          .map((it) => ({
            ...it,
            cardinality: computeCardinality(it, "%context", questionnaireIndex),
          }))
          .filter(
            (it) =>
              !it.link_id ||
              !resourceKeys.has(`${it.link_id}:${it.cardinality}`),
          )
          .map((it) =>
            anchorRepeats && it.link_id === anchorLinkId
              ? { ...it, detail: "current iteration" }
              : it,
          );
        wasm.push(...withPrefix("%context", uniqueContextItems));
      } catch (e) {
        console.error("[completions] %context error:", e);
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
