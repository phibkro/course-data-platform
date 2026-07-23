import type { CourseInsightResponseDtoType, CourseSearchItemDtoType } from '@course-data/contracts';
import { Effect, Match as M, Schema as S } from 'effect';
import { Command, Navigation, Runtime, Url } from 'foldkit';
import type { Document, Html } from 'foldkit/html';
import { html } from 'foldkit/html';
import { m } from 'foldkit/message';
import { ts } from 'foldkit/schema';
import { evo } from 'foldkit/struct';

import { Button, Checkbox, Input, Select } from '@foldkit/ui';

import {
  CourseInsightResponseSchema,
  CourseSearchResponseSchema,
  courseClient,
  type CourseSearchRequest,
  type CourseSearchResponse,
  type CourseSearchSort,
} from './course-client';
import { courseInsightView } from './course-detail';

const DISPLAY_CHUNK = 40;
const DEFAULT_TERM = '2026-autumn';
const DEFAULT_SORT: CourseSearchSort = 'title-asc';

type Campus = 'all' | 'trondheim' | 'gjovik' | 'alesund';
type Level = 'all' | 'bachelor' | 'master' | 'phd';
const CampusSchema = S.Literals(['all', 'trondheim', 'gjovik', 'alesund']);
const LevelSchema = S.Literals(['all', 'bachelor', 'master', 'phd']);
const SortSchema = S.Literals(['relevance', 'title-asc', 'title-desc', 'code-asc', 'code-desc']);

export const CatalogueInitialLoading = ts('CatalogueInitialLoading');
export const CatalogueSuccess = ts('CatalogueSuccess', { response: CourseSearchResponseSchema });
export const CataloguePartial = ts('CataloguePartial', { response: CourseSearchResponseSchema });
export const CatalogueEmpty = ts('CatalogueEmpty');
export const CatalogueFailure = ts('CatalogueFailure', { error: S.String });

const CatalogueResult = S.Union([
  CatalogueInitialLoading,
  CatalogueSuccess,
  CataloguePartial,
  CatalogueEmpty,
  CatalogueFailure,
]);

type CatalogueResult =
  | ReturnType<typeof CatalogueInitialLoading>
  | { readonly _tag: 'CatalogueSuccess'; readonly response: CourseSearchResponse }
  | { readonly _tag: 'CataloguePartial'; readonly response: CourseSearchResponse }
  | ReturnType<typeof CatalogueEmpty>
  | ReturnType<typeof CatalogueFailure>;

export const NextPageIdle = ts('NextPageIdle');
export const NextPageLoading = ts('NextPageLoading');
export const NextPageFailure = ts('NextPageFailure', { error: S.String });
const NextPageState = S.Union([NextPageIdle, NextPageLoading, NextPageFailure]);

export const DetailClosed = ts('DetailClosed');
export const DetailLoading = ts('DetailLoading');
export const DetailSuccess = ts('DetailSuccess', { response: CourseInsightResponseSchema });
export const DetailPartial = ts('DetailPartial', { response: CourseInsightResponseSchema });
export const DetailFailure = ts('DetailFailure', { error: S.String });
const DetailResult = S.Union([
  DetailClosed,
  DetailLoading,
  DetailSuccess,
  DetailPartial,
  DetailFailure,
]);

type DetailResult =
  | ReturnType<typeof DetailClosed>
  | ReturnType<typeof DetailLoading>
  | { readonly _tag: 'DetailSuccess'; readonly response: CourseInsightResponseDtoType }
  | { readonly _tag: 'DetailPartial'; readonly response: CourseInsightResponseDtoType }
  | ReturnType<typeof DetailFailure>;

export const Model = S.Struct({
  query: S.String,
  term: S.String,
  campus: CampusSchema,
  level: LevelSchema,
  sort: SortSchema,
  openOnly: S.Boolean,
  englishOnly: S.Boolean,
  activeRequestKey: S.String,
  visibleCount: S.Number,
  catalogue: CatalogueResult,
  nextPage: NextPageState,
  selectedCode: S.NullOr(S.String),
  detail: DetailResult,
});

type SchemaModel = typeof Model.Type;
export type Model = Omit<SchemaModel, 'catalogue' | 'detail'> & {
  readonly catalogue: CatalogueResult;
  readonly detail: DetailResult;
};

export const UpdatedQuery = m('UpdatedQuery', { value: S.String });
export const SubmittedSearch = m('SubmittedSearch');
export const ChangedTerm = m('ChangedTerm', { value: S.String });
export const ChangedCampus = m('ChangedCampus', { value: S.String });
export const ChangedLevel = m('ChangedLevel', { value: S.String });
export const ChangedSort = m('ChangedSort', { value: S.String });
export const ToggledOpen = m('ToggledOpen', { isChecked: S.Boolean });
export const ToggledEnglish = m('ToggledEnglish', { isChecked: S.Boolean });
export const RequestedMoreCourses = m('RequestedMoreCourses');
export const RequestedUrl = m('RequestedUrl', { href: S.String, external: S.Boolean });
export const ChangedUrl = m('ChangedUrl', { href: S.String });
export const ClosedCourse = m('ClosedCourse');
export const SucceededCourseSearch = m('SucceededCourseSearch', {
  requestKey: S.String,
  append: S.Boolean,
  response: CourseSearchResponseSchema,
});
export const FailedCourseSearch = m('FailedCourseSearch', {
  requestKey: S.String,
  append: S.Boolean,
  error: S.String,
});
export const SucceededCourseInsight = m('SucceededCourseInsight', {
  courseCode: S.String,
  response: CourseInsightResponseSchema,
});
export const FailedCourseInsight = m('FailedCourseInsight', {
  courseCode: S.String,
  error: S.String,
});
export const CompletedNavigation = m('CompletedNavigation');
export const FailedNavigation = m('FailedNavigation', { error: S.String });

export const Message = S.Union([
  UpdatedQuery,
  SubmittedSearch,
  ChangedTerm,
  ChangedCampus,
  ChangedLevel,
  ChangedSort,
  ToggledOpen,
  ToggledEnglish,
  RequestedMoreCourses,
  RequestedUrl,
  ChangedUrl,
  ClosedCourse,
  SucceededCourseSearch,
  FailedCourseSearch,
  SucceededCourseInsight,
  FailedCourseInsight,
  CompletedNavigation,
  FailedNavigation,
]);
export type Message = typeof Message.Type;

const searchRequest = (model: Model, page: number): CourseSearchRequest => ({
  query: model.query,
  term: model.term,
  page,
  sort: model.sort,
  ...(model.campus === 'all' ? {} : { campus: model.campus }),
  ...(model.level === 'all' ? {} : { level: model.level }),
  continuingEducation: model.level === 'all',
  open: model.openOnly,
  english: model.englishOnly,
});

const requestKey = (request: CourseSearchRequest): string =>
  [
    request.query.trim(),
    request.term,
    request.sort,
    request.campus ?? 'all',
    request.level ?? 'all',
    request.continuingEducation,
    request.open,
    request.english,
  ].join('|');

export const FetchCourseSearch = Command.define(
  'FetchCourseSearch',
  {
    query: S.String,
    term: S.String,
    page: S.Number,
    sort: S.String,
    campus: S.NullOr(S.String),
    level: S.NullOr(S.String),
    continuingEducation: S.Boolean,
    open: S.Boolean,
    english: S.Boolean,
    requestKey: S.String,
    append: S.Boolean,
  },
  SucceededCourseSearch,
  FailedCourseSearch,
)((input) =>
  courseClient
    .search({
      query: input.query,
      term: input.term,
      page: input.page,
      sort: input.sort as CourseSearchSort,
      ...(input.campus === null ? {} : { campus: input.campus }),
      ...(input.level === null ? {} : { level: input.level }),
      continuingEducation: input.continuingEducation,
      open: input.open,
      english: input.english,
    })
    .pipe(
      Effect.map((response) =>
        SucceededCourseSearch({
          requestKey: input.requestKey,
          append: input.append,
          response,
        }),
      ),
      Effect.catch((error) =>
        Effect.succeed(
          FailedCourseSearch({
            requestKey: input.requestKey,
            append: input.append,
            error: error.message,
          }),
        ),
      ),
    ),
);

export const FetchCourseInsight = Command.define(
  'FetchCourseInsight',
  { courseCode: S.String, term: S.String },
  SucceededCourseInsight,
  FailedCourseInsight,
)(({ courseCode, term }) =>
  courseClient.getInsight(courseCode, term).pipe(
    Effect.map((response) => SucceededCourseInsight({ courseCode, response })),
    Effect.catch((error) =>
      Effect.succeed(FailedCourseInsight({ courseCode, error: error.message })),
    ),
  ),
);

export const Navigate = Command.define(
  'Navigate',
  { href: S.String, mode: S.String },
  CompletedNavigation,
  FailedNavigation,
)(({ href, mode }) =>
  (mode === 'external'
    ? Navigation.load(href)
    : mode === 'replace'
      ? Navigation.replaceUrl(href)
      : Navigation.pushUrl(href)
  ).pipe(Effect.as(CompletedNavigation())),
);

const fetchCommand = (
  request: CourseSearchRequest,
  key: string,
  append: boolean,
): Command.Command<Message> =>
  FetchCourseSearch({
    ...request,
    campus: request.campus ?? null,
    level: request.level ?? null,
    requestKey: key,
    append,
  });

const catalogueResponse = (result: CatalogueResult): CourseSearchResponse | null =>
  result._tag === 'CatalogueSuccess' || result._tag === 'CataloguePartial' ? result.response : null;

const isPartial = (response: CourseSearchResponse): boolean =>
  response.sourceStatuses.some(
    (source) => source.status !== 'available' || source.warning !== null,
  );

const mergeResponses = (
  current: CourseSearchResponse | null,
  next: CourseSearchResponse,
): CourseSearchResponse => {
  if (current === null) return next;
  const byKey = new Map(current.items.map((item) => [item.courseKey, item]));
  for (const item of next.items) byKey.set(item.courseKey, item);
  return {
    ...next,
    items: [...byKey.values()],
    sourceStatuses: next.sourceStatuses,
    meta: { ...next.meta, count: byKey.size },
  };
};

const normalizedUrl = (model: Model, selectedCode: string | null): string => {
  const params = new URLSearchParams();
  if (model.query.trim().length > 0) params.set('q', model.query.trim());
  if (model.term !== DEFAULT_TERM) params.set('term', model.term);
  if (model.campus !== 'all') params.set('campus', model.campus);
  if (model.level !== 'all') params.set('level', model.level);
  if (model.sort !== DEFAULT_SORT) params.set('sort', model.sort);
  if (model.openOnly) params.set('open', '1');
  if (model.englishOnly) params.set('english', '1');
  if (selectedCode !== null) params.set('course', selectedCode);
  const query = params.toString();
  return query.length === 0 ? '/' : `/?${query}`;
};

const startCatalogue = (
  model: Model,
  patch: Partial<
    Pick<Model, 'query' | 'term' | 'campus' | 'level' | 'sort' | 'openOnly' | 'englishOnly'>
  >,
): readonly [Model, ReadonlyArray<Command.Command<Message>>] => {
  const next = { ...model, ...patch, selectedCode: null, detail: DetailClosed() };
  const request = searchRequest(next, 1);
  const key = requestKey(request);
  const nextModel: Model = {
    ...next,
    activeRequestKey: key,
    visibleCount: DISPLAY_CHUNK,
    catalogue: CatalogueInitialLoading(),
    nextPage: NextPageIdle(),
  };
  return [
    nextModel,
    [
      Navigate({ href: normalizedUrl(nextModel, null), mode: 'replace' }),
      fetchCommand(request, key, false),
    ],
  ];
};

const oneOf = <A extends string>(value: string, values: ReadonlyArray<A>, fallback: A): A =>
  values.includes(value as A) ? (value as A) : fallback;

interface ParsedLocation {
  readonly query: string;
  readonly term: string;
  readonly campus: Campus;
  readonly level: Level;
  readonly sort: CourseSearchSort;
  readonly openOnly: boolean;
  readonly englishOnly: boolean;
  readonly selectedCode: string | null;
}

const parseLocation = (href: string): ParsedLocation => {
  const url = new URL(href, 'http://course-lens.local');
  return {
    query: url.searchParams.get('q') ?? '',
    term: url.searchParams.get('term') ?? DEFAULT_TERM,
    campus: oneOf(
      url.searchParams.get('campus') ?? 'all',
      ['all', 'trondheim', 'gjovik', 'alesund'] as const,
      'all',
    ),
    level: oneOf(
      url.searchParams.get('level') ?? 'all',
      ['all', 'bachelor', 'master', 'phd'] as const,
      'all',
    ),
    sort: oneOf(
      url.searchParams.get('sort') ?? DEFAULT_SORT,
      ['relevance', 'title-asc', 'title-desc', 'code-asc', 'code-desc'] as const,
      DEFAULT_SORT,
    ),
    openOnly: url.searchParams.get('open') === '1',
    englishOnly: url.searchParams.get('english') === '1',
    selectedCode: url.searchParams.get('course')?.trim().toUpperCase() || null,
  };
};

const locationMatchesModel = (location: ParsedLocation, model: Model): boolean =>
  location.query === model.query &&
  location.term === model.term &&
  location.campus === model.campus &&
  location.level === model.level &&
  location.sort === model.sort &&
  location.openOnly === model.openOnly &&
  location.englishOnly === model.englishOnly;

export const update = (
  model: Model,
  message: Message,
): readonly [Model, ReadonlyArray<Command.Command<Message>>] =>
  M.value(message).pipe(
    M.withReturnType<readonly [Model, ReadonlyArray<Command.Command<Message>>]>(),
    M.tagsExhaustive({
      UpdatedQuery: ({ value }) => [evo(model, { query: () => value }), []],
      SubmittedSearch: () =>
        startCatalogue(model, {
          query: model.query.trim(),
          sort: model.query.trim().length === 0 ? DEFAULT_SORT : 'relevance',
        }),
      ChangedTerm: ({ value }) => startCatalogue(model, { term: value }),
      ChangedCampus: ({ value }) =>
        startCatalogue(model, {
          campus: oneOf(value, ['all', 'trondheim', 'gjovik', 'alesund'], 'all'),
        }),
      ChangedLevel: ({ value }) =>
        startCatalogue(model, {
          level: oneOf(value, ['all', 'bachelor', 'master', 'phd'], 'all'),
        }),
      ChangedSort: ({ value }) =>
        startCatalogue(model, {
          sort: oneOf(
            value,
            ['relevance', 'title-asc', 'title-desc', 'code-asc', 'code-desc'],
            'relevance',
          ),
        }),
      ToggledOpen: ({ isChecked }) => startCatalogue(model, { openOnly: isChecked }),
      ToggledEnglish: ({ isChecked }) => startCatalogue(model, { englishOnly: isChecked }),
      RequestedMoreCourses: () => {
        const response = catalogueResponse(model.catalogue);
        if (response === null || model.nextPage._tag === 'NextPageLoading') return [model, []];
        if (model.visibleCount < response.items.length) {
          return [
            evo(model, {
              visibleCount: (count) => Math.min(response.items.length, count + DISPLAY_CHUNK),
              nextPage: () => NextPageIdle(),
            }),
            [],
          ];
        }
        if (!response.meta.hasMore) return [model, []];
        const request = searchRequest(model, response.meta.page + 1);
        return [
          evo(model, { nextPage: () => NextPageLoading() }),
          [fetchCommand(request, model.activeRequestKey, true)],
        ];
      },
      RequestedUrl: ({ href, external }) => [
        model,
        [Navigate({ href, mode: external ? 'external' : 'push' })],
      ],
      ChangedUrl: ({ href }) => {
        const location = parseLocation(href);
        if (!locationMatchesModel(location, model)) {
          const next: Model = {
            ...model,
            ...location,
            selectedCode: location.selectedCode,
            detail: location.selectedCode === null ? DetailClosed() : DetailLoading(),
            catalogue: CatalogueInitialLoading(),
            nextPage: NextPageIdle(),
            visibleCount: DISPLAY_CHUNK,
          };
          const request = searchRequest(next, 1);
          const key = requestKey(request);
          return [
            { ...next, activeRequestKey: key },
            [
              fetchCommand(request, key, false),
              ...(location.selectedCode === null
                ? []
                : [FetchCourseInsight({ courseCode: location.selectedCode, term: location.term })]),
            ],
          ];
        }
        if (location.selectedCode === model.selectedCode) return [model, []];
        return location.selectedCode === null
          ? [{ ...model, selectedCode: null, detail: DetailClosed() }, []]
          : [
              {
                ...model,
                selectedCode: location.selectedCode,
                detail: DetailLoading(),
              },
              [FetchCourseInsight({ courseCode: location.selectedCode, term: model.term })],
            ];
      },
      ClosedCourse: () => [
        model,
        [Navigate({ href: normalizedUrl(model, null), mode: 'replace' })],
      ],
      SucceededCourseSearch: ({ requestKey: key, append, response: nextResponse }) => {
        if (key !== model.activeRequestKey) return [model, []];
        const response = mergeResponses(
          append ? catalogueResponse(model.catalogue) : null,
          nextResponse,
        );
        const result: CatalogueResult =
          response.items.length === 0
            ? CatalogueEmpty()
            : isPartial(response)
              ? { _tag: 'CataloguePartial', response }
              : { _tag: 'CatalogueSuccess', response };
        return [
          {
            ...model,
            catalogue: result,
            visibleCount: append
              ? Math.min(response.items.length, model.visibleCount + DISPLAY_CHUNK)
              : Math.min(DISPLAY_CHUNK, response.items.length),
            nextPage: NextPageIdle(),
          },
          [],
        ];
      },
      FailedCourseSearch: ({ requestKey: key, append, error }) => {
        if (key !== model.activeRequestKey) return [model, []];
        return append
          ? [{ ...model, nextPage: NextPageFailure({ error }) }, []]
          : [{ ...model, catalogue: CatalogueFailure({ error }) }, []];
      },
      SucceededCourseInsight: ({ courseCode, response }) => {
        if (courseCode !== model.selectedCode) return [model, []];
        return [
          {
            ...model,
            detail: response.meta.partial
              ? { _tag: 'DetailPartial', response }
              : { _tag: 'DetailSuccess', response },
          },
          [],
        ];
      },
      FailedCourseInsight: ({ courseCode, error }) =>
        courseCode === model.selectedCode
          ? [{ ...model, detail: DetailFailure({ error }) }, []]
          : [model, []],
      CompletedNavigation: () => [model, []],
      FailedNavigation: () => [model, []],
    }),
  );

export const initForHref = (
  href: string,
): readonly [Model, ReadonlyArray<Command.Command<Message>>] => {
  const location = parseLocation(href);
  const base: Model = {
    query: location.query,
    term: location.term,
    campus: location.campus,
    level: location.level,
    sort: location.sort,
    openOnly: location.openOnly,
    englishOnly: location.englishOnly,
    activeRequestKey: '',
    visibleCount: DISPLAY_CHUNK,
    catalogue: CatalogueInitialLoading(),
    nextPage: NextPageIdle(),
    selectedCode: location.selectedCode,
    detail: location.selectedCode === null ? DetailClosed() : DetailLoading(),
  };
  const request = searchRequest(base, 1);
  const key = requestKey(request);
  const model = { ...base, activeRequestKey: key };
  return [
    model,
    [
      fetchCommand(request, key, false),
      ...(location.selectedCode === null
        ? []
        : [FetchCourseInsight({ courseCode: location.selectedCode, term: location.term })]),
    ],
  ];
};

export const init: Runtime.ApplicationInit<Model, Message> = () =>
  initForHref(typeof window === 'undefined' ? 'http://course-lens.local/' : window.location.href);

export const routingInit: Runtime.RoutingApplicationInit<Model, Message> = (url) =>
  initForHref(Url.toString(url));

export const view = (model: Model): Document => ({
  title:
    model.detail._tag === 'DetailSuccess' || model.detail._tag === 'DetailPartial'
      ? `${model.detail.response.item.code} · Course lens`
      : 'Browse NTNU courses · Course lens',
  body: appView(model),
});

const appView = (model: Model): Html => {
  const h = html<Message>();
  return h.div(
    [h.Class('app-shell')],
    [
      desktopNavigation(),
      h.main(
        [h.Class('main-content')],
        [model.selectedCode === null ? catalogueView(model) : selectedCourseView(model)],
      ),
      mobileNavigation(),
    ],
  );
};

const desktopNavigation = (): Html => {
  const h = html<Message>();
  return h.aside(
    [h.Class('sidebar'), h.AriaLabel('Primary navigation')],
    [
      h.div(
        [h.Class('brand')],
        [h.span([h.Class('brand__mark'), h.AriaHidden(true)], ['C']), h.span([], ['Course lens'])],
      ),
      h.nav(
        [],
        [
          h.a(
            [
              h.Href('/'),
              h.Class('navigation-item navigation-item--active'),
              h.AriaCurrent('page'),
            ],
            [h.span([h.AriaHidden(true)], ['⌕']), h.span([], ['Explore'])],
          ),
        ],
      ),
      h.p([h.Class('sidebar__note')], ['Facts stay traceable. Missing information stays visible.']),
    ],
  );
};

const mobileNavigation = (): Html => {
  const h = html<Message>();
  return h.nav(
    [h.Class('bottom-navigation'), h.AriaLabel('Primary navigation')],
    [
      h.a(
        [h.Href('/'), h.Class('bottom-navigation__item'), h.AriaCurrent('page')],
        [h.span([h.AriaHidden(true)], ['⌕']), h.span([], ['Explore'])],
      ),
    ],
  );
};

const catalogueView = (model: Model): Html => {
  const h = html<Message>();
  return h.div(
    [h.Class('catalogue')],
    [
      h.header(
        [h.Class('catalogue-hero')],
        [
          h.p([h.Class('eyebrow')], ['NTNU course catalogue']),
          h.h1([], ['Browse courses before you choose.']),
          h.p(
            [h.Class('catalogue-hero__lede')],
            [
              'Scan official NTNU offerings, narrow the catalogue, then open a course for assessment, work-form, and grade evidence.',
            ],
          ),
        ],
      ),
      catalogueControls(model),
      catalogueResultView(model),
    ],
  );
};

const catalogueControls = (model: Model): Html => {
  const h = html<Message>();
  const loading = model.catalogue._tag === 'CatalogueInitialLoading';
  return h.form(
    [
      h.Class('catalogue-controls'),
      h.Role('search'),
      h.OnSubmit(SubmittedSearch()),
      h.AriaLabel('Find and filter NTNU courses'),
    ],
    [
      h.div(
        [h.Class('catalogue-controls__search')],
        [
          Input.view<Message>({
            id: 'course-query',
            value: model.query,
            placeholder: 'Course code or title',
            onInput: (value) => UpdatedQuery({ value }),
            toView: (attributes) =>
              h.div(
                [h.Class('field')],
                [
                  h.label([...attributes.label, h.Class('field__label')], ['Search courses']),
                  h.input([...attributes.input, h.Class('field__input'), h.Autocomplete('off')]),
                ],
              ),
          }),
          Button.view<Message>({
            type: 'submit',
            isDisabled: loading,
            toView: (attributes) =>
              h.button(
                [...attributes.button, h.Class('button button--primary')],
                [loading ? 'Searching…' : 'Search'],
              ),
          }),
        ],
      ),
      h.div(
        [h.Class('catalogue-filters')],
        [
          selectControl('term', 'Term', model.term, ChangedTerm, [
            ['2026-autumn', 'Autumn 2026 · 2026/27'],
            ['2026-spring', 'Spring 2027 · 2026/27'],
            ['2027-autumn', 'Autumn 2027 · 2027/28'],
            ['2027-spring', 'Spring 2028 · 2027/28'],
          ]),
          selectControl('campus', 'Campus', model.campus, ChangedCampus, [
            ['all', 'All campuses'],
            ['trondheim', 'Trondheim'],
            ['gjovik', 'Gjøvik'],
            ['alesund', 'Ålesund'],
          ]),
          selectControl('level', 'Study level', model.level, ChangedLevel, [
            ['all', 'All levels'],
            ['bachelor', 'Bachelor'],
            ['master', 'Master'],
            ['phd', 'PhD'],
          ]),
          selectControl('sort', 'Sort', model.sort, ChangedSort, [
            ['relevance', 'NTNU relevance'],
            ['title-asc', 'Title A–Z'],
            ['title-desc', 'Title Z–A'],
            ['code-asc', 'Code A–Z'],
            ['code-desc', 'Code Z–A'],
          ]),
        ],
      ),
      h.div(
        [h.Class('catalogue-toggles')],
        [
          checkboxControl('open-admission', 'Open admission', model.openOnly, (isChecked) =>
            ToggledOpen({ isChecked }),
          ),
          checkboxControl('english', 'Taught in English', model.englishOnly, (isChecked) =>
            ToggledEnglish({ isChecked }),
          ),
        ],
      ),
    ],
  );
};

const selectControl = (
  id: string,
  label: string,
  value: string,
  message: (input: { readonly value: string }) => Message,
  options: ReadonlyArray<readonly [string, string]>,
): Html => {
  const h = html<Message>();
  return Select.view<Message>({
    id,
    value,
    onChange: (next) => message({ value: next }),
    toView: (attributes) =>
      h.div(
        [h.Class('select-field')],
        [
          h.label([...attributes.label, h.Class('field__label')], [label]),
          h.select(
            [...attributes.select, h.Class('select-field__control')],
            options.map(([optionValue, text]) =>
              h.option([h.Value(optionValue), h.Selected(optionValue === value)], [text]),
            ),
          ),
        ],
      ),
  });
};

const checkboxControl = (
  id: string,
  label: string,
  isChecked: boolean,
  onToggle: (isChecked: boolean) => Message,
): Html => {
  const h = html<Message>();
  return Checkbox.view<Message>({
    id,
    isChecked,
    onToggle,
    toView: (attributes) =>
      h.label(
        [...attributes.label, h.Class('filter-checkbox')],
        [
          h.span([...attributes.checkbox, h.Class('filter-checkbox__box')], [isChecked ? '✓' : '']),
          h.span([], [label]),
        ],
      ),
  });
};

const catalogueResultView = (model: Model): Html => {
  const h = html<Message>();
  switch (model.catalogue._tag) {
    case 'CatalogueInitialLoading':
      return h.section(
        [h.Class('state-card state-card--loading'), h.Role('status'), h.AriaLive('polite')],
        [
          h.div([h.Class('loading-indicator'), h.AriaHidden(true)], []),
          h.h2([], ['Loading the NTNU catalogue']),
          h.p([], ['Official course summaries appear before deeper evidence is loaded.']),
        ],
      );
    case 'CatalogueFailure':
      return h.section(
        [h.Class('state-card state-card--failure'), h.Role('alert')],
        [
          h.p([h.Class('status-label status-label--error')], ['Catalogue unavailable']),
          h.h2([], ['We could not load courses']),
          h.p([], [model.catalogue.error]),
          h.p([], ['Your filters are preserved. Submit the search to try again.']),
        ],
      );
    case 'CatalogueEmpty':
      return h.section(
        [h.Class('state-card'), h.Role('status')],
        [
          h.h2([], ['No courses match these filters']),
          h.p([], ['Try another phrase, campus, term, or study level.']),
        ],
      );
    case 'CataloguePartial':
      return catalogueList(model, model.catalogue.response, true);
    case 'CatalogueSuccess':
      return catalogueList(model, model.catalogue.response, false);
  }
};

const catalogueList = (model: Model, response: CourseSearchResponse, partial: boolean): Html => {
  const h = html<Message>();
  const shown = response.items.slice(0, model.visibleCount);
  const canRevealLocal = model.visibleCount < response.items.length;
  const canFetch = response.meta.hasMore;
  return h.section(
    [
      h.Class('catalogue-results'),
      h.AriaLabel('Course results'),
      h.AriaBusy(model.nextPage._tag === 'NextPageLoading'),
    ],
    [
      partial
        ? h.div(
            [h.Class('partial-banner'), h.Role('status')],
            [
              'Some catalogue data could not be used. Official results that were validated remain visible.',
            ],
          )
        : h.empty,
      h.header(
        [h.Class('catalogue-results__header')],
        [
          h.div(
            [],
            [
              h.h2([], ['Courses']),
              h.p(
                [h.AriaLive('polite')],
                [`Showing ${shown.length} of ${response.meta.total} courses`],
              ),
            ],
          ),
          h.p([h.Class('catalogue-results__source')], ['Official NTNU catalogue']),
        ],
      ),
      h.ol(
        [h.Class('course-list')],
        shown.map((course) => courseCard(model, course)),
      ),
      model.nextPage._tag === 'NextPageFailure'
        ? h.div(
            [h.Class('inline-error'), h.Role('alert')],
            [
              h.strong([], ['More courses could not be loaded.']),
              h.span([], [` ${model.nextPage.error}`]),
            ],
          )
        : h.empty,
      canRevealLocal || canFetch
        ? Button.view<Message>({
            type: 'button',
            isDisabled: model.nextPage._tag === 'NextPageLoading',
            onClick: RequestedMoreCourses(),
            toView: (attributes) =>
              h.button(
                [...attributes.button, h.Class('button button--secondary load-more')],
                [
                  model.nextPage._tag === 'NextPageLoading'
                    ? 'Loading more courses…'
                    : 'Show more courses',
                ],
              ),
          })
        : h.p([h.Class('catalogue-end')], ['End of results']),
    ],
  );
};

const courseCard = (model: Model, course: CourseSearchItemDtoType): Html => {
  const h = html<Message>();
  const title = course.title.state === 'known' ? course.title.value : 'Title unavailable';
  const offering =
    course.offerings.state === 'known' && course.offerings.value.length > 0
      ? (course.offerings.value[0] ?? null)
      : null;
  const place =
    offering === null || offering.campuses.length === 0
      ? 'Campus not reported'
      : offering.campuses.join(', ');
  const term =
    offering === null
      ? 'Term unavailable'
      : formatOfferingPeriod(offering.academicYear, offering.season);
  return h.li(
    [h.Class('course-list__item')],
    [
      h.article(
        [h.Class('course-card')],
        [
          h.div(
            [h.Class('course-card__identity')],
            [
              h.p([h.Class('course-code')], [course.code]),
              h.h3(
                [],
                [
                  h.a(
                    [
                      h.Href(normalizedUrl(model, course.code)),
                      h.AriaLabel(`Open ${course.code}: ${title}`),
                    ],
                    [title],
                  ),
                ],
              ),
            ],
          ),
          h.dl(
            [h.Class('course-card__facts')],
            [
              h.div([], [h.dt([], ['Term']), h.dd([], [term])]),
              h.div([], [h.dt([], ['Campus']), h.dd([], [place])]),
              h.div(
                [],
                [
                  h.dt([], ['Details']),
                  h.dd(
                    [],
                    [
                      course.enrichment === 'basic'
                        ? 'Load when opened'
                        : formatToken(course.enrichment),
                    ],
                  ),
                ],
              ),
            ],
          ),
        ],
      ),
    ],
  );
};

const selectedCourseView = (model: Model): Html => {
  const h = html<Message>();
  return h.div(
    [h.Class('selected-course')],
    [
      Button.view<Message>({
        type: 'button',
        onClick: ClosedCourse(),
        toView: (attributes) =>
          h.button([...attributes.button, h.Class('back-button')], ['← Back to course results']),
      }),
      detailResultView(model.detail),
    ],
  );
};

const detailResultView = (detail: DetailResult): Html => {
  const h = html<Message>();
  switch (detail._tag) {
    case 'DetailClosed':
      return h.empty;
    case 'DetailLoading':
      return h.section(
        [h.Class('state-card state-card--loading'), h.Role('status'), h.AriaLive('polite')],
        [
          h.div([h.Class('loading-indicator'), h.AriaHidden(true)], []),
          h.h2([], ['Gathering course evidence']),
          h.p([], ['Official course details and historical outcomes load independently.']),
        ],
      );
    case 'DetailFailure':
      return h.section(
        [h.Class('state-card state-card--failure'), h.Role('alert')],
        [
          h.p([h.Class('status-label status-label--error')], ['Course unavailable']),
          h.h2([], ['We could not load this course']),
          h.p([], [detail.error]),
        ],
      );
    case 'DetailPartial':
      return courseInsightView(detail.response, true);
    case 'DetailSuccess':
      return courseInsightView(detail.response, false);
  }
};

const formatOfferingPeriod = (academicYear: number, season: string): string => {
  const academicYearLabel = `${academicYear}/${String(academicYear + 1).slice(-2)}`;
  if (season === 'full-year') return `Academic year ${academicYearLabel}`;
  const calendarYear = season === 'autumn' ? academicYear : academicYear + 1;
  return `${formatToken(season)} ${calendarYear} · ${academicYearLabel}`;
};

const formatToken = (value: string): string =>
  value
    .split('-')
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join(' ');
