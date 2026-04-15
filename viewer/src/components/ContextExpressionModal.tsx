import { useEffect, useState } from "react";
import { Modal } from "./Modal";

interface ContextExpressionModalProps {
  open: boolean;
  onClose: () => void;
  expression: string;
  onSave: (newExpression: string) => void;
}

export function ContextExpressionModal({
  open,
  onClose,
  expression,
  onSave,
}: ContextExpressionModalProps) {
  const [value, setValue] = useState(expression);

  // Sync local state when the modal opens with a (possibly different) expression
  useEffect(() => {
    if (open) setValue(expression);
  }, [open, expression]);

  const handleSave = () => {
    onSave(value);
    onClose();
  };

  return (
    <Modal title="Edit Context Expression" onClose={onClose} open={open}>
      <div className="p-4">
        <label className="block text-xs font-medium text-gray-500 mb-1">
          FHIRPath Expression
        </label>
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="w-full font-mono text-sm p-2 border border-gray-200 rounded bg-gray-50 min-h-[80px] resize-y outline-none focus:border-gray-400"
          spellCheck={false}
        />
      </div>
      <div className="flex justify-end gap-2 px-4 py-3 border-t border-gray-200 shrink-0">
        <button
          onClick={onClose}
          className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          className="px-3 py-1.5 text-sm bg-gray-900 text-white rounded hover:bg-gray-700"
        >
          Save
        </button>
      </div>
    </Modal>
  );
}
