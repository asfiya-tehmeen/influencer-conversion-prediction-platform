"use client";

import { useFormStatus } from "react-dom";
import type { ReactNode } from "react";
import { buttonCls, Field, inputCls } from "./ui";

export interface FormState {
  errors?: Record<string, string>;
  /** Submitted values, echoed back so inputs keep what the user typed after a validation error. */
  values?: Record<string, unknown>;
  message?: string;
}

export function SubmitButton({ children, pendingText = "Saving…", variant = "primary" }: { children: ReactNode; pendingText?: string; variant?: "primary" | "secondary" }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={buttonCls(variant)}>
      {pending && <span className="size-3.5 animate-spin rounded-full border-2 border-current border-r-transparent" aria-hidden />}
      {pending ? pendingText : children}
    </button>
  );
}

export function FormError({ state }: { state: FormState }) {
  const count = Object.keys(state.errors ?? {}).filter((k) => k !== "_form").length;
  if (!state.errors?._form && count === 0) return null;
  return (
    <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
      {state.errors?._form ?? `Please fix ${count} field${count === 1 ? "" : "s"} below.`}
    </div>
  );
}

/** Text/number input wired to FormState: shows the field error and keeps the submitted value. */
export function Input({
  state,
  name,
  label,
  defaultValue,
  hint,
  className,
  ...rest
}: {
  state: FormState;
  name: string;
  label: string;
  defaultValue?: string | number | null;
  hint?: ReactNode;
  className?: string;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "defaultValue" | "name">) {
  const submitted = state.values?.[name];
  const value = submitted !== undefined && submitted !== null ? String(submitted) : (defaultValue ?? "");
  const error = state.errors?.[name];
  return (
    <Field label={label} name={name} error={error} hint={hint} className={className}>
      <input id={name} name={name} defaultValue={value} aria-invalid={!!error} className={`${inputCls} ${error ? "border-rose-400" : ""}`} {...rest} />
    </Field>
  );
}

export function Select({
  state,
  name,
  label,
  defaultValue,
  options,
  hint,
  className,
}: {
  state: FormState;
  name: string;
  label: string;
  defaultValue?: string | null;
  options: { value: string; label: string }[];
  hint?: ReactNode;
  className?: string;
}) {
  const submitted = state.values?.[name];
  const value = typeof submitted === "string" ? submitted : (defaultValue ?? "");
  const error = state.errors?.[name];
  return (
    <Field label={label} name={name} error={error} hint={hint} className={className}>
      <select id={name} name={name} defaultValue={value} key={value} className={inputCls}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </Field>
  );
}
