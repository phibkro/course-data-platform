import type {
  CompareProgrammesResponseDtoType,
  DataStatusResponseDtoType,
  ListCoursesResponseDtoType,
  ListProgrammesResponseDtoType,
} from '@course-data/contracts';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { StrictMode, Suspense, lazy, useEffect, useMemo, useState, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';

import { api } from './api';
import {
  CourseIcon,
  InstitutionIcon,
  PlanIcon,
  ProgrammeIcon,
  SavedIcon,
} from '@/components/icons/app-icons';
import { AppShell, type AppView } from '@/components/navigation/app-shell';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { initializeThemePreference, ThemeProvider } from '@/theme/theme-provider';
import '@/styles.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      retry: 1,
    },
  },
});

const apiUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:8787';
const PlannerWorkspace = lazy(() =>
  import('./planner-workspace').then((module) => ({ default: module.PlannerWorkspace })),
);

type EntityFilter = 'all' | 'courses' | 'programmes' | 'institutions';

const errorMessage = (value: unknown): string => {
  if (typeof value !== 'object' || value === null) return 'Request failed';
  if ('detail' in value && typeof value.detail === 'string') return value.detail;
  if ('message' in value && typeof value.message === 'string') return value.message;
  return 'Request failed';
};

const visibleFor = (filter: EntityFilter, entity: Exclude<EntityFilter, 'all'>): boolean =>
  filter === 'all' || filter === entity;

function ExploreView({ onStartPlanning }: { readonly onStartPlanning: () => void }) {
  const initialSearch = new URL(window.location.href).searchParams.get('q') ?? '';
  const initialEntity = new URL(window.location.href).searchParams.get('entity');
  const [search, setSearch] = useState(initialSearch);
  const [entityFilter, setEntityFilter] = useState<EntityFilter>(
    initialEntity === 'courses' ||
      initialEntity === 'programmes' ||
      initialEntity === 'institutions'
      ? initialEntity
      : 'all',
  );

  useEffect(() => {
    const url = new URL(window.location.href);
    if (search) url.searchParams.set('q', search);
    else url.searchParams.delete('q');
    if (entityFilter === 'all') url.searchParams.delete('entity');
    else url.searchParams.set('entity', entityFilter);
    window.history.replaceState(null, '', url);
  }, [entityFilter, search]);

  const courses = useQuery<ListCoursesResponseDtoType>({
    queryKey: ['courses', search],
    queryFn: async () => {
      const result = await api.v1.courses.get({ query: search ? { search } : {} });
      if (result.error) throw new Error(errorMessage(result.error.value));
      return result.data as ListCoursesResponseDtoType;
    },
  });

  const programmes = useQuery<ListProgrammesResponseDtoType>({
    queryKey: ['programmes'],
    queryFn: async () => {
      const result = await api.v1.programmes.get();
      if (result.error) throw new Error(errorMessage(result.error.value));
      return result.data as ListProgrammesResponseDtoType;
    },
  });

  const normalizedSearch = search.trim().toLocaleLowerCase();
  const visibleProgrammes = useMemo(
    () =>
      (programmes.data?.items ?? []).filter((programme) => {
        if (!normalizedSearch) return true;
        return [
          programme.title,
          programme.institutionShortName,
          String(programme.cohortStartYear),
        ].some((value) => value.toLocaleLowerCase().includes(normalizedSearch));
      }),
    [normalizedSearch, programmes.data?.items],
  );

  const institutions = useMemo(() => {
    const names = new Set<string>();
    for (const programme of programmes.data?.items ?? []) names.add(programme.institutionShortName);
    for (const course of courses.data?.items ?? []) names.add(course.institutionShortName);
    return [...names]
      .filter((name) => !normalizedSearch || name.toLocaleLowerCase().includes(normalizedSearch))
      .sort((a, b) => a.localeCompare(b));
  }, [courses.data?.items, normalizedSearch, programmes.data?.items]);

  const totalResults =
    (visibleFor(entityFilter, 'courses') ? (courses.data?.items.length ?? 0) : 0) +
    (visibleFor(entityFilter, 'programmes') ? visibleProgrammes.length : 0) +
    (visibleFor(entityFilter, 'institutions') ? institutions.length : 0);
  const isLoading = courses.isLoading || programmes.isLoading;
  const error = courses.error ?? programmes.error;

  return (
    <div className="grid gap-8">
      <section className="rounded-[var(--radius-2xl)] bg-surface-container-low p-5 shadow-[var(--elevation-1)] sm:p-7">
        <div className="max-w-3xl">
          <Badge variant="secondary">Public study catalogue</Badge>
          <h1 className="mt-4 text-3xl font-extrabold tracking-[-0.045em] text-balance sm:text-5xl">
            Find a course, programme, or institution
          </h1>
          <p className="mt-3 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
            Browse immediately. Choose a programme later to highlight relevant courses and build a
            personal roadmap.
          </p>
        </div>
        <label className="mt-7 grid gap-2" htmlFor="catalogue-search">
          <span className="text-sm font-semibold">Search the catalogue</span>
          <Input
            id="catalogue-search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Try TDT4136, informatics, or NTNU"
            autoComplete="off"
            className="h-14 rounded-full bg-surface ps-5 text-base shadow-[var(--elevation-1)]"
          />
        </label>
        <div className="mt-4 flex flex-wrap gap-2" aria-label="Result type">
          {(
            [
              ['all', 'All'],
              ['courses', 'Courses'],
              ['programmes', 'Programmes'],
              ['institutions', 'Institutions'],
            ] as const
          ).map(([value, label]) => (
            <Button
              key={value}
              size="sm"
              variant={entityFilter === value ? 'tonal' : 'outline'}
              aria-pressed={entityFilter === value}
              onClick={() => setEntityFilter(value)}
            >
              {label}
            </Button>
          ))}
        </div>
      </section>

      <section
        className="rounded-[var(--radius-xl)] border border-primary/10 bg-primary-container/38 p-5 sm:flex sm:items-center sm:justify-between sm:gap-6"
        aria-labelledby="programme-context-heading"
      >
        <div>
          <div className="flex items-center gap-2 text-on-primary-container">
            <PlanIcon className="size-5" />
            <h2 id="programme-context-heading" className="font-bold">
              Considering or enrolled in a programme?
            </h2>
          </div>
          <p className="mt-1 text-sm leading-6 text-on-primary-container/75">
            Add programme context to highlight relevant courses and preview the full study roadmap.
          </p>
        </div>
        <Button className="mt-4 sm:mt-0" variant="tonal" onClick={onStartPlanning}>
          Choose a programme
        </Button>
      </section>

      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">
            Catalogue results
          </p>
          <h2 className="mt-1 text-2xl font-bold tracking-tight">{totalResults} matches</h2>
        </div>
        {(courses.isFetching || programmes.isFetching) && (
          <span className="text-sm text-muted-foreground">Refreshing…</span>
        )}
      </div>

      {isLoading && <p className="state">Loading the catalogue…</p>}
      {error && <p className="state error">{error.message}</p>}
      {!isLoading && !error && totalResults === 0 && (
        <p className="state">Adjust the search or result type to discover other study options.</p>
      )}

      {visibleFor(entityFilter, 'programmes') && visibleProgrammes.length > 0 && (
        <ResultSection title="Programmes" icon={<ProgrammeIcon />}>
          {visibleProgrammes.map((programme) => (
            <Card key={programme.programmeVersionId}>
              <CardHeader>
                <div className="flex items-center justify-between gap-3">
                  <Badge variant="secondary">Programme</Badge>
                  <span className="text-xs font-semibold text-muted-foreground">
                    {programme.durationTerms} terms
                  </span>
                </div>
                <CardTitle className="mt-3">{programme.title}</CardTitle>
                <CardDescription>
                  {programme.institutionShortName} · Cohort {programme.cohortStartYear}
                </CardDescription>
              </CardHeader>
              <CardFooter>
                <Button size="sm" variant="tonal" onClick={onStartPlanning}>
                  Preview roadmap
                </Button>
                <Badge variant="outline">{programme.relationAuthority}</Badge>
              </CardFooter>
            </Card>
          ))}
        </ResultSection>
      )}

      {visibleFor(entityFilter, 'courses') && (courses.data?.items.length ?? 0) > 0 && (
        <ResultSection title="Courses" icon={<CourseIcon />}>
          {courses.data?.items.map((course) => (
            <Card key={course.id}>
              <CardHeader>
                <div className="flex items-center justify-between gap-3">
                  <Badge>{course.code}</Badge>
                  <span className="text-xs font-semibold text-muted-foreground">
                    {course.academicYear}
                  </span>
                </div>
                <CardTitle className="mt-3">{course.title}</CardTitle>
                <CardDescription>{course.institutionShortName}</CardDescription>
              </CardHeader>
              <CardContent>
                <dl className="m-0 grid grid-cols-3 gap-3 text-sm">
                  <div>
                    <dt className="text-xs font-semibold text-muted-foreground">Credits</dt>
                    <dd className="mt-1 font-bold">{course.credits ?? 'Unknown'}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold text-muted-foreground">Level</dt>
                    <dd className="mt-1 font-bold">{course.level}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold text-muted-foreground">Source</dt>
                    <dd className="mt-1 font-bold">{course.source.provider}</dd>
                  </div>
                </dl>
              </CardContent>
            </Card>
          ))}
        </ResultSection>
      )}

      {visibleFor(entityFilter, 'institutions') && institutions.length > 0 && (
        <ResultSection title="Institutions" icon={<InstitutionIcon />}>
          {institutions.map((institution) => (
            <Card key={institution}>
              <CardHeader>
                <Badge variant="source">Institution</Badge>
                <CardTitle className="mt-3">{institution}</CardTitle>
                <CardDescription>
                  Browse the programmes and courses currently available in this bounded dataset.
                </CardDescription>
              </CardHeader>
            </Card>
          ))}
        </ResultSection>
      )}
    </div>
  );
}

function ResultSection({
  title,
  icon,
  children,
}: {
  readonly title: string;
  readonly icon: ReactNode;
  readonly children: ReactNode;
}) {
  return (
    <section aria-labelledby={`result-${title.toLocaleLowerCase()}`}>
      <div className="mb-4 flex items-center gap-2">
        <span className="text-primary">{icon}</span>
        <h2 id={`result-${title.toLocaleLowerCase()}`} className="text-xl font-bold tracking-tight">
          {title}
        </h2>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{children}</div>
    </section>
  );
}

function SavedView({ onExplore }: { readonly onExplore: () => void }) {
  return (
    <section className="mx-auto grid max-w-xl place-items-center rounded-[var(--radius-2xl)] border border-border bg-card px-6 py-16 text-center shadow-[var(--elevation-1)]">
      <div className="grid size-16 place-items-center rounded-full bg-secondary text-secondary-foreground">
        <SavedIcon className="size-8" />
      </div>
      <h1 className="mt-5 text-2xl font-bold tracking-tight">Save options as you explore</h1>
      <p className="mt-2 max-w-md leading-7 text-muted-foreground">
        Bookmarks, comparison lists, and recently viewed items will live here. The first persistence
        slice will keep them local to this device.
      </p>
      <Button className="mt-6" onClick={onExplore}>
        Explore the catalogue
      </Button>
    </section>
  );
}

function StatusView() {
  const status = useQuery<DataStatusResponseDtoType>({
    queryKey: ['data-status'],
    queryFn: async () => {
      const response = await fetch(`${apiUrl}/v1/data-status`);
      const value = await response.json();
      if (!response.ok) throw new Error(errorMessage(value));
      return value as DataStatusResponseDtoType;
    },
    refetchInterval: 60_000,
  });
  return (
    <section className="grid gap-5">
      <div>
        <Badge variant="source">Advanced</Badge>
        <h1 className="mt-3 text-3xl font-bold tracking-tight">Data status</h1>
        <p className="mt-2 max-w-2xl leading-7 text-muted-foreground">
          Live NTNU and DBH replication health, measured from the actual last successful
          publication.
        </p>
      </div>
      {status.isLoading && <p className="state">Loading source status…</p>}
      {status.error && <p className="state error">{status.error.message}</p>}
      {status.data?.sources.map((source) => (
        <Card key={`${source.sourceProvider}:${source.scope}`}>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <CardTitle>{source.sourceProvider}</CardTitle>
              <Badge
                variant={source.stale ? 'outline' : 'secondary'}
                className={source.stale ? 'text-destructive' : undefined}
              >
                {source.stale ? 'Stale' : 'Current'}
              </Badge>
            </div>
            <CardDescription>{source.scope}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2 text-sm sm:grid-cols-2">
            <p>
              <span className="font-semibold">Last successful publish:</span>{' '}
              {source.lastSuccessfulPublishAt ?? 'Never'}
            </p>
            <p>
              <span className="font-semibold">Freshness target:</span>{' '}
              {Math.round(source.targetSeconds / 60)} minutes
            </p>
            {source.lastError && (
              <p className="text-destructive sm:col-span-2">
                Latest attempt failed: {source.lastError}
              </p>
            )}
          </CardContent>
        </Card>
      ))}
    </section>
  );
}

function CompareView() {
  const programmes = useQuery<ListProgrammesResponseDtoType>({
    queryKey: ['programmes'],
    queryFn: async () => {
      const result = await api.v1.programmes.get();
      if (result.error) throw new Error(errorMessage(result.error.value));
      return result.data as ListProgrammesResponseDtoType;
    },
  });
  const items = useMemo(() => programmes.data?.items ?? [], [programmes.data?.items]);
  const [leftId, setLeftId] = useState('');
  const [rightId, setRightId] = useState('');
  useEffect(() => {
    if (!leftId && items[0]) setLeftId(items[0].programmeVersionId);
    if (!rightId && items[1]) setRightId(items[1].programmeVersionId);
  }, [items, leftId, rightId]);
  const comparison = useQuery<CompareProgrammesResponseDtoType>({
    queryKey: ['compare', leftId, rightId],
    enabled:
      programmes.data?.meta.compareEnabled === true &&
      Boolean(leftId && rightId && leftId !== rightId),
    queryFn: async () => {
      const url = new URL(`${apiUrl}/v1/compare`);
      url.searchParams.set('leftProgrammeVersionId', leftId);
      url.searchParams.set('rightProgrammeVersionId', rightId);
      const response = await fetch(url);
      const value = await response.json();
      if (!response.ok) throw new Error(errorMessage(value));
      return value as CompareProgrammesResponseDtoType;
    },
  });
  const unlocked = programmes.data?.meta.compareEnabled === true;
  return (
    <section className="grid gap-5">
      <div>
        <Badge variant={unlocked ? 'secondary' : 'outline'}>
          {unlocked ? 'Available' : 'Locked'}
        </Badge>
        <h1 className="mt-3 text-3xl font-bold tracking-tight">Compare programmes</h1>
        <p className="mt-2 max-w-2xl leading-7 text-muted-foreground">
          Compare is enabled only when at least 10 distinct live programmes are published. Current
          breadth: {programmes.data?.meta.programmeCount ?? 0}/10.
        </p>
      </div>
      {unlocked && (
        <Card>
          <CardHeader>
            <CardTitle>Choose two curricula</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            {[
              ['First programme', leftId, setLeftId],
              ['Second programme', rightId, setRightId],
            ].map(([label, value, setter]) => (
              <label className="grid gap-2 text-sm font-semibold" key={label as string}>
                {label as string}
                <select
                  className="h-11 rounded-[var(--radius-md)] border border-border bg-surface px-3"
                  value={value as string}
                  onChange={(event) => (setter as (value: string) => void)(event.target.value)}
                >
                  {items.map((item) => (
                    <option key={item.programmeVersionId} value={item.programmeVersionId}>
                      {item.title} ({item.cohortStartYear})
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </CardContent>
        </Card>
      )}
      {comparison.error && <p className="state error">{comparison.error.message}</p>}
      {comparison.data && (
        <div className="grid gap-4 md:grid-cols-2">
          {[comparison.data.left, comparison.data.right].map((programme) => (
            <Card key={programme.programmeVersionId}>
              <CardHeader>
                <CardTitle>{programme.title}</CardTitle>
                <CardDescription>
                  {programme.institutionShortName} · {programme.cohortStartYear}
                </CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-3 gap-3 text-sm">
                <p>
                  <span className="block text-muted-foreground">Courses</span>
                  <strong>{programme.listedCourseCount}</strong>
                </p>
                <p>
                  <span className="block text-muted-foreground">Listed credits</span>
                  <strong>{programme.listedCredits}</strong>
                </p>
                <p>
                  <span className="block text-muted-foreground">Choice groups</span>
                  <strong>{programme.choiceGroupCount}</strong>
                </p>
              </CardContent>
            </Card>
          ))}
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle>Shared courses</CardTitle>
              <CardDescription>
                {comparison.data.sharedCourses.length} course codes occur in both published
                curricula.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      )}
    </section>
  );
}

function App() {
  const initialView = new URL(window.location.href).searchParams.get('view');
  const [view, setView] = useState<AppView>(
    initialView === 'plan' ||
      initialView === 'compare' ||
      initialView === 'saved' ||
      initialView === 'workbench' ||
      initialView === 'status'
      ? initialView
      : 'explore',
  );

  useEffect(() => {
    const url = new URL(window.location.href);
    if (view === 'explore') url.searchParams.delete('view');
    else url.searchParams.set('view', view);
    window.history.replaceState(null, '', url);
  }, [view]);

  return (
    <AppShell view={view} onViewChange={setView} apiUrl={apiUrl}>
      {view === 'explore' && <ExploreView onStartPlanning={() => setView('plan')} />}
      {view === 'saved' && <SavedView onExplore={() => setView('explore')} />}
      {view === 'compare' && <CompareView />}
      {view === 'status' && <StatusView />}
      <Suspense fallback={<p className="state">Loading the planning kernel…</p>}>
        {view === 'plan' && <PlannerWorkspace mode="plan" />}
        {view === 'workbench' && <PlannerWorkspace mode="workbench" />}
      </Suspense>
    </AppShell>
  );
}

const resetDevelopmentServiceWorker = async (): Promise<boolean> => {
  if (!import.meta.env.DEV || !('serviceWorker' in navigator)) return true;

  const registrations = await navigator.serviceWorker.getRegistrations();
  const controlledByServiceWorker = navigator.serviceWorker.controller !== null;
  await Promise.all(registrations.map((registration) => registration.unregister()));

  if ('caches' in window) {
    const cacheNames = await caches.keys();
    await Promise.all(
      cacheNames
        .filter((cacheName) => cacheName.startsWith('course-data-'))
        .map((cacheName) => caches.delete(cacheName)),
    );
  }

  const reloadMarker = 'course-data-development-service-worker-reset';
  if (controlledByServiceWorker && sessionStorage.getItem(reloadMarker) !== 'done') {
    sessionStorage.setItem(reloadMarker, 'done');
    window.location.reload();
    return false;
  }

  sessionStorage.removeItem(reloadMarker);
  return true;
};

const registerProductionServiceWorker = (): void => {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => undefined);
  });
};

const startApplication = async (): Promise<void> => {
  if (!(await resetDevelopmentServiceWorker())) return;

  const root = document.getElementById('root');
  if (!root) throw new Error('Missing application root');

  initializeThemePreference();

  createRoot(root).render(
    <StrictMode>
      <ThemeProvider>
        <QueryClientProvider client={queryClient}>
          <App />
        </QueryClientProvider>
      </ThemeProvider>
    </StrictMode>,
  );

  registerProductionServiceWorker();
};

void startApplication();
