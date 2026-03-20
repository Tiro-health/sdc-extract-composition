import { useCallback, useEffect, useRef, useState } from "react";
import type { Questionnaire } from "../types";

const iterationModules = import.meta.glob(
  "../../../iterations/*/questionnaire-extract.json",
  { eager: true, import: "default" }
) as Record<string, Questionnaire>;

// Build a map of iteration name → Questionnaire
const iterations = Object.entries(iterationModules).map(([path, data]) => {
  const name = path.split("/").at(-2) ?? path;
  return { name, data };
});

interface QuestionnaireLoaderProps {
  onLoad: (questionnaire: Questionnaire) => void;
}

function IterationDropdown({
  onSelect,
}: {
  onSelect: (q: Questionnaire) => void;
}) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="border border-gray-300 rounded px-2 py-1.5 text-sm bg-white hover:bg-gray-50 min-w-[200px] text-left flex items-center justify-between gap-2"
      >
        <span className={selected ? "text-gray-900" : "text-gray-400"}>
          {selected ?? "Select iteration…"}
        </span>
        <svg
          className="w-3 h-3 text-gray-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>
      {open && (
        <ul className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded shadow-lg py-1 text-sm max-h-60 overflow-auto">
          {iterations.map((it) => (
            <li key={it.name}>
              <button
                onClick={() => {
                  setSelected(it.name);
                  setOpen(false);
                  onSelect(it.data);
                }}
                className={`w-full text-left px-3 py-1.5 hover:bg-gray-100 ${
                  selected === it.name
                    ? "text-blue-700 font-medium"
                    : "text-gray-700"
                }`}
              >
                {it.name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function QuestionnaireLoader({ onLoad }: QuestionnaireLoaderProps) {
  const [pasteValue, setPasteValue] = useState("");
  const [pasteError, setPasteError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handlePaste = useCallback(() => {
    setPasteError(null);
    try {
      const parsed = JSON.parse(pasteValue);
      if (parsed.resourceType !== "Questionnaire") {
        setPasteError("JSON must have resourceType: Questionnaire");
        return;
      }
      onLoad(parsed as Questionnaire);
      setPasteValue("");
    } catch {
      setPasteError("Invalid JSON");
    }
  }, [pasteValue, onLoad]);

  const handleFileUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const parsed = JSON.parse(reader.result as string);
          if (parsed.resourceType !== "Questionnaire") {
            setPasteError("JSON must have resourceType: Questionnaire");
            return;
          }
          onLoad(parsed as Questionnaire);
        } catch {
          setPasteError("Invalid JSON file");
        }
      };
      reader.readAsText(file);
    },
    [onLoad]
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <IterationDropdown onSelect={onLoad} />

        <button
          onClick={() => fileInputRef.current?.click()}
          className="border border-gray-300 rounded px-3 py-1.5 text-sm bg-white hover:bg-gray-50"
        >
          Upload JSON
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          onChange={handleFileUpload}
          className="hidden"
        />
      </div>

      <details className="text-sm">
        <summary className="cursor-pointer text-gray-500 hover:text-gray-700">
          Paste JSON…
        </summary>
        <div className="mt-2 space-y-2">
          <textarea
            value={pasteValue}
            onChange={(e) => setPasteValue(e.target.value)}
            placeholder="Paste Questionnaire JSON here…"
            rows={4}
            className="w-full border border-gray-300 rounded p-2 font-mono text-xs"
          />
          <button
            onClick={handlePaste}
            disabled={!pasteValue.trim()}
            className="border border-gray-300 rounded px-3 py-1 text-sm bg-white hover:bg-gray-50 disabled:opacity-50"
          >
            Load
          </button>
          {pasteError && (
            <p className="text-red-600 text-xs">{pasteError}</p>
          )}
        </div>
      </details>
    </div>
  );
}
