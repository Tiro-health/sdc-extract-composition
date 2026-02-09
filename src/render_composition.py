"""Render a Composition resource to HTML, optionally evaluating FHIRPath expressions."""

from __future__ import annotations

import sys
from pathlib import Path
from typing import Any

from generate_html import (
    HTML_TEMPLATE,
    extract_div_content,
    load_json,
    render_section,
)


def render_section_static(section: dict[str, Any]) -> str:
    """Render a Composition section as-is, without FHIRPath evaluation."""
    title = section.get("title", "Untitled")
    div = section.get("text", {}).get("div", "")
    inner = extract_div_content(div)
    return f"""    <section>
        <h2>{title}</h2>
        {inner}
    </section>"""


def render_composition(
    composition: dict[str, Any],
    resource: dict[str, Any] | None = None,
) -> str:
    """Generate HTML from a Composition resource.

    If resource is provided, evaluates FHIRPath expressions in sections.
    Otherwise renders sections as-is.
    """
    title = composition.get("title", "Composition")
    sections_html = [
        html
        for section in composition.get("section", [])
        if (html := render_section(section, resource) if resource else render_section_static(section)) is not None
    ]
    return HTML_TEMPLATE.format(title=title, sections="\n".join(sections_html))


def main() -> None:
    if len(sys.argv) < 2:
        print("Usage: python render_composition.py <composition.json> [questionnaire-response.json]")
        sys.exit(1)

    composition_path = Path(sys.argv[1])
    if not composition_path.exists():
        print(f"Error: {composition_path} not found")
        sys.exit(1)

    composition = load_json(composition_path)

    resource = None
    if len(sys.argv) >= 3:
        qr_path = Path(sys.argv[2])
        if not qr_path.exists():
            print(f"Error: {qr_path} not found")
            sys.exit(1)
        resource = load_json(qr_path)

    html = render_composition(composition, resource)

    output_path = composition_path.parent / "output" / "composition-rendered.html"
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(html)

    print(f"Generated: {output_path}")


if __name__ == "__main__":
    main()
