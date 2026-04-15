import { createContext, useContext } from "react";
import type { QuestionnaireIndex } from "../../utils/questionnaire-index";

const QuestionnaireIndexContext = createContext<QuestionnaireIndex | undefined>(
  undefined
);

export const QuestionnaireIndexProvider = QuestionnaireIndexContext.Provider;

export function useQuestionnaireIndex(): QuestionnaireIndex | undefined {
  return useContext(QuestionnaireIndexContext);
}
