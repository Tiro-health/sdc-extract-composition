import { annotate_expression, resolve_context, type Annotation } from "fhirpath-rs";
import { isWasmReady } from "./wasm-init";
import type { QuestionnaireIndex } from "./questionnaire-index";

// ---------------------------------------------------------------------------
// Segment types — the output of segmentExpression()
// ---------------------------------------------------------------------------

export interface AnswerPillSegment {
  kind: "answer-pill";
  from: number;
  to: number;
  /** Chain of linkIds traversed, e.g. ['resectie', 'nabloeding'] */
  linkIds: string[];
}

export interface CodePillSegment {
  kind: "code-pill";
  from: number;
  to: number;
  /** The raw code string (e.g. '373067005') */
  value: string;
  /** The linkId whose answerOptions can resolve this code to a display */
  contextLinkId: string;
}

export interface TextSegment {
  kind: "text";
  from: number;
  to: number;
  text: string;
}

export type ExpressionSegment =
  | AnswerPillSegment
  | CodePillSegment
  | TextSegment;

// ---------------------------------------------------------------------------
// Filter pipeline splitter
// ---------------------------------------------------------------------------

/**
 * Split a placeholder body into the FHIRPath head and the ``||`` filter tail.
 *
 * Mirrors the quote-aware splitter in ``src/fhir_liquid/filters.py`` so the
 * analyzer only sees valid FHIRPath. The first top-level ``||`` outside any
 * single/double-quoted region delimits head from tail; ``||`` inside string
 * literals and FHIRPath's single-pipe union operator are preserved.
 *
 * Returns the original input as ``head`` (and an empty ``tail``) if no filter
 * pipeline is present.
 */
export function splitFilterPipeline(expr: string): { head: string; tail: string } {
  let i = 0;
  let quote: string | null = null;
  while (i < expr.length) {
    const ch = expr[i];
    if (quote !== null) {
      if (ch === "\\" && i + 1 < expr.length) {
        i += 2;
        continue;
      }
      if (ch === quote) quote = null;
      i += 1;
      continue;
    }
    if (ch === "'" || ch === '"') {
      quote = ch;
      i += 1;
      continue;
    }
    if (ch === "|" && expr[i + 1] === "|") {
      return { head: expr.slice(0, i).trimEnd(), tail: expr.slice(i) };
    }
    i += 1;
  }
  return { head: expr, tail: "" };
}

// ---------------------------------------------------------------------------
// Wasm annotation → segment mapping
// ---------------------------------------------------------------------------

type RawPill = AnswerPillSegment | CodePillSegment;

function annotationToPill(annotation: Annotation): RawPill | null {
  const { span, kind } = annotation;
  switch (kind.type) {
    case "answer_reference":
    case "item_reference":
      // Render both as answer-style pills — preserves the prior visual where
      // `item.where(linkId='X')` (navigation prefix) and full answer paths
      // both surface as a labeled chip.
      return {
        kind: "answer-pill",
        from: span.start,
        to: span.end,
        linkIds: kind.link_ids,
      };
    case "coded_value":
      return {
        kind: "code-pill",
        from: span.start,
        to: span.end,
        value: kind.code,
        contextLinkId: kind.context_link_id,
      };
  }
}

/**
 * Build segments from pill ranges, filling gaps with text segments.
 * Pills are assumed sorted by `from` and non-overlapping.
 */
function buildSegments(
  expr: string,
  pills: RawPill[]
): ExpressionSegment[] {
  const segments: ExpressionSegment[] = [];
  let pos = 0;

  for (const pill of pills) {
    if (pill.from > pos) {
      segments.push({
        kind: "text",
        from: pos,
        to: pill.from,
        text: expr.slice(pos, pill.from),
      });
    }
    segments.push(pill);
    pos = pill.to;
  }

  if (pos < expr.length) {
    segments.push({
      kind: "text",
      from: pos,
      to: expr.length,
      text: expr.slice(pos, expr.length),
    });
  }

  return segments;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Parse a FHIRPath expression and segment it into text and pill ranges via
 * the wasm analyzer.
 *
 * When ``contextBase`` is provided and the expression references ``%context``,
 * the analyzer is given the resolved expression so it can recognize references
 * relative to the section's templateExtractContext (e.g. ``%context.value``
 * inside a for-each over ``...item.where(linkId='X').answer`` is annotated as
 * an answer pill for X). The returned spans are against the resolved
 * expression, so callers that need character-accurate offsets into the
 * original string should leave ``contextBase`` undefined.
 *
 * Returns a single text segment if the wasm module isn't ready yet (callers
 * subscribed to `useWasmReady` will re-render once it is) or if the analyzer
 * throws on the input.
 */
export function segmentExpression(
  expr: string,
  contextBase?: string | null,
): ExpressionSegment[] {
  if (!isWasmReady()) {
    return [{ kind: "text", from: 0, to: expr.length, text: expr }];
  }

  // The analyzer only understands FHIRPath; strip any ``||`` filter pipeline
  // before calling it and re-attach the tail as plain text.
  const { head, tail } = splitFilterPipeline(expr);

  // Substitute %context with the section's base so the analyzer can attribute
  // references that depend on the parent scope. Falls through with the
  // original head if resolution fails — the analyzer will then yield no
  // annotations and the expression renders as plain text, matching the
  // pre-resolution behaviour.
  let analyzed = head;
  if (contextBase && head.includes("%context")) {
    try {
      analyzed = resolve_context(head, contextBase);
    } catch {
      analyzed = head;
    }
  }

  let annotations: Annotation[];
  try {
    annotations = annotate_expression(analyzed);
  } catch {
    return [{ kind: "text", from: 0, to: expr.length, text: expr }];
  }

  const pills: RawPill[] = [];
  for (const annotation of annotations) {
    const pill = annotationToPill(annotation);
    if (pill) pills.push(pill);
  }
  pills.sort((a, b) => a.from - b.from);

  // Drop pills whose range overlaps an earlier-starting pill — defensive only;
  // the analyzer's `find_coded_values` already excludes ranges inside an
  // answer-ref, but a future kind could overlap.
  const nonOverlapping: RawPill[] = [];
  let lastEnd = -1;
  for (const pill of pills) {
    if (pill.from < lastEnd) continue;
    nonOverlapping.push(pill);
    lastEnd = pill.to;
  }

  const segments = buildSegments(analyzed, nonOverlapping);
  if (tail) {
    // Strip map filter details for display (just show "|| map" not the mappings)
    const displayTail = simplifyFiltersForDisplay(tail);
    segments.push({
      kind: "text",
      from: analyzed.length,
      to: analyzed.length + tail.length,
      text: displayTail,
    });
  }
  return segments;
}

/**
 * Simplify filter tail for display by showing only filter names (no arguments).
 * Shows max 2 filters, then "|| ..." if there are more.
 * "|| default: 'MM' || prepend: 'test' || join: ', '" → "|| default || prepend || ..."
 */
function simplifyFiltersForDisplay(tail: string): string {
  // Split on || (outside quotes)
  const parts: string[] = [];
  let buf = "";
  let i = 0;
  let quote: string | null = null;
  while (i < tail.length) {
    const ch = tail[i];
    if (quote !== null) {
      buf += ch;
      if (ch === "\\" && i + 1 < tail.length) {
        buf += tail[i + 1];
        i += 2;
        continue;
      }
      if (ch === quote) quote = null;
      i += 1;
      continue;
    }
    if (ch === "'" || ch === '"') {
      quote = ch;
      buf += ch;
      i += 1;
      continue;
    }
    if (ch === "|" && tail[i + 1] === "|") {
      parts.push(buf);
      buf = "";
      i += 2;
      continue;
    }
    buf += ch;
    i += 1;
  }
  parts.push(buf);

  // Simplify each filter part - extract just the filter name (before the colon)
  const simplified = parts.map((part) => {
    const trimmed = part.trim();
    if (!trimmed) return "";
    // Extract filter name (everything before the colon, if any)
    const colonIdx = trimmed.indexOf(":");
    if (colonIdx > 0) {
      return trimmed.slice(0, colonIdx).trim();
    }
    return trimmed;
  }).filter(Boolean);

  // Show max 2 filters, then "..." if more
  const maxFilters = 2;
  if (simplified.length > maxFilters) {
    const shown = simplified.slice(0, maxFilters);
    return shown.map(p => ` || ${p}`).join("") + " || ...";
  }

  return simplified.map(p => ` || ${p}`).join("");
}

/**
 * Render a segmented expression as an HTML string with pill markup.
 * Used by callers that need to inject the result via dangerouslySetInnerHTML
 * (e.g. NarrativeHtml's pill-injection path, FhirPathPillComponent's pill
 * label).
 */
export function segmentExpressionToHtml(
  expr: string,
  index?: QuestionnaireIndex,
  contextBase?: string | null,
): string {
  if (!index) return escapeHtml(expr);

  const segments = segmentExpression(expr, contextBase);
  const hasPills = segments.some((s) => s.kind !== "text");
  if (!hasPills) return escapeHtml(expr);

  return segments
    .map((seg) => {
      if (seg.kind === "text") {
        return `<span class="expr-text">${escapeHtml(seg.text)}</span>`;
      }
      if (seg.kind === "answer-pill") {
        const lastLinkId = seg.linkIds[seg.linkIds.length - 1];
        const resolved = index.resolveItemText(lastLinkId);
        if (resolved == null) {
          const tooltip = `Question '${lastLinkId}' was removed from the Questionnaire. Click to fix.`;
          return `<span class="expr-pill missing" title="${escapeHtml(tooltip)}">${MISSING_ICON_SVG}Missing</span>`;
        }
        return `<span class="expr-pill answer" title="linkId: ${escapeHtml(seg.linkIds.join(" → "))}">${escapeHtml(resolved)}</span>`;
      }
      if (seg.kind === "code-pill") {
        const display = index.resolveCodeDisplay(seg.contextLinkId, seg.value);
        const label = display ?? humanizeCode(seg.value);
        return `<span class="expr-pill code" title="code: ${escapeHtml(seg.value)}">${escapeHtml(label)}</span>`;
      }
      return "";
    })
    .join("");
}

const MISSING_ICON_SVG =
  '<svg class="expr-pill-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
  '<path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>' +
  '<line x1="12" y1="9" x2="12" y2="13"/>' +
  '<line x1="12" y1="17" x2="12.01" y2="17"/>' +
  '</svg>';

export { MISSING_ICON_SVG };

/**
 * Whether an expression is "missing" — i.e. it either references no known
 * question/code at all, or any of its item/answer references points at a
 * linkId that no longer exists in the Questionnaire. Returns ``false``
 * optimistically while wasm is still loading so pills don't briefly flash
 * as missing.
 */
export function isExpressionMissing(
  expr: string,
  index: QuestionnaireIndex,
  contextBase?: string | null,
): boolean {
  if (!isWasmReady()) return false;
  const segments = segmentExpression(expr, contextBase);
  const refs = segments.filter((s) => s.kind !== "text");
  if (refs.length === 0) return true;
  for (const seg of segments) {
    if (seg.kind === "answer-pill") {
      const lastLinkId = seg.linkIds[seg.linkIds.length - 1];
      if (index.resolveItemText(lastLinkId) == null) return true;
    }
  }
  return false;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function humanizeCode(code: string): string {
  return code
    .replace(/[-_]/g, " ")
    .replace(/^\w/, (c) => c.toUpperCase());
}

/**
 * Combine a section's templateExtractContext with its parent's, returning the
 * fully-resolved base path against which placeholders inside the section
 * should resolve ``%context``.
 *
 * - If the section has no context, the parent's effective context applies.
 * - If the section's context contains ``%context``, it's resolved against the
 *   parent (e.g. ``%context.answer`` under parent ``%resource.foo`` becomes
 *   ``%resource.foo.answer``).
 * - Otherwise the section's context is already absolute and replaces the
 *   parent's.
 *
 * Returns ``null`` when neither side has a context. Falls back to the raw
 * section context if the WASM resolver isn't available or throws.
 */
export function combineContextExpression(
  sectionContext: string | null | undefined,
  parentContext: string | null | undefined,
): string | null {
  if (!sectionContext) return parentContext ?? null;
  if (!parentContext) return sectionContext;
  if (!sectionContext.includes("%context")) return sectionContext;
  if (!isWasmReady()) return sectionContext;
  try {
    return resolve_context(sectionContext, parentContext);
  } catch {
    return sectionContext;
  }
}
