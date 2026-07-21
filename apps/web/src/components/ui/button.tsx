import { Button as ButtonPrimitive } from '@base-ui/react/button';
import { cva, type VariantProps } from 'class-variance-authority';
import type { ComponentProps } from 'react';

import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-semibold transition-[background-color,color,box-shadow,transform] outline-none select-none disabled:pointer-events-none disabled:opacity-45 focus-visible:ring-3 focus-visible:ring-ring/35 focus-visible:border-ring [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*=size-])]:size-4 active:translate-y-px',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground shadow-xs hover:bg-primary/90',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/78',
        outline: 'border border-border bg-surface text-foreground shadow-xs hover:bg-secondary/55',
        ghost: 'text-foreground hover:bg-secondary/55',
        destructive:
          'bg-destructive text-white shadow-xs hover:bg-destructive/90 focus-visible:ring-destructive/25',
        tonal: 'bg-primary-container text-on-primary-container hover:bg-primary-container/82',
      },
      size: {
        default: 'h-10 px-5 py-2',
        sm: 'h-8 gap-1.5 px-3.5 text-xs',
        lg: 'h-12 px-6 text-base',
        icon: 'size-10 p-0',
        'icon-sm': 'size-8 p-0',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

type ButtonProps = Omit<ComponentProps<typeof ButtonPrimitive>, 'className'> &
  VariantProps<typeof buttonVariants> & { readonly className?: string };

function Button({ className, variant, size, ...props }: ButtonProps) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
}

export { Button, buttonVariants };
export type { ButtonProps };
