export interface NarrativeSegment {
  type: "html" | "fhirpath";
  value: string;
}

const XHTML_DIV_WRAPPER =
  /^<div\s+xmlns="http:\/\/www\.w3\.org\/1999\/xhtml"\s*>([\s\S]*)<\/div>$/;

/** Strip the outer <div xmlns="http://www.w3.org/1999/xhtml"> wrapper. */
export function stripDivWrapper(divHtml: string): string {
  const match = divHtml.trim().match(XHTML_DIV_WRAPPER);
  return match ? match[1] : divHtml;
}

export function parseNarrative(divHtml: string): NarrativeSegment[] {
  const inner = stripDivWrapper(divHtml);

  // Split on {{ ... }} preserving the delimiters as capture group
  const parts = inner.split(/(\{\{.*?\}\})/g);

  return parts
    .filter((p) => p.length > 0)
    .map((part) => {
      if (part.startsWith("{{") && part.endsWith("}}")) {
        return {
          type: "fhirpath" as const,
          value: part.slice(2, -2).trim(),
        };
      }
      return { type: "html" as const, value: part };
    });
}
