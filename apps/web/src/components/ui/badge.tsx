import { cva, type VariantProps } from 'class-variance-authority';
import type { ComponentProps } from 'react';

import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex w-fit shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold leading-none',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-primary-container text-on-primary-container',
        secondary: 'border-transparent bg-secondary text-secondary-foreground',
        outline: 'border-border bg-transparent text-foreground',
        source: 'border-tertiary/20 bg-tertiary-container text-on-tertiary-container',
      },
    },
    defaultVariants: { variant: 'default' },
  },
);

type BadgeProps = ComponentProps<'span'> & VariantProps<typeof badgeVariants>;

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <span data-slot="badge" className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
