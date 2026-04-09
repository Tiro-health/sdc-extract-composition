import type { CompositionSection } from "../types";
import type { QuestionnaireIndex } from "../utils/questionnaire-index";
import { segmentExpressionToHtml } from "../utils/expression-pills";
import { stripDivWrapper } from "../utils/parse-narrative";
import { ContextBadge } from "./ContextBadge";
import { injectPills, NarrativeHtml } from "./NarrativeHtml";

interface SectionViewProps {
  section: CompositionSection;
  depth?: number;
  questionnaireIndex?: QuestionnaireIndex;
}

const TEMPLATE_EXTRACT_CONTEXT_URL =
  "http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-templateExtractContext";

const SECTIONS_PLACEHOLDER = "<!-- sections -->";

function getContextExpression(section: CompositionSection): string | null {
  const ext = section.extension?.find(
    (e) => e.url === TEMPLATE_EXTRACT_CONTEXT_URL
  );
  return ext?.valueString ?? null;
}

function hasSectionsPlaceholder(section: CompositionSection): boolean {
  return section.text?.div?.includes(SECTIONS_PLACEHOLDER) ?? false;
}

/**
 * Determine whether a context expression represents a repeating (clone) pattern
 * vs a conditional (show/hide) pattern.
 *
 * Repeating: navigates to child items, e.g. `%context.item.where(linkId='poliep')`
 * Conditional: filters current context with a predicate, e.g. `%context.where(item...code = 'ja')`
 */
function isRepeatingContext(expr: string | null): boolean {
  if (!expr) return false;
  if (/^%(?:context|resource)\.where\(/.test(expr)) return false;
  return true;
}

/**
 * A section is a "conditional block" if it has a context expression but no title.
 * Titled sections with context are just scoped (e.g., "Procedure info" scoped to group).
 */
function isCondBlock(section: CompositionSection): boolean {
  return !section.title && !!getContextExpression(section);
}

/**
 * Build a label badge ("als" or "per item") + context expression HTML.
 * When a QuestionnaireIndex is available, renders pills for answer-value
 * paths and code literals.
 */
function buildLabelHtml(
  section: CompositionSection,
  questionnaireIndex?: QuestionnaireIndex
): string {
  const ctx = getContextExpression(section);
  if (!ctx) return "";
  const repeating = isRepeatingContext(ctx);
  const label = repeating ? "per item" : "als";
  const exprHtml = segmentExpressionToHtml(ctx, questionnaireIndex);
  return (
    `<span class="cond-label">${label}</span> ` +
    `<span class="context-badge-resolved" title="${ctx.replace(/"/g, "&quot;")}">${exprHtml}</span>`
  );
}

/**
 * Build the full HTML for a section, inlining child section content
 * at the <!-- sections --> placeholder so <tr> stays inside <table>.
 */
function buildSectionHtml(
  section: CompositionSection,
  questionnaireIndex?: QuestionnaireIndex
): string {
  const div = section.text?.div;
  if (!div) return "";

  const linkIdTextMap = questionnaireIndex?.linkIdTextMap;
  let html = stripDivWrapper(div);
  html = injectPills(html, linkIdTextMap);

  if (hasSectionsPlaceholder(section) && section.section?.length) {
    const childrenHtml = section.section
      .map((child) => {
        const childDiv = child.text?.div;
        if (!childDiv) return "";
        const isCond = isCondBlock(child);
        const label = buildLabelHtml(child, questionnaireIndex);
        const childInner = injectPills(
          stripDivWrapper(childDiv),
          linkIdTextMap
        );
        if (isCond) {
          return `<div class="cond-block">${label}${childInner}</div>`;
        }
        return childInner;
      })
      .join("\n");

    html = html.replace(SECTIONS_PLACEHOLDER, childrenHtml);
  }

  return html;
}

export function SectionView({
  section,
  depth = 0,
  questionnaireIndex,
}: SectionViewProps) {
  const contextExpr = getContextExpression(section);
  const isCond = isCondBlock(section);
  const repeating = isCond && isRepeatingContext(contextExpr);
  const conditional = isCond && !repeating;
  const inlinesChildren = hasSectionsPlaceholder(section);

  return (
    <div
      className={isCond ? "cond-block" : "py-2"}
      style={{
        marginLeft: depth > 0 && !isCond ? "1rem" : 0,
        ...(!isCond && depth > 0
          ? { borderLeft: "2px solid #e5e7eb", paddingLeft: "1rem" }
          : {}),
      }}
    >
      <div className="flex items-center gap-2 flex-wrap mb-1">
        {section.title && (
          <h3 className="text-sm font-semibold text-gray-900 m-0">
            {section.title}
          </h3>
        )}
        {conditional && <span className="cond-label">als</span>}
        {repeating && <span className="cond-label">per item</span>}
        {contextExpr && <ContextBadge expression={contextExpr} questionnaireIndex={questionnaireIndex} />}
      </div>

      {inlinesChildren ? (
        <div
          className="narrative-content"
          dangerouslySetInnerHTML={{
            __html: buildSectionHtml(section, questionnaireIndex),
          }}
        />
      ) : (
        <>
          {section.text?.div && (
            <NarrativeHtml
              divHtml={section.text.div}
              linkIdTextMap={questionnaireIndex?.linkIdTextMap}
            />
          )}
          {section.section?.map((child, i) => (
            <SectionView
              key={i}
              section={child}
              depth={depth + 1}
              questionnaireIndex={questionnaireIndex}
            />
          ))}
        </>
      )}
    </div>
  );
}
