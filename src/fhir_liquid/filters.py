"""Liquid-style filter pipeline for FHIR Liquid templates.

The FHIR Liquid profile uses ``||`` (not ``|``) as the filter separator
because ``|`` is the FHIRPath union operator. This module implements:

- Quote-aware splitting of a template inner (``{{ ... }}``) on ``||``
- A tiny literal parser for filter arguments (quoted strings, ints,
  floats, booleans)
- A registry of the spec-minimum filters: ``upcase``, ``downcase``,
  ``prepend``, ``markdownify``
"""

from __future__ import annotations

from typing import Any, Callable

import markdown as _markdown

__all__ = [
    "FILTERS",
    "FilterInvocation",
    "split_filters",
    "apply_filters",
]


FilterFn = Callable[..., Any]


def _upcase(value: Any) -> str:
    return _scalar_str(value).upper()


def _downcase(value: Any) -> str:
    return _scalar_str(value).lower()


def _prepend(value: Any, prefix: str) -> str:
    return f"{prefix}{_scalar_str(value)}"


def _markdownify(value: Any) -> str:
    return _markdown.markdown(_scalar_str(value))


def _scalar_str(value: Any) -> str:
    """Coerce a FHIRPath result to a string for filter input.

    ``evaluate_fhirpath`` returns ``""`` for empty results, unwraps
    single-element lists, and otherwise may return a list. Filters
    operate on strings, so lists are joined and empties pass through.
    """
    if value is None or value == "":
        return ""
    if isinstance(value, bool):
        return str(value).lower()
    if isinstance(value, list):
        return "".join(_scalar_str(item) for item in value)
    return str(value)


FILTERS: dict[str, FilterFn] = {
    "upcase": _upcase,
    "downcase": _downcase,
    "prepend": _prepend,
    "markdownify": _markdownify,
}


class FilterInvocation:
    """A single filter call parsed from the template source."""

    __slots__ = ("name", "args")

    def __init__(self, name: str, args: list[Any]) -> None:
        self.name = name
        self.args = args

    def __repr__(self) -> str:  # pragma: no cover - debug aid
        return f"FilterInvocation(name={self.name!r}, args={self.args!r})"


def split_filters(inner: str) -> tuple[str, list[FilterInvocation]]:
    """Split the inside of ``{{ ... }}`` into the FHIRPath head and filters.

    Respects single- and double-quoted string literals so that ``||``
    inside quotes is treated as text, and so that FHIRPath's single
    ``|`` union operator is never mistaken for a filter boundary.

    Returns ``(fhirpath_expression, [FilterInvocation, ...])``.
    """
    segments = _split_top_level(inner, "||")
    head = segments[0].strip()
    filters = [_parse_filter(seg) for seg in segments[1:]]
    return head, filters


def apply_filters(value: Any, filters: list[FilterInvocation]) -> Any:
    """Run ``value`` through each filter in order."""
    for f in filters:
        fn = FILTERS.get(f.name)
        if fn is None:
            raise ValueError(
                f"Unknown filter {f.name!r}. "
                f"Known filters: {sorted(FILTERS)}"
            )
        value = fn(value, *f.args)
    return value


# --- internals ---------------------------------------------------------------


def _split_top_level(source: str, sep: str) -> list[str]:
    """Split ``source`` on ``sep`` outside of single/double-quoted regions."""
    parts: list[str] = []
    buf: list[str] = []
    i = 0
    quote: str | None = None
    n = len(source)
    sep_len = len(sep)
    while i < n:
        ch = source[i]
        if quote is not None:
            buf.append(ch)
            if ch == "\\" and i + 1 < n:
                buf.append(source[i + 1])
                i += 2
                continue
            if ch == quote:
                quote = None
            i += 1
            continue
        if ch in ("'", '"'):
            quote = ch
            buf.append(ch)
            i += 1
            continue
        if source.startswith(sep, i):
            parts.append("".join(buf))
            buf = []
            i += sep_len
            continue
        buf.append(ch)
        i += 1
    parts.append("".join(buf))
    return parts


def _parse_filter(segment: str) -> FilterInvocation:
    """Parse a single ``name`` or ``name: arg1, arg2`` segment."""
    segment = segment.strip()
    if not segment:
        raise ValueError("Empty filter segment (stray '||'?)")
    if ":" not in segment:
        return FilterInvocation(_validate_name(segment), [])
    name_part, args_part = segment.split(":", 1)
    args = [_parse_literal(a) for a in _split_top_level(args_part, ",")]
    # drop trailing empty arg from "name:" with nothing after
    if args and args_part.strip() == "":
        args = []
    return FilterInvocation(_validate_name(name_part.strip()), args)


def _validate_name(name: str) -> str:
    if not name or not name.replace("_", "").isalnum():
        raise ValueError(f"Invalid filter name: {name!r}")
    return name


def _parse_literal(token: str) -> Any:
    """Parse a filter argument: quoted string, int, float, or bool."""
    t = token.strip()
    if not t:
        raise ValueError("Empty filter argument")
    if len(t) >= 2 and t[0] == t[-1] and t[0] in ("'", '"'):
        return _unescape(t[1:-1])
    if t == "true":
        return True
    if t == "false":
        return False
    try:
        if "." in t or "e" in t or "E" in t:
            return float(t)
        return int(t)
    except ValueError as exc:
        raise ValueError(
            f"Unsupported filter argument literal: {token!r}"
        ) from exc


def _unescape(s: str) -> str:
    out: list[str] = []
    i = 0
    while i < len(s):
        if s[i] == "\\" and i + 1 < len(s):
            nxt = s[i + 1]
            out.append({"n": "\n", "t": "\t", "r": "\r"}.get(nxt, nxt))
            i += 2
            continue
        out.append(s[i])
        i += 1
    return "".join(out)
