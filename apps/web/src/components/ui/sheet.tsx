import { Dialog as DialogPrimitive } from '@base-ui/react/dialog';
import type { ComponentProps } from 'react';

import { XIcon } from '@/components/icons/app-icons';
import { cn } from '@/lib/utils';

const Sheet = DialogPrimitive.Root;
const SheetTrigger = DialogPrimitive.Trigger;
const SheetClose = DialogPrimitive.Close;

function SheetContent({
  className,
  children,
  side = 'right',
  showCloseButton = true,
  ...props
}: Omit<ComponentProps<typeof DialogPrimitive.Popup>, 'className'> & {
  readonly className?: string;
  readonly side?: 'top' | 'right' | 'bottom' | 'left';
  readonly showCloseButton?: boolean;
}) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-scrim/45 backdrop-blur-[2px] transition-opacity data-[ending-style]:opacity-0 data-[starting-style]:opacity-0" />
      <DialogPrimitive.Viewport className="fixed inset-0 z-50 flex overflow-hidden">
        <DialogPrimitive.Popup
          data-slot="sheet-content"
          data-side={side}
          className={cn(
            'relative flex h-full w-[min(92vw,390px)] flex-col gap-5 overflow-y-auto border-border bg-surface-container-high p-5 text-foreground shadow-[var(--elevation-4)] outline-none transition-transform duration-300',
            side === 'right' &&
              'ms-auto border-s data-[ending-style]:translate-x-full data-[starting-style]:translate-x-full',
            side === 'left' &&
              'me-auto border-e data-[ending-style]:-translate-x-full data-[starting-style]:-translate-x-full',
            side === 'bottom' &&
              'mt-auto h-auto max-h-[88svh] w-full translate-y-0 rounded-t-[var(--radius-2xl)] border-t data-[ending-style]:translate-y-full data-[starting-style]:translate-y-full',
            side === 'top' &&
              'mb-auto h-auto max-h-[88svh] w-full -translate-y-0 rounded-b-[var(--radius-2xl)] border-b data-[ending-style]:-translate-y-full data-[starting-style]:-translate-y-full',
            className,
          )}
          {...props}
        >
          {children}
          {showCloseButton && (
            <DialogPrimitive.Close
              className="absolute end-4 top-4 inline-flex size-9 items-center justify-center rounded-full text-muted-foreground outline-none hover:bg-secondary focus-visible:ring-3 focus-visible:ring-ring/30"
              aria-label="Close"
            >
              <XIcon />
            </DialogPrimitive.Close>
          )}
        </DialogPrimitive.Popup>
      </DialogPrimitive.Viewport>
    </DialogPrimitive.Portal>
  );
}

function SheetHeader({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('grid gap-2 pe-10', className)} {...props} />;
}

function SheetTitle({
  className,
  ...props
}: Omit<ComponentProps<typeof DialogPrimitive.Title>, 'className'> & {
  readonly className?: string;
}) {
  return (
    <DialogPrimitive.Title
      className={cn('text-xl font-bold tracking-tight', className)}
      {...props}
    />
  );
}

function SheetDescription({
  className,
  ...props
}: Omit<ComponentProps<typeof DialogPrimitive.Description>, 'className'> & {
  readonly className?: string;
}) {
  return (
    <DialogPrimitive.Description
      className={cn('text-sm leading-6 text-muted-foreground', className)}
      {...props}
    />
  );
}

export { Sheet, SheetClose, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger };
