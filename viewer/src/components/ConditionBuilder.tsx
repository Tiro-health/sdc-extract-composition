import { useCallback, useMemo } from "react";
import type {
  Condition,
  ConditionOperator,
  ConditionScope,
  CombineMode,
} from "../utils/context-expression";
import type { QuestionnaireIndex } from "../utils/questionnaire-index";
import type { QuestionnaireIndex as WasmQuestionnaireIndex } from "fhirpath-rs";
import { useWasmQuestionnaireIndex } from "./lexical/WasmQuestionnaireIndexContext";

interface ConditionBuilderProps {
  conditions: Condition[];
  combineMode: CombineMode;
  questionnaireIndex?: QuestionnaireIndex;
  contextExpression?: string | null;
  onChange: (conditions: Condition[], combineMode: CombineMode) => void;
}

interface ConditionRowProps {
  condition: Condition;
  questionnaireIndex?: QuestionnaireIndex;
  contextExpression?: string | null;
  wasmIndex: WasmQuestionnaireIndex | null;
  onChange: (condition: Condition) => void;
  onRemove: () => void;
}

interface FieldItem {
  linkId: string;
  text: string;
  type: string;
  scope: ConditionScope;
}

interface WasmCompletionItem {
  link_id: string;
  label: string;
  item_type: string;
  kind: string;
  traverses_repeating?: boolean;
}

const BASE_OPERATORS: { value: ConditionOperator; label: string }[] = [
  { value: "exists", label: "exists" },
  { value: "not-exists", label: "not exists" },
];

const CODING_OPERATORS: { value: ConditionOperator; label: string }[] = [
  { value: "exists", label: "exists" },
  { value: "not-exists", label: "not exists" },
  { value: "equals", label: "=" },
  { value: "not-equals", label: "≠" },
];

const CODING_TYPES = new Set(["choice", "open-choice", "coding"]);

function generateFieldItems(
  wasmIndex: WasmQuestionnaireIndex | null,
  questionnaireIndex: QuestionnaireIndex | undefined,
  contextExpression: string | null | undefined,
): { contextItems: FieldItem[]; resourceItems: FieldItem[] } {
  const contextItems: FieldItem[] = [];
  const resourceItems: FieldItem[] = [];
  const resourceLinkIds = new Set<string>();

  if (wasmIndex) {
    try {
      // Get %resource completions first
      const resourceCompletions = wasmIndex.generate_completions("%resource") as WasmCompletionItem[];
      for (const item of resourceCompletions) {
        // Filter out items that traverse repeating ancestors (ambiguous)
        if (item.traverses_repeating) continue;
        if (item.kind === "value" && item.link_id && item.item_type !== "group" && item.item_type !== "display") {
          resourceItems.push({
            linkId: item.link_id,
            text: item.label,
            type: item.item_type,
            scope: "resource",
          });
          resourceLinkIds.add(item.link_id);
        }
      }

      // Get %context completions from parent context
      if (contextExpression) {
        const contextCompletions = wasmIndex.generate_completions(contextExpression) as WasmCompletionItem[];
        for (const item of contextCompletions) {
          // Filter out items that traverse repeating ancestors (ambiguous)
          if (item.traverses_repeating) continue;
          // Filter out duplicates already in %resource
          if (resourceLinkIds.has(item.link_id)) continue;
          if (item.kind === "value" && item.link_id && item.item_type !== "group" && item.item_type !== "display") {
            contextItems.push({
              linkId: item.link_id,
              text: item.label,
              type: item.item_type,
              scope: "context",
            });
          }
        }
      }
    } catch {
      // Fall through to JS fallback
    }
  }

  // Fallback to JS index if WASM didn't produce results
  if (resourceItems.length === 0 && questionnaireIndex) {
    for (const [linkId, info] of questionnaireIndex.items) {
      if (info.type === "group" || info.type === "display") continue;
      resourceItems.push({
        linkId,
        text: info.text || linkId,
        type: info.type,
        scope: "resource",
      });
    }
  }

  return { contextItems, resourceItems };
}

function ConditionRow({
  condition,
  questionnaireIndex,
  contextExpression,
  wasmIndex,
  onChange,
  onRemove,
}: ConditionRowProps) {
  const { contextItems, resourceItems } = useMemo(
    () => generateFieldItems(wasmIndex, questionnaireIndex, contextExpression),
    [wasmIndex, questionnaireIndex, contextExpression]
  );

  const selectedItemInfo = useMemo(() => {
    if (!questionnaireIndex || !condition.linkId) return null;
    return questionnaireIndex.items.get(condition.linkId) ?? null;
  }, [questionnaireIndex, condition.linkId]);

  const isCodingType = selectedItemInfo ? CODING_TYPES.has(selectedItemInfo.type) : false;
  const operators = isCodingType ? CODING_OPERATORS : BASE_OPERATORS;

  const answerCodings = useMemo(() => {
    if (!selectedItemInfo?.answerCodings) return [];
    return Array.from(selectedItemInfo.answerCodings.values());
  }, [selectedItemInfo]);

  const needsValue =
    condition.operator === "equals" || condition.operator === "not-equals";

  const handleFieldChange = useCallback(
    (value: string) => {
      const [scope, linkId] = value.split(":", 2) as [ConditionScope, string];
      const newInfo = questionnaireIndex?.items.get(linkId);
      const newIsCoding = newInfo ? CODING_TYPES.has(newInfo.type) : false;
      const needsReset = !newIsCoding && (condition.operator === "equals" || condition.operator === "not-equals");

      onChange({
        ...condition,
        linkId,
        scope,
        operator: needsReset ? "exists" : condition.operator,
        value: undefined,
      });
    },
    [condition, onChange, questionnaireIndex]
  );

  const handleOperatorChange = useCallback(
    (operator: ConditionOperator) => {
      const newCondition = { ...condition, operator };
      if (operator === "exists" || operator === "not-exists") {
        delete newCondition.value;
      }
      onChange(newCondition);
    },
    [condition, onChange]
  );

  const handleValueChange = useCallback(
    (system: string, code: string) => {
      onChange({ ...condition, value: { system, code } });
    },
    [condition, onChange]
  );

  const selectedValue = condition.linkId
    ? `${condition.scope || "resource"}:${condition.linkId}`
    : "";

  return (
    <div className="condition-row">
      <select
        className="condition-field-select"
        value={selectedValue}
        onChange={(e) => handleFieldChange(e.target.value)}
      >
        <option value="">Select field...</option>
        {contextItems.length > 0 && (
          <optgroup label="%context (current scope)">
            {contextItems.map((item) => (
              <option key={`context:${item.linkId}`} value={`context:${item.linkId}`}>
                {item.text || item.linkId}
              </option>
            ))}
          </optgroup>
        )}
        {resourceItems.length > 0 && (
          <optgroup label="%resource (entire form)">
            {resourceItems.map((item) => (
              <option key={`resource:${item.linkId}`} value={`resource:${item.linkId}`}>
                {item.text || item.linkId}
              </option>
            ))}
          </optgroup>
        )}
      </select>

      <select
        className="condition-operator-select"
        value={condition.operator}
        onChange={(e) => handleOperatorChange(e.target.value as ConditionOperator)}
      >
        {operators.map((op) => (
          <option key={op.value} value={op.value}>
            {op.label}
          </option>
        ))}
      </select>

      {needsValue ? (
        answerCodings.length > 0 ? (
          <select
            className="condition-value-select"
            value={condition.value ? `${condition.value.system ?? ""}|${condition.value.code}` : ""}
            onChange={(e) => {
              const [system, code] = e.target.value.split("|");
              handleValueChange(system, code);
            }}
          >
            <option value="">Select value...</option>
            {answerCodings.map((opt) => (
              <option
                key={`${opt.system ?? ""}|${opt.code}`}
                value={`${opt.system ?? ""}|${opt.code}`}
              >
                {opt.display || opt.code}
              </option>
            ))}
          </select>
        ) : (
          <input
            type="text"
            className="condition-value-input"
            placeholder="code"
            value={condition.value?.code ?? ""}
            onChange={(e) =>
              handleValueChange(condition.value?.system ?? "", e.target.value)
            }
          />
        )
      ) : (
        <div className="condition-value-placeholder">—</div>
      )}

      <button
        type="button"
        className="condition-remove-btn"
        onClick={onRemove}
        title="Remove condition"
      >
        ×
      </button>
    </div>
  );
}

export function ConditionBuilder({
  conditions,
  combineMode,
  questionnaireIndex,
  contextExpression,
  onChange,
}: ConditionBuilderProps) {
  const wasmIndex = useWasmQuestionnaireIndex();
  const handleConditionChange = useCallback(
    (index: number, condition: Condition) => {
      const newConditions = [...conditions];
      newConditions[index] = condition;
      onChange(newConditions, combineMode);
    },
    [conditions, combineMode, onChange]
  );

  const handleConditionRemove = useCallback(
    (index: number) => {
      const newConditions = conditions.filter((_, i) => i !== index);
      onChange(newConditions, combineMode);
    },
    [conditions, combineMode, onChange]
  );

  const handleAddCondition = useCallback(() => {
    const newCondition: Condition = {
      linkId: "",
      operator: "exists",
    };
    onChange([...conditions, newCondition], combineMode);
  }, [conditions, combineMode, onChange]);

  const handleCombineModeChange = useCallback(
    (mode: CombineMode) => {
      onChange(conditions, mode);
    },
    [conditions, onChange]
  );

  return (
    <div className="condition-builder">
      <div className="condition-builder-header">
        <span className="condition-builder-label">Show section when</span>
        <select
          className="condition-combine-select"
          value={combineMode}
          onChange={(e) => handleCombineModeChange(e.target.value as CombineMode)}
        >
          <option value="and">all</option>
          <option value="or">any</option>
        </select>
        <span className="condition-builder-label">conditions match:</span>
      </div>

      <div className="condition-list">
        {conditions.map((condition, index) => (
          <ConditionRow
            key={index}
            condition={condition}
            questionnaireIndex={questionnaireIndex}
            contextExpression={contextExpression}
            wasmIndex={wasmIndex}
            onChange={(c) => handleConditionChange(index, c)}
            onRemove={() => handleConditionRemove(index)}
          />
        ))}
      </div>

      <button
        type="button"
        className="condition-add-btn"
        onClick={handleAddCondition}
      >
        + Add condition
      </button>
    </div>
  );
}
