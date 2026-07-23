import type { CourseInsightResponseDtoType } from '@course-data/contracts';
import { Effect, Match as M, Schema as S } from 'effect';
import { Command, Runtime } from 'foldkit';
import type { Document, Html } from 'foldkit/html';
import { html } from 'foldkit/html';
import { m } from 'foldkit/message';
import { ts } from 'foldkit/schema';
import { evo } from 'foldkit/struct';

import { Button, Input } from '@foldkit/ui';

import { courseClient } from './course-client';

type CourseInsightResponse = CourseInsightResponseDtoType;
type CourseInsight = CourseInsightResponse['item'];

type ProtocolFact<A> =
  | {
      readonly state: 'known';
      readonly value: A;
      readonly evidenceIds: ReadonlyArray<string>;
    }
  | {
      readonly state: 'unknown' | 'unavailable' | 'suppressed';
      readonly reason: string;
      readonly evidenceIds: ReadonlyArray<string>;
    }
  | {
      readonly state: 'conflicting';
      readonly reason: string;
      readonly candidates: ReadonlyArray<{
        readonly value: A;
        readonly evidenceIds: ReadonlyArray<string>;
      }>;
      readonly evidenceIds: ReadonlyArray<string>;
    };

export const SearchIdle = ts('SearchIdle');
export const SearchLoading = ts('SearchLoading');
export const SearchSuccess = ts('SearchSuccess', { response: S.Any });
export const SearchPartial = ts('SearchPartial', { response: S.Any });
export const SearchFailure = ts('SearchFailure', { error: S.String });

const SearchResult = S.Union([
  SearchIdle,
  SearchLoading,
  SearchSuccess,
  SearchPartial,
  SearchFailure,
]);

type SearchResult =
  | ReturnType<typeof SearchIdle>
  | ReturnType<typeof SearchLoading>
  | { readonly _tag: 'SearchSuccess'; readonly response: CourseInsightResponse }
  | { readonly _tag: 'SearchPartial'; readonly response: CourseInsightResponse }
  | ReturnType<typeof SearchFailure>;

export const Model = S.Struct({
  query: S.String,
  result: SearchResult,
});

type SchemaModel = typeof Model.Type;
export type Model = Omit<SchemaModel, 'result'> & {
  readonly result: SearchResult;
};

export const UpdatedQuery = m('UpdatedQuery', { value: S.String });
export const SubmittedSearch = m('SubmittedSearch');
export const SucceededCourseInsight = m('SucceededCourseInsight', {
  response: S.Any,
});
export const FailedCourseInsight = m('FailedCourseInsight', {
  error: S.String,
});
export const SyncedCourseUrl = m('SyncedCourseUrl');
export const FailedCourseUrlSync = m('FailedCourseUrlSync');

export const Message = S.Union([
  UpdatedQuery,
  SubmittedSearch,
  SucceededCourseInsight,
  FailedCourseInsight,
  SyncedCourseUrl,
  FailedCourseUrlSync,
]);
export type Message = typeof Message.Type;

export const FetchCourseInsight = Command.define(
  'FetchCourseInsight',
  { courseCode: S.String },
  SucceededCourseInsight,
  FailedCourseInsight,
)(({ courseCode }) =>
  courseClient.getInsight(courseCode).pipe(
    Effect.map((response) => SucceededCourseInsight({ response })),
    Effect.catch((error) => Effect.succeed(FailedCourseInsight({ error: error.message }))),
  ),
);

export const SyncCourseUrl = Command.define(
  'SyncCourseUrl',
  { courseCode: S.String },
  SyncedCourseUrl,
  FailedCourseUrlSync,
)(({ courseCode }) =>
  Effect.sync(() => {
    const url = new URL(window.location.href);
    url.searchParams.set('course', courseCode);
    window.history.replaceState(null, '', url);
    return SyncedCourseUrl();
  }),
);

export const update = (
  model: Model,
  message: Message,
): readonly [Model, ReadonlyArray<Command.Command<Message>>] =>
  M.value(message).pipe(
    M.withReturnType<readonly [Model, ReadonlyArray<Command.Command<Message>>]>(),
    M.tagsExhaustive({
      UpdatedQuery: ({ value }) => [
        evo(model, {
          query: () => value,
        }),
        [],
      ],
      SubmittedSearch: () => {
        if (model.result._tag === 'SearchLoading') {
          return [model, []];
        }

        const courseCode = model.query.trim().toUpperCase();
        if (courseCode.length === 0) {
          return [
            evo(model, {
              result: () => SearchFailure({ error: 'Enter an NTNU course code.' }),
            }),
            [],
          ];
        }

        return [
          evo(model, {
            query: () => courseCode,
            result: () => SearchLoading(),
          }),
          [SyncCourseUrl({ courseCode }), FetchCourseInsight({ courseCode })],
        ];
      },
      SucceededCourseInsight: ({ response: unsafeResponse }) => {
        const response = unsafeResponse as CourseInsightResponse;
        return [
          evo(model, {
            result: () =>
              response.meta.partial ? SearchPartial({ response }) : SearchSuccess({ response }),
          }),
          [],
        ];
      },
      FailedCourseInsight: ({ error }) => [
        evo(model, {
          result: () => SearchFailure({ error }),
        }),
        [],
      ],
      SyncedCourseUrl: () => [model, []],
      FailedCourseUrlSync: () => [model, []],
    }),
  );

export const init: Runtime.ApplicationInit<Model, Message> = () => {
  const courseCode =
    typeof window === 'undefined'
      ? ''
      : (new URL(window.location.href).searchParams.get('course') ?? '').trim().toUpperCase();

  return [
    {
      query: courseCode,
      result: courseCode.length === 0 ? SearchIdle() : SearchLoading(),
    },
    courseCode.length === 0 ? [] : [FetchCourseInsight({ courseCode })],
  ];
};

export const view = (model: Model): Document => {
  const h = html<Message>();
  const loading = model.result._tag === 'SearchLoading';

  return {
    title:
      model.result._tag === 'SearchSuccess' || model.result._tag === 'SearchPartial'
        ? `${model.result.response.item.code} · Course lens`
        : 'Course lens · NTNU course decisions',
    body: h.div(
      [h.Class('app-shell')],
      [
        desktopNavigation(),
        h.main(
          [h.Class('main-content')],
          [
            h.header(
              [h.Class('hero')],
              [
                h.p([h.Class('eyebrow')], ['NTNU course decisions']),
                h.h1([], ['Understand a course before you choose it.']),
                h.p(
                  [h.Class('hero__lede')],
                  [
                    'Search an exact course code to combine content, work form, assessment, requirements, and outcomes with explicit evidence.',
                  ],
                ),
                searchForm(model.query, loading),
                h.p([h.Class('search-hint'), h.Id('search-hint')], ['Try a real course: TDT4136']),
              ],
            ),
            resultView(model.result),
          ],
        ),
        mobileNavigation(),
      ],
    ),
  };
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
              h.Href('#explore'),
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
        [h.Href('#explore'), h.Class('bottom-navigation__item'), h.AriaCurrent('page')],
        [h.span([h.AriaHidden(true)], ['⌕']), h.span([], ['Explore'])],
      ),
    ],
  );
};

const searchForm = (query: string, loading: boolean): Html => {
  const h = html<Message>();
  return h.form(
    [
      h.Class('search-form'),
      h.Id('explore'),
      h.OnSubmit(SubmittedSearch()),
      h.AriaDescribedBy('search-hint'),
    ],
    [
      Input.view<Message>({
        id: 'course-code',
        value: query,
        placeholder: 'TDT4136',
        onInput: (value) => UpdatedQuery({ value }),
        isDisabled: loading,
        toView: (attributes) =>
          h.div(
            [h.Class('field')],
            [
              h.label([...attributes.label, h.Class('field__label')], ['Course code']),
              h.input([
                ...attributes.input,
                h.Class('field__input'),
                h.Autocomplete('off'),
                h.InputMode('text'),
                h.AriaLabel('Course code'),
              ]),
            ],
          ),
      }),
      Button.view<Message>({
        type: 'submit',
        isDisabled: loading,
        toView: (attributes) =>
          h.button(
            [...attributes.button, h.Class('button button--primary')],
            [loading ? 'Looking up course…' : 'Find course'],
          ),
      }),
    ],
  );
};

const resultView = (result: SearchResult): Html => {
  const h = html<Message>();

  switch (result._tag) {
    case 'SearchIdle':
      return h.section(
        [h.Class('state-card state-card--idle'), h.AriaLabel('Search guidance')],
        [
          h.div([h.Class('state-card__icon'), h.AriaHidden(true)], ['⌕']),
          h.h2([], ['Start with one course']),
          h.p(
            [],
            [
              'No programme setup or account is needed. Search TDT4136 to inspect the first evidence-backed course view.',
            ],
          ),
        ],
      );
    case 'SearchLoading':
      return h.section(
        [h.Class('state-card state-card--loading'), h.Role('status'), h.AriaLive('polite')],
        [
          h.div([h.Class('loading-indicator'), h.AriaHidden(true)], []),
          h.h2([], ['Gathering course evidence']),
          h.p(
            [],
            [
              'Course details and outcome sources are independent. Available information will remain useful if one source fails.',
            ],
          ),
        ],
      );
    case 'SearchFailure':
      return h.section(
        [h.Class('state-card state-card--failure'), h.Role('alert')],
        [
          h.p([h.Class('status-label status-label--error')], ['Lookup failed']),
          h.h2([], ['We could not load that course']),
          h.p([], [result.error]),
          h.p([], ['Check the course code and try again.']),
        ],
      );
    case 'SearchPartial':
      return courseInsightView(result.response, true);
    case 'SearchSuccess':
      return courseInsightView(result.response, false);
  }
};

const courseInsightView = (response: CourseInsightResponse, partial: boolean): Html => {
  const h = html<Message>();
  const course = response.item;
  const title = course.title.state === 'known' ? course.title.value : 'Course title unavailable';

  return h.article(
    [h.Class('course-detail'), h.AriaLabel(`${course.code} course details`)],
    [
      partial
        ? h.div(
            [h.Class('partial-banner'), h.Role('status'), h.AriaLive('polite')],
            [
              h.p([h.Class('status-label status-label--warning')], ['Partial result']),
              h.p(
                [],
                [
                  'One source is unavailable. Course details from other sources are still shown, and missing outcomes are not treated as zero.',
                ],
              ),
            ],
          )
        : h.div(
            [h.Class('complete-banner'), h.Role('status')],
            ['All configured sources responded.'],
          ),
      h.header(
        [h.Class('course-header')],
        [
          h.div([], [h.p([h.Class('course-code')], [course.code]), h.h2([], [title])]),
          h.div(
            [h.Class('course-header__facts')],
            [
              compactFact('Credits', course.credits, (value) => `${value}`),
              compactFact('Level', course.level, formatToken),
              compactFact('Language', course.teachingLanguage, String),
            ],
          ),
          evidenceLinks(course.title.evidenceIds),
        ],
      ),
      decisionSection('Availability', 'When and where the course is offered.', [
        factView('Teaching term and location', course.offerings, (offerings) =>
          offeringList(offerings),
        ),
      ]),
      decisionSection('What you will learn', 'Course content and intended learning outcomes.', [
        factView('Content', course.content, paragraph),
        factView('Learning outcomes', course.learningOutcomes, paragraph),
      ]),
      decisionSection(
        'How the course works',
        'Teaching, collaboration, attendance, and participation evidence.',
        [
          factView('Teaching methods', course.teachingMethods, paragraph),
          factView('Work forms', course.workForms, (forms) => chipList(forms.map(formatToken))),
          factView('Collaboration', course.collaboration, (value) => paragraph(formatToken(value))),
          factView('Attendance', course.attendance, (value) => paragraph(formatToken(value))),
          factView('Online participation', course.onlineParticipation, (value) =>
            paragraph(formatToken(value)),
          ),
        ],
      ),
      decisionSection(
        'Assessment and obligatory work',
        'What counts toward the grade and what must be approved first.',
        [
          factView('Assessment', course.assessment, assessmentList),
          factView('Obligatory activities', course.obligatoryActivities, (items) =>
            stringList(items),
          ),
        ],
      ),
      decisionSection('Requirements', 'Recommended background and access constraints.', [
        factView('Prerequisites', course.prerequisites, paragraph),
        factView('Access restrictions', course.accessRestrictions, paragraph),
      ]),
      gradeSection(course),
      sourceSection(course),
    ],
  );
};

const compactFact = <A>(
  label: string,
  fact: ProtocolFact<A>,
  format: (value: A) => string,
): Html => {
  const h = html<Message>();
  return h.div(
    [h.Class('compact-fact')],
    [
      h.dt([], [label]),
      h.dd(
        [],
        [
          fact.state === 'known'
            ? format(fact.value)
            : fact.state === 'conflicting'
              ? 'Conflicting'
              : formatToken(fact.state),
        ],
      ),
    ],
  );
};

const decisionSection = (title: string, description: string, facts: ReadonlyArray<Html>): Html => {
  const h = html<Message>();
  return h.section(
    [h.Class('decision-section')],
    [
      h.header([h.Class('section-heading')], [h.h2([], [title]), h.p([], [description])]),
      h.div([h.Class('fact-grid')], [...facts]),
    ],
  );
};

const factView = <A>(
  label: string,
  fact: ProtocolFact<A>,
  renderKnown: (value: A) => Html,
): Html => {
  const h = html<Message>();

  if (fact.state === 'known') {
    return h.div(
      [h.Class('fact-card')],
      [h.h3([], [label]), renderKnown(fact.value), evidenceLinks(fact.evidenceIds)],
    );
  }

  if (fact.state === 'conflicting') {
    return h.div(
      [h.Class('fact-card fact-card--uncertain')],
      [
        h.div(
          [h.Class('fact-card__heading')],
          [
            h.h3([], [label]),
            h.span([h.Class('fact-state fact-state--conflicting')], ['Conflicting']),
          ],
        ),
        h.p([], [fact.reason]),
        h.ul(
          [h.Class('candidate-list')],
          fact.candidates.map((candidate) =>
            h.li([], [renderKnown(candidate.value), evidenceLinks(candidate.evidenceIds)]),
          ),
        ),
        evidenceLinks(fact.evidenceIds),
      ],
    );
  }

  return h.div(
    [h.Class('fact-card fact-card--uncertain')],
    [
      h.div(
        [h.Class('fact-card__heading')],
        [
          h.h3([], [label]),
          h.span([h.Class(`fact-state fact-state--${fact.state}`)], [formatToken(fact.state)]),
        ],
      ),
      h.p([], [fact.reason]),
      evidenceLinks(fact.evidenceIds),
    ],
  );
};

const gradeSection = (course: CourseInsight): Html => {
  const h = html<Message>();
  const grades = course.gradeOutcomes;

  return h.section(
    [h.Class('decision-section')],
    [
      h.header(
        [h.Class('section-heading')],
        [
          h.h2([], ['Grade outcomes']),
          h.p(
            [],
            [
              'Historical outcomes describe past cohorts; they do not predict an individual result.',
            ],
          ),
        ],
      ),
      h.div(
        [h.Class('fact-grid fact-grid--metrics')],
        [
          factView('Covered period', grades.period, (period) =>
            paragraph(`${period.fromYear}–${period.toYear}`),
          ),
          factView('Sample size', grades.sampleSize, (value) => paragraph(`${value} results`)),
          factView('Failure rate', grades.failureRatePercent, (value) => paragraph(`${value}%`)),
          factView('Average grade', grades.averageGrade, paragraph),
          factView('Median grade', grades.medianGrade, paragraph),
        ],
      ),
      factView('Grade distribution', grades.distribution, gradeDistribution),
    ],
  );
};

const gradeDistribution = (
  distribution: CourseInsight['gradeOutcomes']['distribution'] extends ProtocolFact<infer A>
    ? A
    : never,
): Html => {
  const h = html<Message>();
  return h.div(
    [h.Class('table-wrap')],
    [
      h.table(
        [],
        [
          h.caption([h.Class('visually-hidden')], ['Historical grade distribution']),
          h.thead(
            [],
            [
              h.tr(
                [],
                [
                  h.th([h.Scope('col')], ['Grade']),
                  h.th([h.Scope('col')], ['Count']),
                  h.th([h.Scope('col')], ['Share']),
                ],
              ),
            ],
          ),
          h.tbody(
            [],
            distribution.map((bucket) =>
              h.tr(
                [],
                [
                  h.th([h.Scope('row')], [bucket.grade]),
                  h.td([], [`${bucket.count}`]),
                  h.td([], [`${bucket.percentage}%`]),
                ],
              ),
            ),
          ),
        ],
      ),
    ],
  );
};

const sourceSection = (course: CourseInsight): Html => {
  const h = html<Message>();
  return h.section(
    [h.Class('decision-section sources-section')],
    [
      h.header(
        [h.Class('section-heading')],
        [
          h.h2([], ['Sources and freshness']),
          h.p(
            [],
            [
              'Each fact links to the live source capture or derivation used for this response. Fixture data is labelled explicitly.',
            ],
          ),
        ],
      ),
      h.div(
        [h.Class('source-statuses')],
        course.sourceStatuses.map((source) =>
          h.div(
            [h.Class(`source-status source-status--${source.status}`)],
            [
              h.div(
                [],
                [
                  h.h3([], [source.provider]),
                  h.span([h.Class('fact-state')], [formatToken(source.status)]),
                ],
              ),
              source.observedAt === null
                ? h.p([], ['No observation time'])
                : h.p([], [`Observed ${formatTimestamp(source.observedAt)}`]),
              source.warning === null ? h.empty : h.p([], [source.warning]),
            ],
          ),
        ),
      ),
      h.ol(
        [h.Class('evidence-list')],
        course.evidence.map((evidence) =>
          h.li(
            [h.Id(`evidence-${evidence.id}`)],
            [
              h.div(
                [h.Class('evidence-list__heading')],
                [
                  h.strong([], [evidence.provider]),
                  h.span([h.Class('fact-state')], [formatToken(evidence.kind)]),
                ],
              ),
              h.p(
                [],
                [
                  `${evidence.sourcePeriod ?? 'No source period'} · observed ${formatTimestamp(evidence.observedAt)}`,
                ],
              ),
              evidence.excerpt === null ? h.empty : h.p([], [evidence.excerpt]),
              evidence.sourceUrl === null
                ? h.span([h.Class('source-unlinked')], ['No external source link'])
                : h.a(
                    [
                      h.Href(evidence.sourceUrl),
                      h.Target('_blank'),
                      h.Rel('noreferrer'),
                      h.Class('source-link'),
                    ],
                    ['Open source ↗'],
                  ),
            ],
          ),
        ),
      ),
    ],
  );
};

const evidenceLinks = (evidenceIds: ReadonlyArray<string>): Html => {
  const h = html<Message>();
  if (evidenceIds.length === 0) {
    return h.span([h.Class('evidence-empty')], ['No supporting evidence']);
  }
  return h.div(
    [h.Class('evidence-links'), h.AriaLabel('Supporting evidence')],
    [
      ...evidenceIds.map((id) =>
        h.a([h.Href(`#evidence-${id}`), h.AriaLabel(`View evidence ${id}`)], ['View evidence']),
      ),
    ],
  );
};

const offeringList = (
  offerings: CourseInsight['offerings'] extends ProtocolFact<infer A> ? A : never,
): Html =>
  stringList(
    offerings.map((offering) => {
      const location =
        offering.campuses.length === 0 ? 'Campus not reported' : offering.campuses.join(', ');
      const delivery =
        offering.deliveryModes.length === 0
          ? 'Delivery mode unknown'
          : offering.deliveryModes.map(formatToken).join(', ');
      return `${formatToken(offering.season)} ${offering.academicYear} · ${location} · ${delivery}`;
    }),
  );

const assessmentList = (
  assessment: CourseInsight['assessment'] extends ProtocolFact<infer A> ? A : never,
): Html => {
  const h = html<Message>();
  return h.ul(
    [h.Class('plain-list')],
    assessment.map((part) =>
      h.li(
        [],
        [
          h.strong([], [formatToken(part.form)]),
          h.span(
            [],
            [
              ` — ${part.description}${part.weightPercent === null ? '' : ` · ${part.weightPercent}%`}${part.duration === null ? '' : ` · ${part.duration}`}`,
            ],
          ),
        ],
      ),
    ),
  );
};

const paragraph = (value: string): Html => {
  const h = html<Message>();
  return h.p([], [value]);
};

const stringList = (items: ReadonlyArray<string>): Html => {
  const h = html<Message>();
  if (items.length === 0) {
    return h.p([], ['None reported.']);
  }
  return h.ul(
    [h.Class('plain-list')],
    items.map((item) => h.li([], [item])),
  );
};

const chipList = (items: ReadonlyArray<string>): Html => {
  const h = html<Message>();
  return h.ul(
    [h.Class('chip-list')],
    items.map((item) => h.li([], [item])),
  );
};

const formatToken = (value: string): string =>
  value
    .split('-')
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join(' ');

const formatTimestamp = (value: string): string =>
  new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeZone: 'Europe/Oslo',
  }).format(new Date(value));
