import { useMemo, useState } from "react";
import type { Questionnaire } from "./types";
import { extractComposition } from "./utils/extract-composition";
import { buildLinkIdTextMap } from "./utils/questionnaire-index";
import { QuestionnaireLoader } from "./components/QuestionnaireLoader";
import { CompositionView } from "./components/CompositionView";

function App() {
  const [questionnaire, setQuestionnaire] = useState<Questionnaire | null>(
    null
  );

  const composition = questionnaire
    ? extractComposition(questionnaire)
    : null;

  const linkIdTextMap = useMemo(
    () => (questionnaire ? buildLinkIdTextMap(questionnaire) : undefined),
    [questionnaire]
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <header className="mb-6">
          <h1 className="text-xl font-bold text-gray-900 mb-1">
            Composition Template Viewer
          </h1>
          <p className="text-sm text-gray-500">
            Inspect SDC Composition templates with FHIRPath expression
            highlighting
          </p>
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
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <CompositionView composition={composition} linkIdTextMap={linkIdTextMap} />
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
