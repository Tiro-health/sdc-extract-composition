# SDC Template-Based Extraction for Composition

Transform clinical forms into FHIR Composition resources using SDC (Structured Data Capture) template-based extraction.

## Structure

```
├── iterations/                           # Extraction approach iterations
│   └── <iteration>/
│       ├── questionnaire-extract.json    # SDC Questionnaire with contained Composition template
│       ├── questionnaire-response.json   # Example QuestionnaireResponse
│       ├── composition.json              # Original Composition template (input)
│       ├── header.html                   # Optional header template (supports {{ FHIRPath }})
│       ├── footer.html                   # Optional footer template (supports {{ FHIRPath }})
│       └── output/                       # Generated HTML + PDF
├── src/
│   ├── generate_html.py                  # HTML/PDF generation from Composition templates
│   └── fhir_liquid/                      # FHIRPath expression evaluation in Liquid-style templates
├── resources/                            # Original Composition template reference
├── examples/                             # Original form specifications
└── docs/                                 # Technical documentation
```

## Iterations

| # | Name | Description |
|---|------|-------------|
| 01 | `liquid-template` | FHIR Liquid syntax with `{{ }}` FHIRPath expressions |
| 02 | `nested-questionnaire` | Groups bilateral measurements under RE/LI sub-items |
| 03 | `nested-choice-questions` | Uses choice question with nested items per laterality answer |
| 04 | `mr-rectum` | MR Rectum structured report with SDC template-based extraction |
| 05 | `pathology` | Pathology colon resection report with header/footer templates and PDF output |

## Usage

```bash
# Install dependencies
uv sync

# Generate HTML + PDF for the default iteration
python src/generate_html.py

# Generate for a specific iteration
python src/generate_html.py 05-pathology
```

Output is written to `iterations/<iteration>/output/` (HTML and PDF).

### Header/Footer Templates

Iterations can include optional `header.html` and `footer.html` files. These templates support `{{ FHIRPath }}` expressions that are evaluated against the QuestionnaireResponse, e.g. :

```html
<header>
    <div class="report-meta">
        <strong>Reported:</strong> {{%resource.authored}}
    </div>
</header>
```

## Background

### SDC Template Extraction

Uses these SDC extensions:
- `sdc-questionnaire-templateExtract` - Points to contained template resource
- `sdc-questionnaire-templateExtractContext` - Sets FHIRPath context for sections
- `sdc-questionnaire-templateExtractValue` - Extracts values using FHIRPath

### Clinical Forms

- **CTS Study** (iterations 01-03) — BHSC Carpal Tunnel Syndrome study form
- **MR Rectum** (iteration 04) — Structured MR Rectum radiology report
- **Pathology** (iteration 05) — Colon resection pathology report

## Dependencies

- [`fhirpathpy`](https://github.com/beda-software/fhirpathpy) — FHIRPath evaluation engine
- [`python-liquid2`](https://github.com/jg-rp/python-liquid2) — Reserved for future Liquid control flow support
- [`weasyprint`](https://weasyprint.org/) — HTML to PDF rendering
