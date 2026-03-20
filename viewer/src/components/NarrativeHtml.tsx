import { stripDivWrapper } from "../utils/parse-narrative";

interface NarrativeHtmlProps {
  divHtml: string;
  linkIdTextMap?: Map<string, string>;
}

// Match expressions ending with .answer.value or .answer.value.display
// and extract the last linkId='...' before that suffix.
const ANSWER_VALUE_RE =
  /\.where\(linkId='([^']+)'\)\.answer\.value(?:\.display)?$/;

/**
 * For expressions ending in answer.value, resolve to "Answer for {question text}".
 * Falls back to full expression if linkId not found.
 */
function resolveLabel(
  expression: string,
  linkIdTextMap?: Map<string, string>
): string {
  if (!linkIdTextMap) return expression;
  const match = expression.match(ANSWER_VALUE_RE);
  if (!match) return expression;
  const linkId = match[1];
  const text = linkIdTextMap.get(linkId);
  return text ? `Answer for &quot;${text}&quot;` : expression;
}

/**
 * Replace {{ expression }} placeholders with styled <code> pill elements
 * directly in the HTML string, preserving the original DOM structure.
 */
export function injectPills(
  html: string,
  linkIdTextMap?: Map<string, string>
): string {
  return html.replace(/\{\{(.*?)\}\}/g, (_match, expr: string) => {
    const trimmed = expr.trim();
    const label = resolveLabel(trimmed, linkIdTextMap);
    return `<code class="fhirpath-pill" title="${trimmed}">${label}</code>`;
  });
}

export function NarrativeHtml({ divHtml, linkIdTextMap }: NarrativeHtmlProps) {
  const inner = stripDivWrapper(divHtml);
  const withPills = injectPills(inner, linkIdTextMap);

  return (
    <div
      className="narrative-content"
      dangerouslySetInnerHTML={{ __html: withPills }}
    />
  );
}
