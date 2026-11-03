import type { ButtonHTMLAttributes, JSX, ReactNode } from 'react'

import { cn } from '@/lib/utils'

type Variant = 'primary' | 'quiet' | 'ghost' | 'danger'
type Size = 'sm' | 'md'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  children: ReactNode
}

const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-accent text-white shadow-[0_1px_0_rgb(255_255_255/0.12)_inset] hover:brightness-110 active:brightness-95',
  quiet: 'border border-line bg-panel text-ink hover:border-line-strong hover:bg-panel-muted',
  ghost: 'text-ink-muted hover:bg-panel-muted hover:text-ink',
  danger: 'border border-danger/40 bg-danger/10 text-danger hover:bg-danger/15',
}

const SIZES: Record<Size, string> = {
  sm: 'h-6 px-2 text-[11.5px] gap-1',
  md: 'h-7 px-2.5 text-[12.5px] gap-1.5',
}

export function Button({
  variant = 'quiet',
  size = 'md',
  className,
  children,
  ...rest
}: ButtonProps): JSX.Element {
  return (
    <button
      type="button"
      {...rest}
      className={cn(
        'inline-flex items-center justify-center rounded-md font-medium transition-[background-color,border-color,color,filter] duration-[var(--dur-fast)]',
        'disabled:cursor-not-allowed disabled:opacity-50',
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
    >
      {children}
    </button>
  )
}
