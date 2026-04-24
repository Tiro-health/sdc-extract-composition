"""Tests for the ``||`` filter pipeline in fhir_liquid."""

from __future__ import annotations

import pytest

from fhir_liquid import render_template
from fhir_liquid.filters import FilterInvocation, apply_filters, split_filters


# A minimal QuestionnaireResponse-shaped fixture.
@pytest.fixture
def qr() -> dict:
    return {
        "resourceType": "QuestionnaireResponse",
        "item": [
            {
                "linkId": "root",
                "item": [
                    {
                        "linkId": "name",
                        "answer": [{"valueString": "alice"}],
                    },
                    {
                        "linkId": "note",
                        "answer": [{"valueString": "**hello**"}],
                    },
                    {
                        "linkId": "code",
                        "answer": [{"valueString": "a|b"}],
                    },
                ],
            }
        ],
    }


# --- splitter ---------------------------------------------------------------


def test_splitter_no_filter():
    head, filters = split_filters(" %resource.id ")
    assert head == "%resource.id"
    assert filters == []


def test_splitter_single_filter():
    head, filters = split_filters("%resource.id || upcase")
    assert head == "%resource.id"
    assert [f.name for f in filters] == ["upcase"]


def test_splitter_chained_filters():
    head, filters = split_filters("%resource.id || downcase || prepend: 'x'")
    assert head == "%resource.id"
    assert [f.name for f in filters] == ["downcase", "prepend"]
    assert filters[1].args == ["x"]


def test_splitter_ignores_pipe_inside_quotes():
    # A single '|' inside a FHIRPath quoted literal must not be split.
    head, filters = split_filters("iif(x = 'a|b', 'yes', 'no')")
    assert head == "iif(x = 'a|b', 'yes', 'no')"
    assert filters == []


def test_splitter_ignores_double_pipe_inside_quotes():
    # '||' inside a quoted filter argument must not start a new filter.
    head, filters = split_filters("name || prepend: 'a || b '")
    assert head == "name"
    assert len(filters) == 1
    assert filters[0].args == ["a || b "]


def test_splitter_fhirpath_union_operator():
    # FHIRPath union '|' with no second '|' must be left alone.
    head, filters = split_filters("Patient.name | Patient.telecom")
    assert head == "Patient.name | Patient.telecom"
    assert filters == []


# --- apply_filters ----------------------------------------------------------


def test_apply_filters_unknown_raises():
    with pytest.raises(ValueError, match="bogus"):
        apply_filters("x", [FilterInvocation("bogus", [])])


# --- end-to-end render_template --------------------------------------------


def _ctx(qr: dict) -> dict:
    return {"resource": qr, "base": "%resource.item.where(linkId='root')"}


def test_render_no_filter_regression(qr):
    out = render_template(
        "{{ %context.item.where(linkId='name').answer.value }}",
        _ctx(qr),
    )
    assert out == "alice"


def test_render_single_filter(qr):
    out = render_template(
        "{{ %context.item.where(linkId='name').answer.value || upcase }}",
        _ctx(qr),
    )
    assert out == "ALICE"


def test_render_chained_filters(qr):
    out = render_template(
        "{{ %context.item.where(linkId='name').answer.value "
        "|| upcase || prepend: 'patient: ' }}",
        _ctx(qr),
    )
    assert out == "patient: ALICE"


def test_render_empty_result_through_filter(qr):
    out = render_template(
        "{{ %context.item.where(linkId='missing').answer.value || upcase }}",
        _ctx(qr),
    )
    assert out == ""


def test_render_fhirpath_literal_with_pipe_passes_through(qr):
    # The FHIRPath literal 'a|b' must round-trip via an .where() that matches it.
    out = render_template(
        "{{ %context.item.where(linkId='code').answer.value }}",
        _ctx(qr),
    )
    assert out == "a|b"


def test_render_markdownify(qr):
    out = render_template(
        "{{ %context.item.where(linkId='note').answer.value || markdownify }}",
        _ctx(qr),
    )
    assert "<strong>hello</strong>" in out


def test_render_unknown_filter_raises(qr):
    with pytest.raises(ValueError, match="bogus"):
        render_template(
            "{{ %context.item.where(linkId='name').answer.value || bogus }}",
            _ctx(qr),
        )
