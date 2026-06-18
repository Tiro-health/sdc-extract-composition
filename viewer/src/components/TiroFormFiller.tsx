import { useEffect, useMemo, useRef } from "react";
import type { Questionnaire } from "../types";

type FormFillerElement = HTMLElement & {
  setResponse?: (response: Record<string, unknown>) => void;
};

interface TiroFormFillerProps {
  questionnaire: Questionnaire;
  onResponse: (qr: Record<string, unknown>) => void;
  initialResponse: Record<string, unknown> | null;
}

export function TiroFormFiller({
  questionnaire,
  onResponse,
  initialResponse,
}: TiroFormFillerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const onResponseRef = useRef(onResponse);
  onResponseRef.current = onResponse;

  // Read on (re)mount only; updates via tiro-update flow back through onResponse
  // so we don't want this prop to retrigger the effect.
  const initialResponseRef = useRef(initialResponse);
  initialResponseRef.current = initialResponse;

  // Content-stable signature: a parent re-render that produces a new
  // questionnaire reference with identical content must not destroy the
  // web component (which would wipe the user's filled-in answers).
  const questionnaireJson = useMemo(
    () => JSON.stringify(questionnaire),
    [questionnaire],
  );

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.innerHTML = "";

    const filler = document.createElement(
      "tiro-form-filler",
    ) as FormFillerElement;

    const script = document.createElement("script");
    script.type = "application/fhir+json";
    script.slot = "questionnaire";
    script.textContent = questionnaireJson;
    filler.appendChild(script);

    // Clone-and-replace pattern to force web component re-render
    container.appendChild(filler);
    const cloned = filler.cloneNode(false) as FormFillerElement;
    cloned.appendChild(script.cloneNode(true));
    container.replaceChild(cloned, filler);

    const handleUpdate = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.response) {
        onResponseRef.current(detail.response);
      }
    };
    cloned.addEventListener("tiro-update", handleUpdate);

    // Restore the last captured response so an unintended remount (e.g. on
    // window refocus) doesn't drop the filled-in answers.
    const captured = initialResponseRef.current;
    if (captured) {
      customElements.whenDefined("tiro-form-filler").then(() => {
        cloned.setResponse?.(captured);
      });
    }

    return () => {
      cloned.removeEventListener("tiro-update", handleUpdate);
      container.innerHTML = "";
    };
  }, [questionnaireJson]);

  return <div ref={containerRef} className="tiro-form-filler-container" />;
}
