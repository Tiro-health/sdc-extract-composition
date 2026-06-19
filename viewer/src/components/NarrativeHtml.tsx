import type { QuestionnaireIndex } from "../utils/questionnaire-index";
import { segmentExpressionToHtml } from "../utils/expression-pills";
import { stripDivWrapper } from "../utils/parse-narrative";
import { useWasmReady } from "../utils/wasm-init";

interface NarrativeHtmlProps {
  divHtml: string;
  questionnaireIndex?: QuestionnaireIndex;
  /** Effective templateExtractContext for resolving %context inside pills. */
  contextBase?: string | null;
  onClick?: () => void;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Replace {{ expression }} placeholders with styled <code> pill elements
 * directly in the HTML string, preserving the original DOM structure.
 */
export function injectPills(
  html: string,
  index?: QuestionnaireIndex,
  contextBase?: string | null,
): string {
  return html.replace(/\{\{(.*?)\}\}/g, (_match, expr: string) => {
    const trimmed = expr.trim();
    const pillHtml = index
      ? segmentExpressionToHtml(trimmed, index, contextBase)
      : escapeHtml(trimmed);
    return `<code class="fhirpath-pill" title="${escapeHtml(trimmed)}">${pillHtml}</code>`;
  });
}

export function NarrativeHtml({ divHtml, questionnaireIndex, contextBase, onClick }: NarrativeHtmlProps) {
  // Re-render when wasm becomes ready so the synchronous pill injection picks
  // up the analyzer once it's available.
  useWasmReady();
  const inner = stripDivWrapper(divHtml);
  const withPills = injectPills(inner, questionnaireIndex, contextBase);

  return (
    <div
      className={`narrative-content${onClick ? " narrative-content-editable" : ""}`}
      onClick={onClick}
      dangerouslySetInnerHTML={{ __html: withPills }}
    />
  );
}
