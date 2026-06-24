import { useEffect, useRef } from "react";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { useLexicalNodeSelection } from "@lexical/react/useLexicalNodeSelection";
import { mergeRegister } from "@lexical/utils";
import {
  $createNodeSelection,
  $getNodeByKey,
  $setSelection,
  CLICK_COMMAND,
  COMMAND_PRIORITY_LOW,
  KEY_BACKSPACE_COMMAND,
  KEY_DELETE_COMMAND,
  type NodeKey,
} from "lexical";
import {
  MISSING_ICON_SVG,
  isExpressionMissing,
  segmentExpressionToHtml,
} from "../../utils/expression-pills";
import { useWasmReady } from "../../utils/wasm-init";
import { useQuestionnaireIndex } from "./QuestionnaireIndexContext";
import { useSectionContextExpression } from "./SectionContextExpressionContext";

interface FhirPathPillComponentProps {
  expression: string;
  nodeKey: NodeKey;
}

export function FhirPathPillComponent({
  expression,
  nodeKey,
}: FhirPathPillComponentProps) {
  const [editor] = useLexicalComposerContext();
  const pillRef = useRef<HTMLElement>(null);
  const [isSelected] = useLexicalNodeSelection(nodeKey);
  const questionnaireIndex = useQuestionnaireIndex();
  const sectionContext = useSectionContextExpression();
  // Subscribe so the pill label recomputes when wasm finishes loading.
  useWasmReady();

  useEffect(() => {
    return mergeRegister(
      editor.registerCommand(
        CLICK_COMMAND,
        (event: MouseEvent) => {
          if (
            !pillRef.current ||
            !pillRef.current.contains(event.target as Node)
          ) {
            return false;
          }
          event.preventDefault();
          editor.update(() => {
            const node = $getNodeByKey(nodeKey);
            if (!node) return;
            const selection = $createNodeSelection();
            selection.add(nodeKey);
            $setSelection(selection);
          });
          return true;
        },
        COMMAND_PRIORITY_LOW,
      ),
      editor.registerCommand(
        KEY_DELETE_COMMAND,
        () => {
          if (isSelected) {
            editor.update(() => {
              const node = $getNodeByKey(nodeKey);
              if (node) node.remove();
            });
            return true;
          }
          return false;
        },
        COMMAND_PRIORITY_LOW,
      ),
      editor.registerCommand(
        KEY_BACKSPACE_COMMAND,
        () => {
          if (isSelected) {
            editor.update(() => {
              const node = $getNodeByKey(nodeKey);
              if (node) node.remove();
            });
            return true;
          }
          return false;
        },
        COMMAND_PRIORITY_LOW,
      ),
    );
  }, [editor, isSelected, nodeKey]);

  const isMissing =
    questionnaireIndex != null &&
    isExpressionMissing(expression, questionnaireIndex, sectionContext);
  const pillHtml = isMissing
    ? `${MISSING_ICON_SVG}Missing`
    : segmentExpressionToHtml(expression, questionnaireIndex, sectionContext);
  const tooltip = isMissing
    ? `'${expression}' doesn't reference a known question. Click to fix.`
    : expression;
  // Tint the pill by its leading variable so a `%context`-rooted reference
  // (only meaningful inside a repeating section) reads as distinct from the
  // global `%resource` form. When both forms reference the same linkId at the
  // same repeating anchor they're visually identical otherwise.
  const variantClass = expression.trimStart().startsWith("%context")
    ? " fhirpath-pill-context"
    : expression.trimStart().startsWith("%resource")
      ? " fhirpath-pill-resource"
      : "";

  const handleClick = (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    editor.update(() => {
      const node = $getNodeByKey(nodeKey);
      if (!node) return;
      const selection = $createNodeSelection();
      selection.add(nodeKey);
      $setSelection(selection);
    });
  };

  return (
    <code
      ref={pillRef}
      className={`fhirpath-pill${variantClass}${isSelected ? " fhirpath-pill-selected" : ""}${isMissing ? " fhirpath-pill-missing" : ""}`}
      title={tooltip}
      dangerouslySetInnerHTML={{ __html: pillHtml }}
      onClick={handleClick}
    />
  );
}
