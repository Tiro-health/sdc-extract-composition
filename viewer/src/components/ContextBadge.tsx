interface ContextBadgeProps {
  expression: string;
}

export function ContextBadge({ expression }: ContextBadgeProps) {
  return (
    <span className="inline-flex items-center gap-1 bg-blue-50 border border-blue-200 text-blue-800 font-mono text-xs rounded px-2 py-0.5">
      <svg
        className="w-3 h-3"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14"
        />
      </svg>
      {expression}
    </span>
  );
}
