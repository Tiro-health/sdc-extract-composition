interface FhirPathPillProps {
  expression: string;
}

export function FhirPathPill({ expression }: FhirPathPillProps) {
  return (
    <code
      className="inline bg-rose-50 border border-rose-200 text-rose-900 font-mono text-[0.625rem] leading-[0.875rem] rounded-sm px-1 py-px"
      title={expression}
    >
      {expression}
    </code>
  );
}
