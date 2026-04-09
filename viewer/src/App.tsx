import { useMemo, useState } from "react";
import type { Questionnaire } from "./types";
import { extractComposition } from "./utils/extract-composition";
import { buildQuestionnaireIndex } from "./utils/questionnaire-index";
import { QuestionnaireLoader } from "./components/QuestionnaireLoader";
import { CompositionView } from "./components/CompositionView";
import { RawCompositionView } from "./components/RawCompositionView";

type ViewMode = "rendered" | "raw" | "split";

function App() {
  const [questionnaire, setQuestionnaire] = useState<Questionnaire | null>(
    null
  );
  const [viewMode, setViewMode] = useState<ViewMode>("split");

  const composition = questionnaire
    ? extractComposition(questionnaire)
    : null;

  const questionnaireIndex = useMemo(
    () => (questionnaire ? buildQuestionnaireIndex(questionnaire) : undefined),
    [questionnaire]
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <div className={viewMode === "split" ? "max-w-[1600px] mx-auto px-4 py-8" : "max-w-4xl mx-auto px-4 py-8"}>
        <header className="mb-6 flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900 mb-1">
              Composition Template Viewer
            </h1>
            <p className="text-sm text-gray-500">
              Inspect SDC Composition templates with FHIRPath expression
              highlighting
            </p>
          </div>
          {composition && (
            <div className="flex gap-1 bg-gray-100 rounded-lg p-0.5">
              {(["rendered", "split", "raw"] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  className={`px-3 py-1 text-xs rounded-md transition-colors ${
                    viewMode === mode
                      ? "bg-white shadow-sm text-gray-900 font-medium"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  {mode === "rendered" ? "Rendered" : mode === "raw" ? "Raw" : "Split"}
                </button>
              ))}
            </div>
          )}
        </header>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
          <QuestionnaireLoader onLoad={setQuestionnaire} />
        </div>

        {questionnaire && !composition && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-sm text-yellow-800">
            No Composition found in Questionnaire.contained
          </div>
        )}

        {composition && (
          <div className={viewMode === "split" ? "grid grid-cols-2 gap-4" : ""}>
            {(viewMode === "rendered" || viewMode === "split") && (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 overflow-auto">
                <CompositionView composition={composition} questionnaireIndex={questionnaireIndex} />
              </div>
            )}
            {(viewMode === "raw" || viewMode === "split") && (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 overflow-auto">
                <RawCompositionView composition={composition} />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
