import type { ReactNode } from "react";

export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm text-muted">{label}</span>
      {children}
    </label>
  );
}

export const inputClassName =
  "w-full border border-line bg-surface px-3 py-2 text-[0.95rem] text-ink outline-none transition-[border-color,box-shadow] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] focus:border-cobalt focus:shadow-[0_0_0_3px_rgba(42,77,115,0.15)]";
