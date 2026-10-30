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
      <label htmlFor={id} className="text-sm font-bold text-night">
        {label}
      </label>
      <select
        id={id}
        aria-invalid={error ? true : undefined}
        className={`min-h-13 rounded-2xl border-2 bg-[#f4f8ff] px-3 text-base shadow-[inset_0_1px_2px_rgb(21_70_184/0.06)] outline-none focus:border-royal focus:bg-white focus:ring-4 focus:ring-royal/10 ${error ? "border-alert-ring" : "border-[#c9daf6]"}`}
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
      <label htmlFor={id} className="text-sm font-bold text-night">
        {label}
      </label>
      <textarea
        id={id}
        rows={3}
        aria-invalid={error ? true : undefined}
        className={`rounded-2xl border-2 bg-[#f4f8ff] p-3 text-base shadow-[inset_0_1px_2px_rgb(21_70_184/0.06)] outline-none placeholder:text-muted/60 focus:border-royal focus:bg-white focus:ring-4 focus:ring-royal/10 ${error ? "border-alert-ring" : "border-[#c9daf6]"}`}
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
