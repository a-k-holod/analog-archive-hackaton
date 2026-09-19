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
      <span className="meta mb-1.5 block">{label}</span>
      {children}
    </label>
  );
}

export const inputClassName =
  "w-full border-0 border-b border-line bg-transparent px-0 py-2 text-[0.95rem] text-ink outline-none transition-[border-color] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] placeholder:text-muted/60 focus:border-cobalt";

export const textareaClassName =
  "w-full min-h-28 resize-y border border-line bg-surface/60 px-3 py-2.5 text-[0.95rem] leading-relaxed text-ink outline-none transition-[border-color] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] placeholder:text-muted/60 focus:border-cobalt";
