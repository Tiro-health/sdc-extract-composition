"""Generate HTML preview from SDC Questionnaire with Composition template."""

from __future__ import annotations

import os

os.environ.setdefault("DYLD_FALLBACK_LIBRARY_PATH", "/opt/homebrew/lib")

import json
import re
import sys
from pathlib import Path
from typing import Any

from fhir_liquid import evaluate_fhirpath, render_template

HTML_TEMPLATE = """<!DOCTYPE html>
<html lang="nl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{title}</title>
    <style>
        @page {{
            size: A4;
            margin: 0.5cm 2.2cm;
        }}
        body {{
            font-family: system-ui, -apple-system, sans-serif;
            margin: 0;
            padding: 0;
            line-height: 1.4;
            font-size: 8pt;
        }}
        h1 {{
            font-size: 12pt;
            border-bottom: 1.5px solid #333;
            padding-bottom: 0.3rem;
            margin: 0.5rem 0;
        }}
        h2 {{
            font-size: 9pt;
            margin: 0.8rem 0 0.3rem;
            padding-bottom: 0.2rem;
            border-bottom: 1px solid #ddd;
        }}
        dl {{
            display: grid;
            grid-template-columns: minmax(120px, 1fr) 2fr;
            gap: 0.1rem 0.8rem;
            margin: 0.2rem 0;
        }}
        dt {{
            font-weight: 600;
            padding: 0.1rem 0;
        }}
        dd {{
            margin: 0;
            padding: 0.1rem 0;
            border-bottom: 1px solid #eee;
        }}
        section {{
            margin: 1rem 0;
        }}
        table {{
            width: 100%;
            border-collapse: collapse;
            margin: 0.5rem 0;
        }}
        th, td {{
            padding: 0.2rem 0.4rem;
            text-align: left;
            border-bottom: 1px solid #ddd;
        }}
        th {{
            background: #f5f5f5;
            font-weight: 600;
        }}
        thead th {{
            border-bottom: 2px solid #ccc;
        }}
        header {{
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            border-bottom: 1.5px solid #333;
            padding-bottom: 0.4rem;
            margin-bottom: 0.5rem;
        }}
        .lab-info {{
            font-size: 7pt;
            color: #555;
        }}
        .lab-info strong {{
            font-size: 8pt;
            color: #111;
        }}
        .report-meta {{
            font-size: 7pt;
            text-align: right;
            color: #555;
        }}
        .report-meta strong {{
            color: #111;
        }}
        footer {{
            margin-top: 1rem;
            padding-top: 0.4rem;
            border-top: 1.5px solid #333;
        }}
        .attestation {{
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 0.8rem;
            font-size: 7pt;
        }}
        .attestation .signer {{
            padding-top: 0.2rem;
        }}
        .attestation .signature-line {{
            margin-top: 1rem;
            border-top: 1px solid #999;
            padding-top: 0.15rem;
            font-size: 6.5pt;
            color: #666;
        }}
        .attestation-note {{
            margin-top: 0.4rem;
            font-size: 6pt;
            color: #888;
            font-style: italic;
        }}
    </style>
</head>
<body>
{header}
    <h1>{title}</h1>
{sections}
{footer}
</body>
</html>
"""

TEMPLATE_EXTRACT_CONTEXT_URL = (
    "http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-templateExtractContext"
)


def extract_div_content(div: str) -> str:
    """Extract inner content from a div element, removing the outer div tags."""
    match = re.match(r"<div[^>]*>(.*)</div>", div, re.DOTALL)
    return match.group(1) if match else div


def get_extension_value(
    extensions: list[dict[str, Any]], url: str
) -> str | None:
    """Get the value of an extension by URL."""
    for ext in extensions:
        if ext.get("url") == url:
            return ext.get("valueString")
    return None


def load_json(path: Path) -> dict[str, Any]:
    """Load a JSON file."""
    with open(path) as f:
        return json.load(f)


def load_composition(questionnaire: dict[str, Any]) -> dict[str, Any]:
    """Load Composition from Questionnaire contained resources."""
    for contained in questionnaire.get("contained", []):
        if contained.get("resourceType") == "Composition":
            return contained
    raise ValueError("No Composition found in Questionnaire.contained")


def render_section(
    section: dict[str, Any],
    resource: dict[str, Any],
) -> str | None:
    """Render a single Composition section with FHIRPath expressions evaluated.

    Returns None if the section's templateExtractContext resolves to empty,
    skipping the section from output.
    """
    section_title = section.get("title", "Untitled")
    section_text = section.get("text", {}).get("div", "")

    # Get the templateExtractContext expression (base path for %context)
    extensions = section.get("extension", [])
    base_path = get_extension_value(extensions, TEMPLATE_EXTRACT_CONTEXT_URL)

    # Skip section if context resolves to empty
    if base_path:
        context_result = evaluate_fhirpath(base_path, resource)
        if not context_result:
            return None

    # Create context with base path for proper type resolution
    context = {"resource": resource}
    if base_path:
        context["base"] = base_path

    # Render the template with FHIRPath expressions
    rendered_content = render_template(section_text, context)
    inner_content = extract_div_content(rendered_content)

    return f"""    <section>
        <h2>{section_title}</h2>
        {inner_content}
    </section>"""


def generate_html(
    composition: dict[str, Any],
    resource: dict[str, Any],
    *,
    header_template: str = "",
    footer_template: str = "",
) -> str:
    """Generate HTML from a Composition resource with evaluated FHIRPath expressions."""
    title = composition.get("title", "Composition")

    sections_html = [
        html
        for section in composition.get("section", [])
        if (html := render_section(section, resource)) is not None
    ]

    context = {"resource": resource}
    header = render_template(header_template, context) if header_template else ""
    footer = render_template(footer_template, context) if footer_template else ""

    return HTML_TEMPLATE.format(
        title=title,
        sections="\n".join(sections_html),
        header=header,
        footer=footer,
    )


def main() -> None:
    project_root = Path(__file__).parent.parent

    # Accept iteration folder as argument, default to latest
    if len(sys.argv) > 1:
        iteration = sys.argv[1]
    else:
        iteration = "01-liquid-template"

    iteration_path = project_root / "iterations" / iteration
    questionnaire_path = iteration_path / "questionnaire-extract.json"
    response_path = iteration_path / "questionnaire-response.json"

    if not questionnaire_path.exists():
        print(f"Error: {questionnaire_path} not found")
        sys.exit(1)

    if not response_path.exists():
        print(f"Error: {response_path} not found")
        sys.exit(1)

    # Load resources
    questionnaire = load_json(questionnaire_path)
    response = load_json(response_path)

    # Extract composition template from questionnaire
    composition = load_composition(questionnaire)

    # Load optional header/footer templates
    header_path = iteration_path / "header.html"
    footer_path = iteration_path / "footer.html"
    header_template = header_path.read_text() if header_path.exists() else ""
    footer_template = footer_path.read_text() if footer_path.exists() else ""

    # Generate HTML with evaluated expressions
    html = generate_html(
        composition,
        response,
        header_template=header_template,
        footer_template=footer_template,
    )

    # Write output
    output_dir = iteration_path / "output"
    output_dir.mkdir(parents=True, exist_ok=True)

    html_path = output_dir / "composition-rendered.html"
    html_path.write_text(html)
    print(f"Generated: {html_path}")

    # Generate PDF with weasyprint
    from weasyprint import HTML

    pdf_path = output_dir / "composition-rendered.pdf"
    HTML(string=html).write_pdf(pdf_path)
    print(f"Generated: {pdf_path}")


if __name__ == "__main__":
    main()
