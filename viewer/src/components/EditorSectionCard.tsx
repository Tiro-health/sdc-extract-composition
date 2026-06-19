import { useState } from "react";
import type { CompositionSection } from "../types";
import type { QuestionnaireIndex } from "../utils/questionnaire-index";
import {
  getContextExpression,
  inferContextType,
  CONTEXT_ICONS,
} from "../utils/section-helpers";
import { stripDivWrapper } from "../utils/parse-narrative";
import { NarrativeHtml } from "./NarrativeHtml";
import { AddBetweenButton } from "./AddBetweenButton";
import { ContextBadge } from "./ContextBadge";
import { ContextTooltip } from "./ContextTooltip";
import { SectionEditorModal } from "./lexical/SectionEditorModal";

interface EditorSectionCardProps {
  section: CompositionSection;
  sectionPath: number[];
  questionnaireIndex?: QuestionnaireIndex;
  parentContextExpression?: string | null;
  onSectionChange: (
    sectionPath: number[],
    newDivHtml: string,
    newTitle: string,
    newContextExpression: string
  ) => void;
  onAddSection: (parentPath: number[], insertIndex?: number) => void;
  onRemoveSection: (sectionPath: number[]) => void;
  onDuplicateSection?: (sectionPath: number[]) => void;
}

export function EditorSectionCard({
  section,
  sectionPath,
  questionnaireIndex,
  parentContextExpression,
  onSectionChange,
  onAddSection,
  onRemoveSection,
  onDuplicateSection,
}: EditorSectionCardProps) {
  const [modalOpen, setModalOpen] = useState(false);

  const contextExpr = getContextExpression(section);
  const contextType = inferContextType(contextExpr);
  const contextIcon = CONTEXT_ICONS[contextType];

  const hasTitle = !!section.title?.trim();
  // Check if div has actual content (not just empty XHTML wrapper)
  const innerContent = section.text?.div ? stripDivWrapper(section.text.div).trim() : "";
  const hasContent = innerContent.length > 0;
  const children = section.section ?? [];

  const handleCardClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setModalOpen(true);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onRemoveSection(sectionPath);
  };

  const handleDuplicate = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDuplicateSection?.(sectionPath);
  };

  const handleAddSubsection = (e: React.MouseEvent) => {
    e.stopPropagation();
    onAddSection(sectionPath);
  };

  const handleSave = (
    newDivHtml: string,
    newTitle: string,
    newContextExpression: string
  ) => {
    onSectionChange(sectionPath, newDivHtml, newTitle, newContextExpression);
  };

  return (
    <>
      <div className="editor-section-wrapper">
        <div
          className="editor-section"
          data-context={contextType}
          data-animation={section._animationState}
          onClick={handleCardClick}
        >
          {contextExpr ? (
            <ContextTooltip
              triggerClassName="editor-context-icon-slot"
              content={
                <ContextBadge
                  expression={contextExpr}
                  questionnaireIndex={questionnaireIndex}
                />
              }
            >
              <span className="editor-context-icon">{contextIcon}</span>
            </ContextTooltip>
          ) : (
            <span className="editor-context-icon-slot">
              <span className="editor-context-icon">{contextIcon}</span>
            </span>
          )}

          {onDuplicateSection && (
            <button
              className="editor-duplicate-btn"
              onClick={handleDuplicate}
              title="Duplicate section"
            >
              <svg
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="5" y="5" width="8" height="8" rx="1.5" />
                <path d="M3 11V4a1 1 0 0 1 1-1h7" />
              </svg>
            </button>
          )}
          <button
            className="editor-delete-btn"
            onClick={handleDelete}
            title="Remove section"
          >
            &times;
          </button>

          <div className="editor-section-clickable">
            {hasTitle && (
              <div className="editor-section-title">{section.title}</div>
            )}
            {hasContent ? (
              <div className="editor-section-content">
                <NarrativeHtml
                  divHtml={section.text?.div ?? ""}
                  questionnaireIndex={questionnaireIndex}
                />
              </div>
            ) : (
              <div className="editor-section-content empty">
                Click to add content...
              </div>
            )}
          </div>

          {children.length > 0 && (
            <div
              className="editor-section-children"
              onClick={(e) => {
                if (e.target === e.currentTarget) {
                  setModalOpen(true);
                }
              }}
            >
              <AddBetweenButton
                onClick={() => onAddSection(sectionPath, 0)}
              />
              {children.map((child, i) => (
                <div key={i}>
                  <EditorSectionCard
                    section={child}
                    sectionPath={[...sectionPath, i]}
                    questionnaireIndex={questionnaireIndex}
                    parentContextExpression={contextExpr ?? parentContextExpression}
                    onSectionChange={onSectionChange}
                    onAddSection={onAddSection}
                    onRemoveSection={onRemoveSection}
                    onDuplicateSection={onDuplicateSection}
                  />
                  <AddBetweenButton
                    onClick={() => onAddSection(sectionPath, i + 1)}
                  />
                </div>
              ))}
            </div>
          )}

          <button
            className="editor-subsection-btn"
            onClick={handleAddSubsection}
          >
            + subsection
          </button>
        </div>
      </div>

      <SectionEditorModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={section.title}
        divHtml={section.text?.div ?? ""}
        questionnaireIndex={questionnaireIndex}
        contextExpression={contextExpr}
        parentContextExpression={parentContextExpression}
        onSave={handleSave}
      />
    </>
  );
}
