import type {
  ListCoursesResponseDtoType,
  PlannerDemoResponseDtoType,
} from '@course-data/contracts';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';

import { api } from './api';
import './styles.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      retry: 1,
    },
  },
});

type View = 'explore' | 'plan' | 'workbench';

const errorMessage = (value: unknown): string => {
  if (typeof value !== 'object' || value === null) return 'Request failed';
  if ('detail' in value && typeof value.detail === 'string') return value.detail;
  if ('message' in value && typeof value.message === 'string') return value.message;
  return 'Request failed';
};

function ExploreView() {
  const initialSearch = new URL(window.location.href).searchParams.get('q') ?? '';
  const [search, setSearch] = useState(initialSearch);

  useEffect(() => {
    const url = new URL(window.location.href);
    if (search) url.searchParams.set('q', search);
    else url.searchParams.delete('q');
    window.history.replaceState(null, '', url);
  }, [search]);

  const courses = useQuery<ListCoursesResponseDtoType>({
    queryKey: ['courses', search],
    queryFn: async () => {
      const result = await api.v1.courses.get({
        query: search ? { search } : {},
      });
      if (result.error) throw new Error(errorMessage(result.error.value));
      return result.data as ListCoursesResponseDtoType;
    },
  });

  return (
    <>
      <section className="search-panel" aria-labelledby="search-heading">
        <div>
          <p className="section-label">Catalogue projection</p>
          <h2 id="search-heading">Find a course</h2>
        </div>
        <label className="search-field">
          <span>Course code or title</span>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Try TDT or security"
            autoComplete="off"
          />
        </label>
      </section>

      <section aria-live="polite" aria-busy={courses.isFetching}>
        <div className="result-heading">
          <h2>Course versions</h2>
          <span>{courses.data?.meta.count ?? 0} results</span>
        </div>

        {courses.isLoading && <p className="state">Loading the catalogue…</p>}
        {courses.isError && <p className="state error">{courses.error.message}</p>}
        {courses.data?.items.length === 0 && (
          <p className="state">Adjust the search to discover other courses.</p>
        )}

        <div className="course-grid">
          {courses.data?.items.map((course: ListCoursesResponseDtoType['items'][number]) => (
            <article className="course-card" key={course.id}>
              <div className="course-card__topline">
                <span>{course.institutionShortName}</span>
                <span>{course.academicYear}</span>
              </div>
              <h3>{course.code}</h3>
              <p className="course-title">{course.title}</p>
              <dl>
                <div>
                  <dt>Credits</dt>
                  <dd>{course.credits ?? 'Not published'}</dd>
                </div>
                <div>
                  <dt>Level</dt>
                  <dd>{course.level}</dd>
                </div>
                <div>
                  <dt>Source</dt>
                  <dd>{course.source.provider}</dd>
                </div>
              </dl>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}

function PlannerView({ showWorkbench = false }: { readonly showWorkbench?: boolean }) {
  const planner = useQuery<PlannerDemoResponseDtoType>({
    queryKey: ['planner-demo'],
    queryFn: async () => {
      const result = await api.v1.planner.demo.get();
      if (result.error) throw new Error(errorMessage(result.error.value));
      return result.data as PlannerDemoResponseDtoType;
    },
  });

  if (planner.isLoading) return <p className="state">Building the roadmap projection…</p>;
  if (planner.isError) return <p className="state error">{planner.error.message}</p>;
  if (!planner.data) return null;

  const { programme, scenario, evaluation, meta } = planner.data;

  if (showWorkbench) {
    return (
      <section className="workbench" aria-labelledby="workbench-heading">
        <div className="projection-heading">
          <div>
            <p className="section-label">Kernel workbench</p>
            <h2 id="workbench-heading">Inspect the planner projection</h2>
          </div>
          <span className="authority-badge">{programme.relationAuthority}</span>
        </div>
        <p className="state subtle">
          This is the first declarative projection over the study kernel. Future workbench views
          will expose filters, relation traversal, grouping, visualization, provenance, and query
          export.
        </p>
        <details open>
          <summary>Programme and scenario JSON</summary>
          <pre>{JSON.stringify({ programme, scenario, evaluation, meta }, null, 2)}</pre>
        </details>
      </section>
    );
  }

  return (
    <section aria-labelledby="planner-heading">
      <div className="planner-intro">
        <div>
          <p className="section-label">Roadmap projection</p>
          <h2 id="planner-heading">{programme.title}</h2>
          <p>
            Cohort {programme.cohortStartYear} · {programme.durationTerms} terms ·{' '}
            {evaluation.totalPlannedCredits} illustrative credits
          </p>
        </div>
        <span className="authority-badge">{programme.relationAuthority}</span>
      </div>

      <p className="notice">{meta.note}</p>

      <div className="roadmap" aria-label="Term-by-term roadmap">
        {scenario.terms.map(
          ({ term, courses }: PlannerDemoResponseDtoType['scenario']['terms'][number]) => (
            <article className="term-card" key={term.id}>
              <div className="term-card__header">
                <div>
                  <span>Term {term.index + 1}</span>
                  <h3>{term.label}</h3>
                </div>
                <strong>{evaluation.termCredits[term.id] ?? 0} credits</strong>
              </div>
              {courses.length === 0 ? (
                <p className="empty-term">No course placed in this illustrative slice.</p>
              ) : (
                <ul className="planned-courses">
                  {courses.map(
                    (
                      course: PlannerDemoResponseDtoType['scenario']['terms'][number]['courses'][number],
                    ) => (
                      <li key={course.courseVersionId}>
                        <span>{course.code}</span>
                        <div>
                          <strong>{course.title}</strong>
                          <small>{course.credits} credits</small>
                        </div>
                      </li>
                    ),
                  )}
                </ul>
              )}
            </article>
          ),
        )}
      </div>

      <div className="evaluation-panel">
        <div>
          <p className="section-label">Kernel evaluation</p>
          <h2>{evaluation.isFeasible ? 'No blocking findings' : 'Roadmap needs attention'}</h2>
        </div>
        {evaluation.findings.length === 0 ? (
          <p>The current fixture satisfies its partial requirement model.</p>
        ) : (
          <ul>
            {evaluation.findings.map(
              (finding: PlannerDemoResponseDtoType['evaluation']['findings'][number]) => (
                <li
                  key={`${finding.code}:${finding.courseVersionId ?? finding.termId ?? 'general'}`}
                >
                  <strong>{finding.title}</strong>
                  <span>{finding.detail}</span>
                </li>
              ),
            )}
          </ul>
        )}
      </div>
    </section>
  );
}

function App() {
  const initialView = new URL(window.location.href).searchParams.get('view');
  const [view, setView] = useState<View>(
    initialView === 'plan' || initialView === 'workbench' ? initialView : 'explore',
  );

  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set('view', view);
    window.history.replaceState(null, '', url);
  }, [view]);

  return (
    <main className="page-shell">
      <header className="hero">
        <div>
          <p className="eyebrow">Course Data Platform</p>
          <h1>Map what you can study and how it fits together</h1>
          <p className="lede">
            A study-planning kernel with curated projections for exploration, programme roadmaps,
            and full data inspection.
          </p>
        </div>
        <a
          className="api-link"
          href={`${import.meta.env.VITE_API_URL ?? 'http://localhost:8787'}/openapi`}
          target="_blank"
          rel="noreferrer"
        >
          Open API documentation
        </a>
      </header>

      <nav className="view-tabs" aria-label="Product views">
        {(
          [
            ['explore', 'Explore'],
            ['plan', 'Plan'],
            ['workbench', 'Workbench'],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            aria-pressed={view === value}
            onClick={() => setView(value)}
          >
            {label}
          </button>
        ))}
      </nav>

      {view === 'explore' && <ExploreView />}
      {view === 'plan' && <PlannerView />}
      {view === 'workbench' && <PlannerView showWorkbench />}
    </main>
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

  createRoot(root).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </StrictMode>,
  );

  registerProductionServiceWorker();
};

void startApplication();
