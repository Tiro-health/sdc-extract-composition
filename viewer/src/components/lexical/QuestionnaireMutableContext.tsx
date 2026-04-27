import { createContext, useContext } from "react";
import type { Questionnaire } from "../../types";

export interface QuestionnaireMutator {
  questionnaire: Questionnaire;
  setQuestionnaire: (next: Questionnaire) => void;
}

const QuestionnaireMutableContext = createContext<
  QuestionnaireMutator | undefined
>(undefined);

export const QuestionnaireMutableProvider = QuestionnaireMutableContext.Provider;

export function useQuestionnaireMutable(): QuestionnaireMutator | undefined {
  return useContext(QuestionnaireMutableContext);
}
