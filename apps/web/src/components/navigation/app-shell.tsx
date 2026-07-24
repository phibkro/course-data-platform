import type { ReactNode } from 'react';

import {
  DataStatusIcon,
  CompareIcon,
  ExploreIcon,
  ExternalLinkIcon,
  MoreIcon,
  PlanIcon,
  SavedIcon,
  WorkbenchIcon,
} from '@/components/icons/app-icons';
import { Button, buttonVariants } from '@/components/ui/button';
import { ThemeLab } from '@/components/theme/theme-lab';
import { Separator } from '@/components/ui/separator';
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { cn } from '@/lib/utils';

export type AppView = 'explore' | 'compare' | 'plan' | 'saved' | 'workbench' | 'status';

type NavigationItem = {
  readonly value: AppView;
  readonly label: string;
  readonly icon: typeof ExploreIcon;
};

const primaryItems: ReadonlyArray<NavigationItem> = [
  { value: 'explore', label: 'Explore', icon: ExploreIcon },
  { value: 'plan', label: 'Plan', icon: PlanIcon },
  { value: 'saved', label: 'Saved', icon: SavedIcon },
];

const advancedItems: ReadonlyArray<NavigationItem> = [
  { value: 'compare', label: 'Compare', icon: CompareIcon },
  { value: 'workbench', label: 'Workbench', icon: WorkbenchIcon },
  { value: 'status', label: 'Data status', icon: DataStatusIcon },
];

function NavigationButton({
  item,
  active,
  onSelect,
  compact = false,
}: {
  readonly item: NavigationItem;
  readonly active: boolean;
  readonly onSelect: (view: AppView) => void;
  readonly compact?: boolean;
}) {
  const Icon = item.icon;
  return (
    <button
      type="button"
      className={cn(
        'group flex w-full items-center gap-3 rounded-full px-4 py-3 text-start text-sm font-semibold text-muted-foreground outline-none transition-colors hover:bg-secondary/60 hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/30',
        active && 'bg-primary-container text-on-primary-container',
        compact && 'flex-col gap-1 rounded-[var(--radius-lg)] px-2 py-2 text-[0.7rem]',
      )}
      aria-current={active ? 'page' : undefined}
      onClick={() => onSelect(item.value)}
    >
      <Icon active={active} className={compact ? 'size-6' : 'size-5'} />
      <span>{item.label}</span>
    </button>
  );
}

function BrandMark() {
  return (
    <div className="flex items-center gap-3 px-2">
      <div className="grid size-10 place-items-center rounded-[var(--radius-lg)] bg-primary text-primary-foreground shadow-[var(--elevation-1)]">
        <PlanIcon active className="size-6" />
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm font-extrabold tracking-[-0.02em]">Course Data</p>
        <p className="truncate text-xs text-muted-foreground">Explore and plan studies</p>
      </div>
    </div>
  );
}

function DesktopSidebar({ view, onViewChange, apiUrl }: AppShellProps) {
  return (
    <aside className="fixed inset-y-0 start-0 z-30 hidden w-64 border-e border-sidebar-border bg-sidebar text-sidebar-foreground px-4 py-5 lg:flex lg:flex-col">
      <BrandMark />
      <nav className="mt-8 grid gap-1" aria-label="Primary navigation">
        {primaryItems.map((item) => (
          <NavigationButton
            key={item.value}
            item={item}
            active={view === item.value}
            onSelect={onViewChange}
          />
        ))}
      </nav>
      <div className="mt-auto">
        <Separator className="mb-4 h-px" />
        <nav className="grid gap-1" aria-label="Advanced navigation">
          {advancedItems.map((item) => (
            <NavigationButton
              key={item.value}
              item={item}
              active={view === item.value}
              onSelect={onViewChange}
            />
          ))}
        </nav>
        <ThemeLab />
        <a
          className={cn(
            buttonVariants({ variant: 'ghost', size: 'sm' }),
            'mt-2 w-full justify-start',
          )}
          href={`${apiUrl}/openapi`}
          target="_blank"
          rel="noreferrer"
        >
          <ExternalLinkIcon />
          API documentation
        </a>
      </div>
    </aside>
  );
}

function MobileMoreSheet({ view, onViewChange, apiUrl }: AppShellProps) {
  return (
    <Sheet>
      <SheetTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            aria-label="Open advanced navigation"
            className="lg:hidden"
          />
        }
      >
        <MoreIcon className="size-6" />
      </SheetTrigger>
      <SheetContent side="bottom">
        <SheetHeader>
          <SheetTitle>More tools</SheetTitle>
          <SheetDescription>
            Inspect the planning kernel, provenance, and API when you need the full data surface.
          </SheetDescription>
        </SheetHeader>
        <nav className="grid gap-2" aria-label="Advanced navigation">
          {advancedItems.map((item) => {
            const Icon = item.icon;
            return (
              <SheetClose
                key={item.value}
                render={
                  <button
                    type="button"
                    className={cn(
                      'flex w-full items-center gap-3 rounded-[var(--radius-lg)] border border-border bg-surface px-4 py-4 text-start font-semibold outline-none hover:bg-secondary/55 focus-visible:ring-3 focus-visible:ring-ring/30',
                      view === item.value && 'bg-primary-container text-on-primary-container',
                    )}
                    onClick={() => onViewChange(item.value)}
                  />
                }
              >
                <Icon active={view === item.value} />
                {item.label}
              </SheetClose>
            );
          })}
        </nav>
        <a
          className={cn(buttonVariants({ variant: 'outline' }), 'w-full')}
          href={`${apiUrl}/openapi`}
          target="_blank"
          rel="noreferrer"
        >
          <ExternalLinkIcon />
          Open API documentation
        </a>
      </SheetContent>
    </Sheet>
  );
}

export type AppShellProps = {
  readonly view: AppView;
  readonly onViewChange: (view: AppView) => void;
  readonly apiUrl: string;
};

export function AppShell({
  view,
  onViewChange,
  apiUrl,
  children,
}: AppShellProps & { readonly children: ReactNode }) {
  return (
    <div className="min-h-svh bg-background text-foreground">
      <DesktopSidebar view={view} onViewChange={onViewChange} apiUrl={apiUrl} />
      <div className="lg:ps-64">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-border/75 bg-background/88 px-4 backdrop-blur-xl lg:px-8">
          <div className="lg:hidden">
            <BrandMark />
          </div>
          <div className="hidden lg:block">
            <p className="text-sm font-semibold text-muted-foreground">
              {view === 'explore' && 'Browse courses, programmes, and institutions'}
              {view === 'plan' && 'Build a personal programme roadmap'}
              {view === 'compare' && 'Compare published programme curricula'}
              {view === 'saved' && 'Return to saved study options'}
              {view === 'workbench' && 'Inspect the full planning kernel'}
              {view === 'status' && 'Review source freshness and provenance'}
            </p>
          </div>
          <div className="flex items-center gap-1 lg:hidden">
            <ThemeLab compact />
            <MobileMoreSheet view={view} onViewChange={onViewChange} apiUrl={apiUrl} />
          </div>
        </header>
        <main className="mx-auto w-full max-w-[1180px] px-4 pb-28 pt-6 sm:px-6 lg:px-8 lg:pb-12 lg:pt-9">
          {children}
        </main>
      </div>
      <nav
        className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-3 border-t border-border bg-surface-container/94 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur-xl lg:hidden"
        aria-label="Primary navigation"
      >
        {primaryItems.map((item) => (
          <NavigationButton
            key={item.value}
            item={item}
            active={view === item.value}
            onSelect={onViewChange}
            compact
          />
        ))}
      </nav>
    </div>
  );
}
