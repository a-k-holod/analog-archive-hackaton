import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";

type ButtonVariant = "primary" | "secondary";

const classes: Record<ButtonVariant, string> = {
  primary:
    "inline-flex items-center justify-center bg-cobalt px-4 py-2 text-sm text-white transition-[transform,background-color] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] hover:bg-[#234262] active:scale-[0.97] disabled:cursor-not-allowed disabled:bg-[#9aa7b6] disabled:active:scale-100",
  secondary:
    "inline-flex items-center justify-center border border-ink bg-transparent px-4 py-2 text-sm text-ink transition-[transform,background-color] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] hover:bg-ink hover:text-paper active:scale-[0.97] disabled:cursor-not-allowed disabled:border-line disabled:text-muted disabled:hover:bg-transparent disabled:hover:text-muted disabled:active:scale-100",
};

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
};

export function Button({ variant = "primary", className = "", ...props }: ButtonProps) {
  return <button className={`${classes[variant]} ${className}`} {...props} />;
}

export function ButtonLink({
  href,
  variant = "primary",
  children,
  className = "",
}: {
  href: string;
  variant?: ButtonVariant;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Link href={href} className={`${classes[variant]} ${className}`}>
      {children}
    </Link>
  );
}
