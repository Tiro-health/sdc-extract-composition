import type { CompositionSection } from "../types";
import { stripDivWrapper } from "../utils/parse-narrative";
import { ContextBadge } from "./ContextBadge";
import { injectPills, NarrativeHtml } from "./NarrativeHtml";

interface SectionViewProps {
  section: CompositionSection;
  depth?: number;
  parentHasSectionsPlaceholder?: boolean;
  linkIdTextMap?: Map<string, string>;
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
 * Build an inline HTML snippet for a child section's badges (repeating + context),
 * used when the child is inlined into a parent table row.
 */
function buildChildBadgesHtml(child: CompositionSection): string {
  const parts: string[] = [];
  const ctx = getContextExpression(child);

  parts.push(
    `<span class="inline-badge repeating-badge">↻ repeating</span>`
  );
  if (ctx) {
    parts.push(
      `<span class="inline-badge context-badge"># ${ctx}</span>`
    );
  }

  return `<tr class="child-badges-row"><td colspan="99">${parts.join(" ")}</td></tr>`;
}

/**
 * Build the full HTML for a section, inlining child section content
 * at the <!-- sections --> placeholder so <tr> stays inside <table>.
 */
function buildSectionHtml(
  section: CompositionSection,
  linkIdTextMap?: Map<string, string>
): string {
  const div = section.text?.div;
  if (!div) return "";

  let html = stripDivWrapper(div);
  html = injectPills(html, linkIdTextMap);

  if (hasSectionsPlaceholder(section) && section.section?.length) {
    const childrenHtml = section.section
      .map((child) => {
        const childDiv = child.text?.div;
        if (!childDiv) return "";
        const badges = buildChildBadgesHtml(child);
        const childInner = injectPills(
          stripDivWrapper(childDiv),
          linkIdTextMap
        );
        return badges + childInner;
      })
      .join("\n");

    html = html.replace(SECTIONS_PLACEHOLDER, childrenHtml);
  }

  return html;
}

export function SectionView({
  section,
  depth = 0,
  parentHasSectionsPlaceholder = false,
  linkIdTextMap,
}: SectionViewProps) {
  const contextExpr = getContextExpression(section);
  const isRepeating = parentHasSectionsPlaceholder;
  const inlinesChildren = hasSectionsPlaceholder(section);

  return (
    <div
      className="border-l-2 border-gray-200 pl-4 py-2"
      style={{ marginLeft: depth > 0 ? "1rem" : 0 }}
    >
      <div className="flex items-center gap-2 flex-wrap mb-1">
        {section.title && (
          <h3 className="text-sm font-semibold text-gray-900 m-0">
            {section.title}
          </h3>
        )}
        {isRepeating && (
          <span className="inline-flex items-center gap-1 bg-amber-50 border border-amber-200 text-amber-800 text-xs rounded px-1.5 py-0.5">
            ↻ repeating
          </span>
        )}
        {contextExpr && <ContextBadge expression={contextExpr} />}
      </div>

      {inlinesChildren ? (
        /* Render parent + children as one HTML block so <tr> stays in <table> */
        <div
          className="narrative-content"
          dangerouslySetInnerHTML={{
            __html: buildSectionHtml(section, linkIdTextMap),
          }}
        />
      ) : (
        <>
          {section.text?.div && (
            <NarrativeHtml
              divHtml={section.text.div}
              linkIdTextMap={linkIdTextMap}
            />
          )}
          {section.section?.map((child, i) => (
            <SectionView
              key={i}
              section={child}
              depth={depth + 1}
              parentHasSectionsPlaceholder={false}
              linkIdTextMap={linkIdTextMap}
            />
          ))}
        </>
      )}
    </div>
  );
}
