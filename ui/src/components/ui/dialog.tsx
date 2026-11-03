import * as DialogPrimitive from '@radix-ui/react-dialog'
import type { JSX, ReactNode } from 'react'

import { cn } from '@/lib/utils'

export const Dialog = DialogPrimitive.Root
export const DialogTrigger = DialogPrimitive.Trigger
export const DialogClose = DialogPrimitive.Close

interface DialogContentProps {
  children: ReactNode
  className?: string
  labelledBy?: string
}

export function DialogContent({ children, className, labelledBy }: DialogContentProps): JSX.Element {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-black/35" />
      <DialogPrimitive.Content
        aria-labelledby={labelledBy}
        className={cn(
          'fixed left-1/2 top-1/3 z-50 w-[440px] -translate-x-1/2 -translate-y-1/2 rounded-lg border border-line bg-panel p-4 shadow-xl',
          className,
        )}
      >
        {children}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  )
}

export function DialogTitle({ children, id }: { children: ReactNode; id?: string }): JSX.Element {
  return (
    <DialogPrimitive.Title id={id} className="mb-2 text-[13px] font-semibold">
      {children}
    </DialogPrimitive.Title>
  )
}

export function DialogDescription({ children }: { children: ReactNode }): JSX.Element {
  return <DialogPrimitive.Description className="text-[12px] text-ink-muted">{children}</DialogPrimitive.Description>
}
