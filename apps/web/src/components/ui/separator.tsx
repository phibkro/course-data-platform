import type { ComponentProps } from 'react';

import { cn } from '@/lib/utils';

function Separator({ className, ...props }: ComponentProps<'hr'>) {
  return <hr data-slot="separator" className={cn('border-0 bg-border', className)} {...props} />;
}

export { Separator };
