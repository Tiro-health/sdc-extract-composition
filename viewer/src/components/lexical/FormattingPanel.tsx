import { useId, useMemo, useState, type ChangeEvent } from "react";
import {
  formatExpression,
  parseExpression,
  type FilterInvocation,
  type FilterLiteral,
  type ParsedExpression,
} from "../../utils/filter-pipeline";
import {
  filtersForShape,
  getFilterSpec,
  HIDDEN_FILTERS,
  type FilterSpec,
} from "../../utils/filter-catalog";
import type { AnswerShape } from "../../utils/expression-type";

interface FormattingPanelProps {
  expression: string;
  /** From inferAnswerShape — drives which filters are offered. */
  shape: AnswerShape | null;
  /** Omit (or pass undefined) to render read-only. */
  onChange?: (next: string) => void;
}

export function FormattingPanel({
  expression,
  shape,
  onChange,
}: FormattingPanelProps) {
  const parsed = useMemo<ParsedExpression>(
    () => parseExpression(expression),
    [expression],
  );

  // Filters managed elsewhere (e.g. designation owned by SynonymsPanel)
  // are kept in the source string but never shown in this panel.
  const visibleIndices = useMemo<number[]>(
    () =>
      parsed.filters
        .map((f, i) => ({ f, i }))
        .filter(({ f }) => !HIDDEN_FILTERS.has(f.name))
        .map(({ i }) => i),
    [parsed.filters],
  );

  const editable = onChange != null;
  const valueShape = shape?.valueShape ?? null;
  const offered = filtersForShape(valueShape);
  const used = new Set(parsed.filters.map((f) => f.name));
  const addable = offered.filter((spec) => !used.has(spec.name));

  const setFilters = (next: FilterInvocation[]) => {
    if (!onChange) return;
    onChange(formatExpression({ ...parsed, filters: next }));
  };

  const updateFilterAt = (index: number, next: FilterInvocation) => {
    const filters = [...parsed.filters];
    filters[index] = next;
    setFilters(filters);
  };

  const removeFilterAt = (index: number) => {
    const filters = parsed.filters.filter((_, i) => i !== index);
    setFilters(filters);
  };

  const addFilter = (spec: FilterSpec) => {
    const args: FilterLiteral[] = spec.args.map((a) =>
      a.kind === "number" ? 0 : "",
    );
    const next: FilterInvocation = {
      name: spec.name,
      args,
      source: "",
    };
    setFilters([...parsed.filters, next]);
  };

  return (
    <div className="formatting-panel">
      <div className="formatting-panel-header">
        <span>Opmaak</span>
        {valueShape && (
          <span className="formatting-panel-shape" title={shapeTitle(shape)}>
            {valueShape}
          </span>
        )}
      </div>
      <div className="formatting-panel-body">
        {!editable && (
          <div className="formatting-empty">
            Read-only — formats cannot be edited.
          </div>
        )}
        {visibleIndices.length === 0 && (
          <div className="formatting-empty">
            {editable
              ? "No formats applied. Add one below to shape the rendered value."
              : "No formats applied."}
          </div>
        )}
        {visibleIndices.length > 0 && (
          <ul className="formatting-filter-list">
            {visibleIndices.map((idx) => (
              <FilterRow
                key={`${idx}::${parsed.filters[idx].name}`}
                invocation={parsed.filters[idx]}
                editable={editable}
                onChange={(next) => updateFilterAt(idx, next)}
                onRemove={() => removeFilterAt(idx)}
              />
            ))}
          </ul>
        )}
        {editable && addable.length > 0 && (
          <AddFilterRow specs={addable} onAdd={addFilter} />
        )}
        {editable && addable.length === 0 && offered.length > 0 && (
          <div className="formatting-empty">
            All applicable formats have been added.
          </div>
        )}
      </div>
    </div>
  );
}

interface FilterRowProps {
  invocation: FilterInvocation;
  editable: boolean;
  onChange: (next: FilterInvocation) => void;
  onRemove: () => void;
}

function FilterRow({
  invocation,
  editable,
  onChange,
  onRemove,
}: FilterRowProps) {
  const spec = getFilterSpec(invocation.name);
  const argSpecs = spec?.args ?? [];

  const updateArg = (argIndex: number, value: FilterLiteral) => {
    const args = [...invocation.args];
    while (args.length <= argIndex) args.push("");
    args[argIndex] = value;
    onChange({ ...invocation, args });
  };

  return (
    <li className="formatting-filter-row">
      <div className="formatting-filter-head">
        <span className="formatting-filter-name">
          {spec?.label ?? invocation.name}
        </span>
        <code className="formatting-filter-token">{invocation.name}</code>
        {editable && (
          <button
            type="button"
            className="formatting-button-link formatting-button-danger"
            onClick={onRemove}
            title="Remove format"
          >
            Remove
          </button>
        )}
      </div>
      {spec?.description && (
        <div className="formatting-filter-help">{spec.description}</div>
      )}
      {argSpecs.length > 0 && (
        <div className="formatting-filter-args">
          {argSpecs.map((argSpec, i) => (
            <FilterArgInput
              key={argSpec.name}
              spec={argSpec}
              value={invocation.args[i]}
              editable={editable}
              onChange={(v) => updateArg(i, v)}
            />
          ))}
        </div>
      )}
      {!spec && (
        <div className="formatting-filter-help formatting-filter-warning">
          Unknown format — kept as-is.
        </div>
      )}
    </li>
  );
}

interface FilterArgInputProps {
  spec: { name: string; kind: "string" | "number"; placeholder?: string };
  value: FilterLiteral | undefined;
  editable: boolean;
  onChange: (next: FilterLiteral) => void;
}

function FilterArgInput({
  spec,
  value,
  editable,
  onChange,
}: FilterArgInputProps) {
  const id = useId();
  const display =
    value === undefined || value === null
      ? ""
      : typeof value === "boolean"
        ? value
          ? "true"
          : "false"
        : String(value);

  const handle = (event: ChangeEvent<HTMLInputElement>) => {
    if (spec.kind === "number") {
      const parsed = Number(event.target.value);
      onChange(Number.isFinite(parsed) ? parsed : 0);
      return;
    }
    onChange(event.target.value);
  };

  return (
    <label className="formatting-filter-arg" htmlFor={id}>
      <span className="formatting-filter-arg-label">{spec.name}</span>
      <input
        id={id}
        type={spec.kind === "number" ? "number" : "text"}
        className="formatting-filter-arg-input"
        value={display}
        placeholder={spec.placeholder}
        onChange={handle}
        readOnly={!editable}
      />
    </label>
  );
}

interface AddFilterRowProps {
  specs: FilterSpec[];
  onAdd: (spec: FilterSpec) => void;
}

function AddFilterRow({ specs, onAdd }: AddFilterRowProps) {
  const [picked, setPicked] = useState<string>("");
  const submit = () => {
    if (!picked) return;
    const spec = specs.find((s) => s.name === picked);
    if (!spec) return;
    onAdd(spec);
    setPicked("");
  };

  return (
    <div className="formatting-add-row">
      <select
        className="formatting-add-select"
        value={picked}
        onChange={(e) => setPicked(e.target.value)}
      >
        <option value="">Add format…</option>
        {specs.map((spec) => (
          <option key={spec.name} value={spec.name}>
            {spec.label}
          </option>
        ))}
      </select>
      <button
        type="button"
        className="formatting-button"
        disabled={!picked}
        onClick={submit}
      >
        Add
      </button>
    </div>
  );
}

function shapeTitle(shape: AnswerShape | null): string {
  if (!shape) return "";
  const parts = [`reads ${shape.linkIds.join(", ")}`];
  if (shape.itemType) parts.push(`item.type = ${shape.itemType}`);
  parts.push(`value shape = ${shape.valueShape}`);
  return parts.join(" • ");
}
