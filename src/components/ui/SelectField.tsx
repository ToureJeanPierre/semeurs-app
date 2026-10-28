import { useId, type SelectHTMLAttributes } from "react";

/** Liste déroulante avec libellé, au style des champs de saisie. */
export function SelectField({
  label,
  options,
  error,
  className = "",
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & {
  label: string;
  options: { value: string; label: string }[];
  error?: string;
}) {
  const id = useId();
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label htmlFor={id} className="text-sm font-semibold text-ink">
        {label}
      </label>
      <select
        id={id}
        aria-invalid={error ? true : undefined}
        className={`min-h-13 rounded-2xl border-2 bg-surface px-3 text-base focus:border-ink/40 ${error ? "border-alert-ring" : "border-line"}`}
        {...props}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {error && (
        <p role="alert" className="text-sm font-medium text-alert-text">
          {error}
        </p>
      )}
    </div>
  );
}

/** Zone de texte avec libellé. */
export function TextAreaField({
  label,
  error,
  className = "",
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string; error?: string }) {
  const id = useId();
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label htmlFor={id} className="text-sm font-semibold text-ink">
        {label}
      </label>
      <textarea
        id={id}
        rows={3}
        aria-invalid={error ? true : undefined}
        className={`rounded-2xl border-2 bg-surface p-3 text-base focus:border-ink/40 ${error ? "border-alert-ring" : "border-line"}`}
        {...props}
      />
      {error && (
        <p role="alert" className="text-sm font-medium text-alert-text">
          {error}
        </p>
      )}
    </div>
  );
}
