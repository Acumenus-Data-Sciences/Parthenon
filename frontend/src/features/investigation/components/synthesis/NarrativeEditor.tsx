import { useEffect, useRef, useState } from "react";

interface NarrativeEditorProps {
  value: string | null;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function NarrativeEditor({
  value,
  onChange,
  placeholder = "Click to add narrative...",
}: NarrativeEditorProps) {
  const [editing, setEditing] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (editing && textareaRef.current) {
      textareaRef.current.focus();
      // Auto-size on mount
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [editing]);

  function handleInput() {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
    onChange(el.value);
  }

  function handleBlur() {
    if (!textareaRef.current?.value.trim()) {
      setEditing(false);
    }
  }

  if (!editing && !value) {
    return (
      <div
        role="button"
        tabIndex={0}
        onClick={() => setEditing(true)}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setEditing(true); }}
        className="w-full rounded-md border border-dashed border-border-default px-3 py-2 text-xs text-text-ghost cursor-text hover:border-border-hover hover:text-text-muted transition-colors"
      >
        {placeholder}
      </div>
    );
  }

  return (
    <textarea
      ref={textareaRef}
      defaultValue={value ?? ""}
      onInput={handleInput}
      onBlur={handleBlur}
      rows={2}
      className="w-full rounded-md border border-border-default bg-surface-base px-3 py-2 text-xs text-text-secondary placeholder:text-text-ghost focus:outline-none focus:border-border-hover resize-none overflow-hidden transition-colors"
      placeholder={placeholder}
    />
  );
}
