import type { Questionnaire } from "../types";
import { TiroFormFiller } from "./TiroFormFiller";

interface QuestionnaireFormPanelProps {
  questionnaire: Questionnaire;
  onResponse: (qr: Record<string, unknown>) => void;
  questionnaireResponse: Record<string, unknown> | null;
}

export function QuestionnaireFormPanel({
  questionnaire,
  onResponse,
  questionnaireResponse,
}: QuestionnaireFormPanelProps) {
  return (
    <div className="panel-container">
      <div className="panel-header">
        <h2 className="panel-title">Questionnaire</h2>
      </div>
      <div className="panel-body">
        <TiroFormFiller
          questionnaire={questionnaire}
          onResponse={onResponse}
          initialResponse={questionnaireResponse}
        />
      </div>
    </div>
  );
}
