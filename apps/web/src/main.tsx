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

function App() {
  const initialSearch = new URL(window.location.href).searchParams.get('q') ?? '';
  const [search, setSearch] = useState(initialSearch);

  useEffect(() => {
    const url = new URL(window.location.href);
    if (search) url.searchParams.set('q', search);
    else url.searchParams.delete('q');
    window.history.replaceState(null, '', url);
  }, [search]);

  const courses = useQuery({
    queryKey: ['courses', search],
    queryFn: async () => {
      const result = await api.v1.courses.get({
        query: search ? { search } : {},
      });
      if (result.error) {
        const value = result.error.value;
        throw new Error(
          'detail' in value ? value.detail : (value.message ?? 'Request validation failed'),
        );
      }
      return result.data;
    },
  });

  return (
    <main className="page-shell">
      <header className="hero">
        <div>
          <p className="eyebrow">Course Data Platform</p>
          <h1>Browse courses as public, attributable data</h1>
          <p className="lede">
            This first vertical slice proves the API contract and application boundaries before
            adding live DBH ingestion.
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

      <section className="search-panel" aria-labelledby="search-heading">
        <div>
          <p className="section-label">Catalogue</p>
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
          {courses.data?.items.map((course) => (
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
