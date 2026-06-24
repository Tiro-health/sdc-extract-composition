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
  /**
   * True when accepting this suggestion crosses a repeating boundary the
   * typed prefix has not. The leaf itself repeating does NOT flag the
   * item — that's the start of the branch, not a descent past one.
   */
  traverses_repeating?: boolean;
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
  const resourceLinkIds = new Set<string>();

  // When the anchor of the context expression repeats, the anchor's own
  // value has TWO useful forms: %resource collects across all iterations,
  // %context refers to the current one. Both stay in the list and get a
  // `detail` so the menu rows aren't visually identical.
  const anchorLinkId = extractAnchorLinkId(contextExpression);
  const anchorRepeats = !!(
    anchorLinkId && questionnaireIndex?.resolveItemRepeats(anchorLinkId)
  );

  if (wasmQuestionnaireIndex) {
    try {
      const resourceItems = wasmQuestionnaireIndex.generate_completions(
        "%resource",
      ) as CompletionItem[];
      console.log("[completions] %resource raw:", resourceItems);
      // Filter out items that traverse repeating ancestors (ambiguous results)
      const safeResourceItems = valueOnly(resourceItems)
        .filter((it) => !it.traverses_repeating)
        .map((it) =>
          anchorRepeats && it.link_id === anchorLinkId
            ? { ...it, detail: "all iterations" }
            : it,
        );
      console.log("[completions] %resource filtered:", safeResourceItems);
      // Track which linkIds are in the safe %resource set
      for (const it of safeResourceItems) {
        if (it.link_id) resourceLinkIds.add(it.link_id);
      }
      wasm.push(...withPrefix("%resource", safeResourceItems));
    } catch (e) {
      console.error("[completions] %resource error:", e);
    }

    if (contextExpression && contextExpression !== "%resource") {
      try {
        console.log("[completions] calling generate_completions with contextExpression:", contextExpression);
        const contextItems = wasmQuestionnaireIndex.generate_completions(
          contextExpression,
        ) as CompletionItem[];
        console.log("[completions] generate_completions(contextExpression) returned:", contextItems);
        console.log("[completions] contextItems length:", contextItems?.length);
        if (contextItems && contextItems.length > 0) {
          console.log("[completions] first context item:", contextItems[0]);
        }
        // Drop items that traverse a repeating boundary, and drop %context
        // duplicates of %resource entries that resolve to the same value.
        // EXCEPTION: when the anchor repeats, keep the anchor's own %context
        // form too — it points at the current iteration while the %resource
        // form collects across all iterations.
        const uniqueContextItems = valueOnly(contextItems)
          .filter((it) => {
            if (it.traverses_repeating) return false;
            if (!it.link_id || !resourceLinkIds.has(it.link_id)) return true;
            return anchorRepeats && it.link_id === anchorLinkId;
          })
          .map((it) =>
            anchorRepeats && it.link_id === anchorLinkId
              ? { ...it, detail: "current iteration" }
              : it,
          );
        console.log("[completions] %context filtered:", uniqueContextItems);
        wasm.push(...withPrefix("%context", uniqueContextItems));
      } catch (e) {
        console.error("[completions] %context error:", e);
      }
    } else {
      console.log("[completions] no context expression or equals %resource:", contextExpression);
    }
  }

  // Fall back to JS-generated completions if WASM returns nothing
  if (wasm.length === 0) {
    const itemCompletions = generateItemCompletions(questionnaireIndex);
    return [...STUB_COMPLETIONS, ...itemCompletions];
  }

  return [...STUB_COMPLETIONS, ...wasm];
}
