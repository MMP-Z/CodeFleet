import type { ButtonHTMLAttributes, ReactNode } from 'react';

export type ButtonVariant = 'default' | 'primary' | 'danger' | 'ghost';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  readonly variant?: ButtonVariant;
  readonly size?: ButtonSize;
  readonly children: ReactNode;
}

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  default: 'bg-surface border-border text-text hover:bg-surface-2',
  primary: 'bg-primary border-primary text-surface hover:brightness-95',
  danger: 'bg-surface border-danger/35 text-danger-ink hover:bg-danger-bg',
  ghost: 'bg-transparent border-transparent text-primary hover:bg-primary-soft/50',
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: 'min-h-[32px] px-3 py-1 text-[13px] font-medium',
  md: 'min-h-[38px] px-4 py-[7px] text-[13px] font-semibold',
  lg: 'min-h-[44px] px-5 py-2.5 text-base font-semibold',
};

export function Button({
  variant = 'default',
  size = 'md',
  type = 'button',
  className = '',
  children,
  ...rest
}: ButtonProps): React.JSX.Element {
  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center gap-1.5 border rounded-btn transition-colors no-underline ${VARIANT_CLASSES[variant]} ${SIZE_CLASSES[size]} ${className}`.trim()}
      {...rest}
    >
      {children}
    </button>
  );
}

