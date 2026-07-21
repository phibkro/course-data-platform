import { useState } from 'react';

import { ExternalLinkIcon, ThemeIcon } from '@/components/icons/app-icons';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import {
  baseColors,
  chartColors,
  colorModes,
  parseThemePreference,
  serializeThemePreference,
  themeColors,
} from '@/theme/theme-preference';
import { useThemePreference } from '@/theme/theme-provider';

const titleCase = (value: string): string => `${value[0]?.toUpperCase() ?? ''}${value.slice(1)}`;

function ThemeSelect<Value extends string>({
  id,
  label,
  value,
  values,
  onChange,
}: {
  readonly id: string;
  readonly label: string;
  readonly value: Value;
  readonly values: readonly Value[];
  readonly onChange: (value: Value) => void;
}) {
  return (
    <label className="grid gap-2 text-sm font-semibold" htmlFor={id}>
      {label}
      <select
        id={id}
        className="h-11 rounded-[var(--radius-md)] border border-input bg-surface px-3 text-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/30"
        value={value}
        onChange={(event) => onChange(event.target.value as Value)}
      >
        {values.map((option) => (
          <option key={option} value={option}>
            {titleCase(option)}
          </option>
        ))}
      </select>
    </label>
  );
}

function ThemePreview() {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="bg-primary-container/55">
        <div className="flex items-center justify-between gap-3">
          <Badge>Study plan</Badge>
          <Badge variant="outline">30 credits</Badge>
        </div>
        <CardTitle className="mt-3">Spring semester</CardTitle>
        <CardDescription>
          Preview how surfaces, accents, and chart colours work together.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 pt-5">
        <div className="grid grid-cols-5 items-end gap-2" aria-label="Chart colour preview">
          {[1, 2, 3, 4, 5].map((index) => (
            <span
              key={index}
              className="min-h-5 rounded-t-md"
              style={{
                height: `${24 + index * 9}px`,
                background: `var(--chart-${index})`,
              }}
            />
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm">Primary action</Button>
          <Button size="sm" variant="tonal">
            Add course
          </Button>
          <Button size="sm" variant="outline">
            Details
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function ThemeLab({ compact = false }: { readonly compact?: boolean }) {
  const { preference, updatePreference, resetPreference, setPreference } = useThemePreference();
  const [message, setMessage] = useState<string | null>(null);

  const copySettings = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(serializeThemePreference(preference));
      setMessage('Theme settings copied as JSON.');
    } catch {
      setMessage('Clipboard access failed. Use Import settings to inspect the JSON format.');
    }
  };

  const importSettings = (): void => {
    const value = window.prompt('Paste exported theme JSON');
    if (!value) return;
    setPreference(parseThemePreference(value));
    setMessage('Theme settings imported.');
  };

  return (
    <Sheet>
      <SheetTrigger
        render={
          compact ? (
            <Button variant="ghost" size="icon" aria-label="Open appearance settings" />
          ) : (
            <Button variant="ghost" size="sm" className="w-full justify-start" />
          )
        }
      >
        <ThemeIcon />
        {!compact && 'Appearance'}
      </SheetTrigger>
      <SheetContent side="right" className="w-[min(96vw,460px)]">
        <SheetHeader>
          <SheetTitle>Theme lab</SheetTitle>
          <SheetDescription>
            Tune the study planner without changing component code. Mist, Emerald, and Indigo are
            the product default.
          </SheetDescription>
        </SheetHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <ThemeSelect
            id="theme-base-color"
            label="Base colour"
            value={preference.baseColor}
            values={baseColors}
            onChange={(baseColor) => updatePreference({ baseColor })}
          />
          <ThemeSelect
            id="theme-accent-color"
            label="Theme"
            value={preference.themeColor}
            values={themeColors}
            onChange={(themeColor) => updatePreference({ themeColor })}
          />
          <ThemeSelect
            id="theme-chart-color"
            label="Chart colour"
            value={preference.chartColor}
            values={chartColors}
            onChange={(chartColor) => updatePreference({ chartColor })}
          />
          <ThemeSelect
            id="theme-mode"
            label="Appearance"
            value={preference.mode}
            values={colorModes}
            onChange={(mode) => updatePreference({ mode })}
          />
        </div>

        <ThemePreview />

        <div className="grid gap-2 sm:grid-cols-2">
          <Button variant="outline" onClick={() => void copySettings()}>
            Copy settings
          </Button>
          <Button variant="outline" onClick={importSettings}>
            Import settings
          </Button>
          <Button variant="ghost" className="sm:col-span-2" onClick={resetPreference}>
            Reset to Mist · Emerald · Indigo
          </Button>
        </div>

        {message && (
          <p className="rounded-[var(--radius-md)] bg-secondary px-3 py-2 text-sm text-secondary-foreground">
            {message}
          </p>
        )}

        <div className="rounded-[var(--radius-lg)] border border-border bg-surface-container-low p-4 text-sm leading-6 text-muted-foreground">
          <p className="font-bold text-foreground">Developer preset workflow</p>
          <p className="mt-1">
            Resolve the checked-in shadcn preset, open another preset, or selectively apply only its
            theme. Review the resulting diff before committing.
          </p>
          <code className="mt-3 block rounded-md bg-surface-container-high px-3 py-2 text-xs text-foreground">
            bun run theme:resolve
          </code>
          <a
            className="mt-3 inline-flex items-center gap-2 font-semibold text-primary underline-offset-4 hover:underline"
            href="https://ui.shadcn.com/create"
            target="_blank"
            rel="noreferrer"
          >
            <ExternalLinkIcon />
            Open shadcn/create
          </a>
        </div>
      </SheetContent>
    </Sheet>
  );
}
