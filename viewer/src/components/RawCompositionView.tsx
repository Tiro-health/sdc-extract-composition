import { useState } from "react";
import type { Composition, CompositionSection } from "../types";

interface RawCompositionViewProps {
  composition: Composition;
}

const TEMPLATE_EXTRACT_CONTEXT_URL =
  "http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-templateExtractContext";
const TEMPLATE_EXTRACT_VALUE_URL =
  "http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-templateExtractValue";

function isTemplateExtension(url: string): boolean {
  return (
    url === TEMPLATE_EXTRACT_CONTEXT_URL ||
    url === TEMPLATE_EXTRACT_VALUE_URL
  );
}

/** Render a JSON value with syntax highlighting for template extensions */
function JsonValue({ value, indent: _indent }: { value: unknown; indent: number }) {
  if (value === null) return <span className="json-null">null</span>;
  if (typeof value === "boolean")
    return <span className="json-bool">{String(value)}</span>;
  if (typeof value === "number")
    return <span className="json-number">{value}</span>;
  if (typeof value === "string")
    return <span className="json-string">"{value}"</span>;
  return null;
}

function SectionNode({
  section,
  depth,
}: {
  section: CompositionSection;
  depth: number;
}) {
  const [expanded, setExpanded] = useState(depth < 2);
  const contextExt = section.extension?.find(
    (e) => e.url === TEMPLATE_EXTRACT_CONTEXT_URL
  );
  const hasChildren = (section.section?.length ?? 0) > 0;
  const hasNarrative = !!section.text?.div;

  return (
    <div
      className="raw-section"
      style={{ marginLeft: depth > 0 ? "1rem" : 0 }}
    >
      <div
        className="raw-section-header"
        onClick={() => setExpanded(!expanded)}
      >
        <span className="raw-toggle">{expanded ? "▾" : "▸"}</span>
        <span className="raw-section-title">
          {section.title ? (
            <strong>{section.title}</strong>
          ) : (
            <em className="text-gray-400">untitled section</em>
          )}
        </span>
        {contextExt && (
          <span className="raw-ext-badge context" title={contextExt.valueString}>
            context
          </span>
        )}
        {hasNarrative && (
          <span className="raw-ext-badge narrative">text</span>
        )}
        {hasChildren && (
          <span className="raw-child-count">
            {section.section!.length} sub
          </span>
        )}
      </div>

      {expanded && (
        <div className="raw-section-body">
          {section.extension?.map((ext, i) => (
            <div
              key={i}
              className={`raw-extension ${isTemplateExtension(ext.url) ? "highlight" : ""}`}
            >
              <span className="raw-ext-url">
                {ext.url.split("/").pop()}
              </span>
              {ext.valueString && (
                <code className="raw-ext-value">{ext.valueString}</code>
              )}
              {ext.valueReference && (
                <code className="raw-ext-value">
                  {ext.valueReference.reference}
                </code>
              )}
            </div>
          ))}

          {hasNarrative && (
            <details className="raw-narrative">
              <summary>
                <span className="raw-ext-url">text.div</span>
                <span className="text-gray-400 text-xs ml-1">
                  ({section.text!.div.length} chars)
                </span>
              </summary>
              <pre className="raw-narrative-content">
                {section.text!.div}
              </pre>
            </details>
          )}

          {section.section?.map((child, i) => (
            <SectionNode key={i} section={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

export function RawCompositionView({ composition }: RawCompositionViewProps) {
  return (
    <div className="raw-composition">
      <div className="raw-header">
        <div className="raw-meta">
          <span className="json-key">resourceType</span>:{" "}
          <JsonValue value={composition.resourceType} indent={0} />
        </div>
        <div className="raw-meta">
          <span className="json-key">id</span>:{" "}
          <JsonValue value={composition.id} indent={0} />
        </div>
        {composition.title && (
          <div className="raw-meta">
            <span className="json-key">title</span>:{" "}
            <JsonValue value={composition.title} indent={0} />
          </div>
        )}
        <div className="raw-meta">
          <span className="json-key">section</span>:{" "}
          <span className="text-gray-400">
            [{composition.section?.length ?? 0} sections]
          </span>
        </div>
      </div>

      <div className="raw-sections">
        {composition.section?.map((section, i) => (
          <SectionNode key={i} section={section} depth={0} />
        ))}
      </div>
    </div>
  );
}
