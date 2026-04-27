import { useId } from "react";

export function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  const id = useId();

  return (
    <div>
      <label htmlFor={id} className="form-label">{label}</label>
      <textarea
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={2}
        className="form-input form-textarea"
      />
    </div>
  );
}
