import { useMemo } from "react";
import type { QuestionnaireIndex } from "../utils/questionnaire-index";
import {
  segmentExpression,
  type ExpressionSegment,
} from "../utils/expression-pills";
import { useWasmReady } from "../utils/wasm-init";

interface ContextBadgeProps {
  expression: string;
  questionnaireIndex?: QuestionnaireIndex;
  /** Parent's effective context, used to resolve %context inside the expression. */
  parentContextExpression?: string | null;
}

function MissingIcon() {
  return (
    <svg
      className="expr-pill-icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

function SegmentView({
  segment,
  index,
}: {
  segment: ExpressionSegment;
  index?: QuestionnaireIndex;
}) {
  if (segment.kind === "text") {
    return <span className="expr-text">{segment.text}</span>;
  }

  if (segment.kind === "answer-pill" && index) {
    const lastLinkId = segment.linkIds[segment.linkIds.length - 1];
    const resolved = index.resolveItemText(lastLinkId);
    if (resolved == null) {
      return (
        <span
          className="expr-pill missing"
          title={`Question '${lastLinkId}' was removed from the Questionnaire. Click to fix.`}
        >
          <MissingIcon />
          Missing
        </span>
      );
    }
    return (
      <span className="expr-pill answer" title={`linkId: ${segment.linkIds.join(" → ")}`}>
        {resolved}
      </span>
    );
  }

  if (segment.kind === "code-pill" && index) {
    const display = index.resolveCodeDisplay(segment.contextLinkId, segment.value);
    const label = display ?? segment.value.replace(/[-_]/g, " ").replace(/^\w/, (c) => c.toUpperCase());
    return (
      <span className="expr-pill code" title={`code: ${segment.value}`}>
        {label}
      </span>
    );
  }

  return <span className="expr-text" />;
}

export function ContextBadge({ expression, questionnaireIndex, parentContextExpression }: ContextBadgeProps) {
  const wasmReady = useWasmReady();
  const segments = useMemo(
    () => (questionnaireIndex ? segmentExpression(expression, parentContextExpression) : null),
    [expression, questionnaireIndex, parentContextExpression, wasmReady]
  );

  const hasPills = segments?.some((s) => s.kind !== "text");

  if (!segments || !hasPills) {
    // Fallback: raw monospace expression
    return (
      <span className="context-badge" title={expression}>
        {expression}
      </span>
    );
  }

  return (
    <span className="context-badge-resolved" title={expression}>
      {segments.map((seg, i) => (
        <SegmentView key={i} segment={seg} index={questionnaireIndex} />
      ))}
    </span>
  );
}
