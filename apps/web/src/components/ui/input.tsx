import type { ComponentProps } from 'react';

import { cn } from '@/lib/utils';

function Input({ className, type, ...props }: ComponentProps<'input'>) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        'h-12 w-full min-w-0 rounded-[var(--radius-lg)] border border-input bg-surface px-4 text-base text-foreground shadow-xs outline-none transition-[border-color,box-shadow,background-color] placeholder:text-muted-foreground/75 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/25 disabled:pointer-events-none disabled:opacity-50 md:text-sm',
        className,
      )}
      {...props}
    />
  );
}

export { Input };
