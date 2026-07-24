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
import { localeTag, translate, translateToken, type Locale } from './i18n';
import { collaborationIconName, icon, termSeasonIconName } from './icons';
import { desktopNavigation, mobileNavigation } from './navigation';

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

const mainContentClass =
  'w-[min(100%,76rem)] mx-auto pt-4 px-4 pb-[calc(7rem+env(safe-area-inset-bottom))] [@media(min-width:48rem)_and_(min-height:34rem)]:w-[min(calc(100%-16.5rem),76rem)] [@media(min-width:48rem)_and_(min-height:34rem)]:pt-4 [@media(min-width:48rem)_and_(min-height:34rem)]:px-6 [@media(min-width:48rem)_and_(min-height:34rem)]:pb-20 [@media(min-width:48rem)_and_(min-height:34rem)]:ml-66 [@media(min-width:64rem)]:px-10';

const eyebrowClass = 'mb-2 text-primary text-[0.78rem] font-[800] tracking-[0.1em] uppercase';

const fieldLabelClass =
  'block mt-0 mr-0 mb-[0.4rem] ml-1 text-on-surface-variant text-[0.85rem] font-[650]';

const fieldInputClass =
  'w-full min-h-14 px-4 border border-outline rounded-m3-medium outline-0 bg-surface-container-low text-on-surface text-[1.05rem] uppercase [transition:border-color_140ms_ease,box-shadow_140ms_ease] focus-visible:border-primary focus-visible:shadow-[0_0_0_3px_var(--md-sys-color-primary-container)] disabled:opacity-70';

const buttonPrimaryClass =
  'min-h-14 px-5 border-0 rounded-[1.75rem] bg-primary text-on-primary shadow-m3-1 font-[720] cursor-pointer [transition:box-shadow_140ms_ease,transform_140ms_ease] not-data-[disabled]:hover:shadow-m3-2 not-data-[disabled]:hover:-translate-y-px data-[disabled]:cursor-wait data-[disabled]:opacity-[0.65] focus-visible:outline-3 focus-visible:outline-tertiary focus-visible:outline-offset-[3px] [@media(max-width:37rem)]:w-full';

const stateCardClass =
  'grid min-h-68 place-items-center content-center p-[clamp(2rem,6vw,4rem)] border border-outline-variant rounded-m3-extra-large bg-surface-container-low text-center [&_h2]:mt-3 [&_h2]:mb-2 [&_h2]:text-[clamp(1.4rem,3vw,2rem)] [&_p]:max-w-144 [&_p]:mx-auto [&_p]:my-1 [&_p]:text-on-surface-variant [&_p]:leading-[1.6]';

const stateCardFailureClass =
  'grid min-h-68 place-items-center content-center p-[clamp(2rem,6vw,4rem)] border border-error rounded-m3-extra-large bg-error-container text-on-error-container text-center [&_h2]:mt-3 [&_h2]:mb-2 [&_h2]:text-[clamp(1.4rem,3vw,2rem)] [&_p]:max-w-144 [&_p]:mx-auto [&_p]:my-1 [&_p]:text-inherit [&_p]:leading-[1.6]';

const decisionSectionClass =
  'p-[clamp(1.25rem,4vw,2.25rem)] border border-outline-variant rounded-m3-large bg-surface-container-low';

const sectionHeadingClass =
  'grid gap-[0.35rem] mb-5 [&_h2]:m-0 [&_h2]:text-[clamp(1.35rem,3vw,1.8rem)] [&_h2]:tracking-[-0.025em] [&_p]:max-w-192 [&_p]:m-0 [&_p]:text-on-surface-variant [&_p]:leading-[1.5]';

const factGridClass = 'grid gap-3 grid-cols-[repeat(auto-fit,minmax(min(100%,18rem),1fr))]';

const factCardClass =
  'min-w-0 p-4 rounded-m3-medium bg-surface [&_h3]:mt-0 [&_h3]:mr-0 [&_h3]:mb-[0.55rem] [&_h3]:ml-0 [&_h3]:text-[0.95rem] [&_p]:my-1 [&_p]:mx-0 [&_p]:text-on-surface-variant [&_p]:leading-[1.55]';

const factCardUncertainClass =
  'min-w-0 p-4 border border-dashed border-outline rounded-m3-medium bg-surface [&_h3]:mt-0 [&_h3]:mr-0 [&_h3]:mb-[0.55rem] [&_h3]:ml-0 [&_h3]:text-[0.95rem] [&_p]:my-1 [&_p]:mx-0 [&_p]:text-on-surface-variant [&_p]:leading-[1.55]';

const factStateClass =
  'inline-flex items-center min-h-[1.7rem] py-[0.2rem] px-[0.65rem] rounded-[1rem] bg-surface-container-highest text-on-surface-variant text-[0.72rem] font-[750] whitespace-nowrap';

const uncertainFactStateClass =
  'inline-flex items-center min-h-[1.7rem] py-[0.2rem] px-[0.65rem] rounded-[1rem] bg-tertiary-container text-on-tertiary-container text-[0.72rem] font-[750] whitespace-nowrap';

export const view = (model: Model): Document => {
  const h = html<Message>();
  const loading = model.result._tag === 'SearchLoading';

  return {
    title:
      model.result._tag === 'SearchSuccess' || model.result._tag === 'SearchPartial'
        ? `${model.result.response.item.code} · Course lens`
        : 'Course lens · NTNU course decisions',
    body: h.div(
      [h.Class('min-h-screen')],
      [
        desktopNavigation<Message>(),
        h.main(
          [h.Class(mainContentClass)],
          [
            h.header(
              [h.Class('py-[clamp(2rem,7vw,5rem)]')],
              [
                h.p([h.Class(eyebrowClass)], ['NTNU course decisions']),
                h.h1(
                  [
                    h.Class(
                      'max-w-[15ch] m-0 text-[clamp(2.25rem,7vw,4.75rem)] font-[720] tracking-[-0.055em] leading-[0.99]',
                    ),
                  ],
                  ['Understand a course before you choose it.'],
                ),
                h.p(
                  [
                    h.Class(
                      'max-w-172 mt-5 mr-0 mb-8 ml-0 text-on-surface-variant text-[clamp(1rem,2vw,1.15rem)] leading-[1.65]',
                    ),
                  ],
                  [
                    'Search an exact course code to combine content, work form, assessment, requirements, and outcomes with explicit evidence.',
                  ],
                ),
                searchForm(model.query, loading),
                h.p(
                  [
                    h.Class('mt-[0.65rem] mr-0 mb-0 ml-1 text-on-surface-variant text-[0.85rem]'),
                    h.Id('search-hint'),
                  ],
                  ['Try a real course: TDT4136'],
                ),
              ],
            ),
            resultView(model.result),
          ],
        ),
        mobileNavigation<Message>(),
      ],
    ),
  };
};

const searchForm = (query: string, loading: boolean): Html => {
  const h = html<Message>();
  return h.form(
    [
      h.Class(
        'flex items-end gap-3 w-[min(100%,39rem)] [@media(max-width:37rem)]:items-stretch [@media(max-width:37rem)]:flex-col',
      ),
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
            [h.Class('flex-1')],
            [
              h.label([...attributes.label, h.Class(fieldLabelClass)], ['Course code']),
              h.input([
                ...attributes.input,
                h.Class(fieldInputClass),
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
            [...attributes.button, h.Class(buttonPrimaryClass)],
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
        [h.Class(stateCardClass), h.AriaLabel('Search guidance')],
        [
          h.div(
            [
              h.Class(
                'grid size-16 place-items-center rounded-[1.25rem] bg-tertiary-container text-on-tertiary-container text-[2rem]',
              ),
              h.AriaHidden(true),
            ],
            ['⌕'],
          ),
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
        [h.Class(stateCardClass), h.Role('status'), h.AriaLive('polite')],
        [
          h.div(
            [
              h.Class(
                'size-12 border-[0.3rem] border-primary-container border-t-primary rounded-full animate-[spin_850ms_linear_infinite] motion-reduce:[animation-duration:1.8s]',
              ),
              h.AriaHidden(true),
            ],
            [],
          ),
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
        [h.Class(stateCardFailureClass), h.Role('alert')],
        [
          h.p(
            [h.Class('mb-2 text-error text-[0.78rem] font-[800] tracking-[0.1em] uppercase')],
            ['Lookup failed'],
          ),
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

export const courseInsightView = (
  response: CourseInsightResponse,
  partial: boolean,
  locale: Locale = 'en',
): Html => {
  const h = html<Message>();
  const course = response.item;
  const title =
    course.title.state === 'known'
      ? course.title.value
      : translate(locale, 'detail.titleUnavailable');
  const inferenceEvidenceIds = new Set(
    course.evidence
      .filter((evidence) => evidence.kind === 'inference')
      .map((evidence) => evidence.id),
  );
  const decisionFact = <A>(
    label: string,
    fact: ProtocolFact<A>,
    renderKnown: (value: A) => Html,
  ): Html => factView(label, fact, renderKnown, locale, inferenceEvidenceIds);

  return h.article(
    [h.Class('grid gap-4'), h.AriaLabel(translate(locale, 'detail.aria', { code: course.code }))],
    [
      partial
        ? h.div(
            [
              h.Class(
                'py-4 px-5 rounded-m3-medium bg-warning-container text-on-warning-container [&_p]:m-0 [&_p]:leading-[1.5]',
              ),
              h.Role('status'),
              h.AriaLive('polite'),
            ],
            [
              h.p(
                [
                  h.Class(
                    'mb-1! text-warning text-[0.78rem] font-[800] tracking-[0.1em] uppercase',
                  ),
                ],
                [translate(locale, 'detail.partial')],
              ),
              h.p([], [translate(locale, 'detail.partialHelp')]),
            ],
          )
        : h.div(
            [
              h.Class(
                'py-4 px-5 rounded-m3-medium bg-primary-container text-on-primary-container font-[650] leading-[1.5]',
              ),
              h.Role('status'),
            ],
            [translate(locale, 'detail.complete')],
          ),
      h.header(
        [
          h.Class(
            'grid gap-6 p-[clamp(1.5rem,5vw,3rem)] rounded-m3-extra-large bg-primary text-on-primary [@media(min-width:64rem)]:grid-cols-[minmax(0,1fr)_auto]',
          ),
        ],
        [
          h.div(
            [
              h.Class(
                '[&_h2]:max-w-[22ch] [&_h2]:m-0 [&_h2]:text-[clamp(2rem,5vw,3.75rem)] [&_h2]:tracking-[-0.045em] [&_h2]:leading-[1.05]',
              ),
            ],
            [
              h.p(
                [
                  h.Class(
                    'mb-2 text-on-primary text-[0.78rem] font-[800] tracking-[0.1em] uppercase',
                  ),
                ],
                [course.code],
              ),
              h.h2([], [title]),
            ],
          ),
          h.dl(
            [h.Class('flex flex-wrap gap-3 m-0')],
            [
              compactFact(
                translate(locale, 'detail.credits'),
                course.credits,
                (value) => `${value}`,
                locale,
              ),
              compactFact(
                translate(locale, 'detail.level'),
                course.level,
                (value) => translateToken(locale, value),
                locale,
              ),
              compactFact(
                translate(locale, 'detail.language'),
                course.teachingLanguage,
                String,
                locale,
              ),
            ],
          ),
          evidenceLinks(
            course.title.evidenceIds,
            locale,
            'text-on-primary [&_a]:text-on-primary [@media(min-width:64rem)]:col-span-full',
          ),
        ],
      ),
      decisionSection(
        translate(locale, 'detail.availability'),
        translate(locale, 'detail.availabilityHelp'),
        [
          decisionFact(translate(locale, 'detail.termLocation'), course.offerings, (offerings) =>
            offeringList(offerings, locale),
          ),
        ],
      ),
      decisionSection(translate(locale, 'detail.learn'), translate(locale, 'detail.learnHelp'), [
        decisionFact(translate(locale, 'detail.content'), course.content, paragraph),
        decisionFact(
          translate(locale, 'detail.learningOutcomes'),
          course.learningOutcomes,
          paragraph,
        ),
      ]),
      decisionSection(translate(locale, 'detail.works'), translate(locale, 'detail.worksHelp'), [
        decisionFact(
          translate(locale, 'detail.teachingMethods'),
          course.teachingMethods,
          paragraph,
        ),
        decisionFact(translate(locale, 'detail.workForms'), course.workForms, (forms) =>
          chipList(forms.map((form) => translateToken(locale, form))),
        ),
        decisionFact(translate(locale, 'detail.collaboration'), course.collaboration, (value) =>
          collaborationPill(value, locale),
        ),
        decisionFact(translate(locale, 'detail.attendance'), course.attendance, (value) =>
          paragraph(translateToken(locale, value)),
        ),
        decisionFact(translate(locale, 'detail.online'), course.onlineParticipation, (value) =>
          paragraph(translateToken(locale, value)),
        ),
      ]),
      decisionSection(
        translate(locale, 'detail.assessment'),
        translate(locale, 'detail.assessmentHelp'),
        [
          decisionFact(translate(locale, 'detail.assessmentFact'), course.assessment, (parts) =>
            assessmentList(parts, locale),
          ),
          decisionFact(
            translate(locale, 'detail.obligatory'),
            course.obligatoryActivities,
            (items) => obligatoryActivityList(items, locale),
          ),
        ],
      ),
      decisionSection(
        translate(locale, 'detail.requirements'),
        translate(locale, 'detail.requirementsHelp'),
        [
          decisionFact(translate(locale, 'detail.prerequisites'), course.prerequisites, paragraph),
          decisionFact(translate(locale, 'detail.access'), course.accessRestrictions, paragraph),
        ],
      ),
      gradeSection(course, locale),
      sourceSection(course, locale),
    ],
  );
};

const compactFact = <A>(
  label: string,
  fact: ProtocolFact<A>,
  format: (value: A) => string,
  locale: Locale,
): Html => {
  const h = html<Message>();
  return h.div(
    [
      h.Class(
        'min-w-28 py-3 px-4 border border-[color-mix(in_srgb,currentcolor_35%,transparent)] rounded-m3-medium [&_dt]:mb-[0.2rem] [&_dt]:text-xs [&_dt]:opacity-80 [&_dd]:m-0 [&_dd]:font-[750]',
      ),
    ],
    [
      h.dt([], [label]),
      h.dd(
        [],
        [
          fact.state === 'known'
            ? format(fact.value)
            : fact.state === 'conflicting'
              ? translate(locale, 'detail.conflicting')
              : translateToken(locale, fact.state),
        ],
      ),
    ],
  );
};

const decisionSection = (title: string, description: string, facts: ReadonlyArray<Html>): Html => {
  const h = html<Message>();
  return h.section(
    [h.Class(decisionSectionClass)],
    [
      h.header([h.Class(sectionHeadingClass)], [h.h2([], [title]), h.p([], [description])]),
      h.div([h.Class(factGridClass)], [...facts]),
    ],
  );
};

const factView = <A>(
  label: string,
  fact: ProtocolFact<A>,
  renderKnown: (value: A) => Html,
  locale: Locale,
  inferenceEvidenceIds: ReadonlySet<string> = new Set(),
): Html => {
  const h = html<Message>();

  if (fact.state === 'known') {
    const inferred =
      fact.evidenceIds.length > 0 &&
      fact.evidenceIds.every((evidenceId) => inferenceEvidenceIds.has(evidenceId));
    return h.div(
      [h.Class(factCardClass)],
      [
        h.div(
          [h.Class('flex items-start justify-between gap-3')],
          [
            h.h3([], [label]),
            inferred
              ? h.span([h.Class(uncertainFactStateClass)], [translate(locale, 'detail.inferred')])
              : h.empty,
          ],
        ),
        renderKnown(fact.value),
        evidenceLinks(fact.evidenceIds, locale),
      ],
    );
  }

  if (fact.state === 'conflicting') {
    return h.div(
      [h.Class(factCardUncertainClass)],
      [
        h.div(
          [h.Class('flex items-start justify-between gap-3')],
          [
            h.h3([], [label]),
            h.span([h.Class(uncertainFactStateClass)], [translate(locale, 'detail.conflicting')]),
          ],
        ),
        h.p([], [fact.reason]),
        h.ul(
          [
            h.Class(
              'mt-[0.35rem] mr-0 mb-0 ml-0 pl-[1.2rem] [&_li]:my-[0.35rem] [&_li]:leading-[1.5]',
            ),
          ],
          fact.candidates.map((candidate) =>
            h.li([], [renderKnown(candidate.value), evidenceLinks(candidate.evidenceIds, locale)]),
          ),
        ),
        evidenceLinks(fact.evidenceIds, locale),
      ],
    );
  }

  return h.div(
    [h.Class(factCardUncertainClass)],
    [
      h.div(
        [h.Class('flex items-start justify-between gap-3')],
        [
          h.h3([], [label]),
          h.span([h.Class(uncertainFactStateClass)], [translateToken(locale, fact.state)]),
        ],
      ),
      h.p([], [fact.reason]),
      evidenceLinks(fact.evidenceIds, locale),
    ],
  );
};

const gradeSection = (course: CourseInsight, locale: Locale): Html => {
  const h = html<Message>();
  const grades = course.gradeOutcomes;

  return h.section(
    [h.Class(decisionSectionClass)],
    [
      h.header(
        [h.Class(sectionHeadingClass)],
        [
          h.h2([], [translate(locale, 'detail.gradeOutcomes')]),
          h.p([], [translate(locale, 'detail.gradeHelp')]),
        ],
      ),
      h.div(
        [h.Class(`${factGridClass} mb-3`)],
        [
          factView(
            translate(locale, 'detail.coveredPeriod'),
            grades.period,
            (period) => paragraph(`${period.fromYear}–${period.toYear}`),
            locale,
          ),
          factView(
            translate(locale, 'detail.sampleSize'),
            grades.sampleSize,
            (value) =>
              paragraph(
                translate(locale, 'detail.results', {
                  count: value.toLocaleString(localeTag(locale)),
                }),
              ),
            locale,
          ),
          factView(
            translate(locale, 'detail.failureRate'),
            grades.failureRatePercent,
            (value) =>
              paragraph(
                new Intl.NumberFormat(localeTag(locale), {
                  style: 'percent',
                  maximumFractionDigits: 1,
                }).format(value / 100),
              ),
            locale,
          ),
          factView(
            translate(locale, 'detail.averageGrade'),
            grades.averageGrade,
            paragraph,
            locale,
          ),
          factView(translate(locale, 'detail.medianGrade'), grades.medianGrade, paragraph, locale),
        ],
      ),
      factView(
        translate(locale, 'detail.distribution'),
        grades.distribution,
        (distribution) => gradeDistribution(distribution, locale),
        locale,
      ),
    ],
  );
};

const gradeDistribution = (
  distribution: CourseInsight['gradeOutcomes']['distribution'] extends ProtocolFact<infer A>
    ? A
    : never,
  locale: Locale,
): Html => {
  const h = html<Message>();
  return h.div(
    [h.Class('overflow-x-auto')],
    [
      h.table(
        [
          h.Class(
            'w-full border-collapse [&_th]:py-[0.65rem] [&_th]:px-3 [&_th]:border-b [&_th]:border-outline-variant [&_th]:text-left [&_td]:py-[0.65rem] [&_td]:px-3 [&_td]:border-b [&_td]:border-outline-variant [&_td]:text-left [&_thead_th]:text-on-surface-variant [&_thead_th]:text-[0.78rem]',
          ),
        ],
        [
          h.caption([h.Class('sr-only')], [translate(locale, 'detail.distributionCaption')]),
          h.thead(
            [],
            [
              h.tr(
                [],
                [
                  h.th([h.Scope('col')], [translate(locale, 'detail.grade')]),
                  h.th([h.Scope('col')], [translate(locale, 'detail.count')]),
                  h.th([h.Scope('col')], [translate(locale, 'detail.share')]),
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

const sourceSection = (course: CourseInsight, locale: Locale): Html => {
  const h = html<Message>();
  return h.section(
    [h.Class(decisionSectionClass)],
    [
      h.header(
        [h.Class(sectionHeadingClass)],
        [
          h.h2([], [translate(locale, 'detail.sources')]),
          h.p([], [translate(locale, 'detail.sourcesHelp')]),
        ],
      ),
      h.div(
        [h.Class('grid gap-3 grid-cols-[repeat(auto-fit,minmax(min(100%,20rem),1fr))]')],
        course.sourceStatuses.map((source) =>
          h.div(
            [
              h.Class(
                source.status === 'failed'
                  ? 'p-4 border-l-[0.3rem] border-l-error rounded-m3-medium bg-surface [&_h3]:m-0 [&_h3]:text-[0.95rem] [&_p]:mt-[0.45rem] [&_p]:mr-0 [&_p]:mb-0 [&_p]:ml-0 [&_p]:text-on-surface-variant [&_p]:text-[0.85rem] [&_p]:leading-[1.45]'
                  : 'p-4 border-l-[0.3rem] border-l-primary rounded-m3-medium bg-surface [&_h3]:m-0 [&_h3]:text-[0.95rem] [&_p]:mt-[0.45rem] [&_p]:mr-0 [&_p]:mb-0 [&_p]:ml-0 [&_p]:text-on-surface-variant [&_p]:text-[0.85rem] [&_p]:leading-[1.45]',
              ),
            ],
            [
              h.div(
                [h.Class('flex items-start justify-between gap-3')],
                [
                  h.h3([], [source.provider]),
                  h.span([h.Class(factStateClass)], [translateToken(locale, source.status)]),
                ],
              ),
              source.observedAt === null
                ? h.p([], [translate(locale, 'detail.noObservation')])
                : h.p(
                    [],
                    [
                      translate(locale, 'detail.observed', {
                        date: formatTimestamp(source.observedAt, locale),
                      }),
                    ],
                  ),
              source.warning === null ? h.empty : h.p([], [source.warning]),
            ],
          ),
        ),
      ),
      h.ol(
        [h.Class('grid gap-3 mt-5 mr-0 mb-0 ml-0 p-0 list-none')],
        course.evidence.map((evidence) =>
          h.keyed('li')(
            evidence.id,
            [
              h.Id(`evidence-${evidence.id}`),
              h.Class(
                'scroll-mt-4 p-4 rounded-m3-medium bg-surface-container [&_p]:my-[0.45rem] [&_p]:mx-0 [&_p]:text-on-surface-variant [&_p]:text-[0.85rem] [&_p]:leading-[1.5]',
              ),
            ],
            [
              h.div(
                [h.Class('flex items-start justify-between gap-3')],
                [
                  h.strong([], [evidence.provider]),
                  h.span([h.Class(factStateClass)], [translateToken(locale, evidence.kind)]),
                ],
              ),
              h.p(
                [],
                [
                  translate(locale, 'detail.observedInline', {
                    period: evidence.sourcePeriod ?? translate(locale, 'detail.noSourcePeriod'),
                    date: formatTimestamp(evidence.observedAt, locale),
                  }),
                ],
              ),
              evidence.excerpt === null ? h.empty : h.p([], [evidence.excerpt]),
              evidence.sourceUrl === null
                ? h.span(
                    [h.Class('text-on-surface-variant text-[0.82rem] italic')],
                    [translate(locale, 'detail.noExternalLink')],
                  )
                : h.a(
                    [
                      h.Href(evidence.sourceUrl),
                      h.Target('_blank'),
                      h.Rel('noreferrer'),
                      h.Class('text-[0.82rem]'),
                    ],
                    [translate(locale, 'detail.openSource')],
                  ),
            ],
          ),
        ),
      ),
    ],
  );
};

const evidenceLinks = (
  evidenceIds: ReadonlyArray<string>,
  locale: Locale,
  contextClass = '',
): Html => {
  const h = html<Message>();
  if (evidenceIds.length === 0) {
    return h.span(
      [h.Class(`text-on-surface-variant text-xs italic ${contextClass}`)],
      [translate(locale, 'detail.noEvidence')],
    );
  }
  return h.div(
    [
      h.Class(
        `flex flex-wrap gap-[0.4rem] mt-[0.8rem] text-xs [&_a]:underline-offset-[0.2rem] ${contextClass}`,
      ),
      h.AriaLabel(translate(locale, 'detail.supportingEvidence')),
    ],
    [
      ...evidenceIds.map((id) =>
        h.a(
          [
            h.Href(`#evidence-${id}`),
            h.AriaLabel(translate(locale, 'detail.viewEvidenceLabel', { id })),
          ],
          [translate(locale, 'detail.viewEvidence')],
        ),
      ),
    ],
  );
};

const offeringList = (
  offerings: CourseInsight['offerings'] extends ProtocolFact<infer A> ? A : never,
  locale: Locale,
): Html => {
  const h = html<Message>();
  if (offerings.length === 0) {
    return h.p([], [translate(locale, 'detail.noneReported')]);
  }
  return h.ul(
    [h.Class('mt-[0.35rem] mr-0 mb-0 ml-0 grid gap-2 p-0 list-none [&_li]:leading-[1.5]')],
    offerings.map((offering) => {
      const location =
        offering.campuses.length === 0
          ? translate(locale, 'course.campusUnreported')
          : offering.campuses.join(', ');
      const delivery =
        offering.deliveryModes.length === 0
          ? translate(locale, 'detail.deliveryUnknown')
          : offering.deliveryModes.map((mode) => translateToken(locale, mode)).join(', ');
      const label = `${formatOfferingPeriod(offering.academicYear, offering.season, locale)} · ${location} · ${delivery}`;
      return h.li(
        [h.Class('flex items-start gap-2')],
        [
          icon<Message>(
            termSeasonIconName(offering.season),
            'mt-0.5 block size-4 flex-none text-primary [&_svg]:block [&_svg]:size-full',
          ),
          h.span([], [label]),
        ],
      );
    }),
  );
};

const assessmentList = (
  assessment: CourseInsight['assessment'] extends ProtocolFact<infer A> ? A : never,
  locale: Locale,
): Html => {
  const h = html<Message>();
  const formatWeight = (value: number): string =>
    new Intl.NumberFormat(localeTag(locale), { maximumFractionDigits: 2 }).format(value);
  return h.ul(
    [h.Class('mt-[0.35rem] mr-0 mb-0 ml-0 pl-[1.2rem] [&_li]:my-[0.35rem] [&_li]:leading-[1.5]')],
    assessment.map((part) =>
      h.li(
        [],
        [
          h.strong([], [translateToken(locale, part.form)]),
          h.span(
            [],
            [
              ` — ${part.description}${part.weightPercent.state === 'known' ? ` · ${formatWeight(part.weightPercent.value)}%` : ''}${part.duration.state === 'known' ? ` · ${part.duration.value}` : ''}`,
            ],
          ),
        ],
      ),
    ),
  );
};

const obligatoryActivityList = (
  activities: CourseInsight['obligatoryActivities'] extends ProtocolFact<infer A> ? A : never,
  locale: Locale,
): Html => {
  const h = html<Message>();
  if (activities.length === 0) {
    return h.p([], [translate(locale, 'detail.noneReported')]);
  }
  return h.div(
    [h.Class('grid gap-3')],
    [
      h.p(
        [h.Class('m-0 text-sm font-[750] text-on-surface-variant')],
        [
          `${translate(locale, 'signals.required')} · ${translate(locale, 'signals.ungraded')} · ${translate(locale, 'detail.approvalGate')}`,
        ],
      ),
      h.ul(
        [
          h.Class(
            'mt-[0.35rem] mr-0 mb-0 ml-0 pl-[1.2rem] [&_li]:my-[0.35rem] [&_li]:leading-[1.5]',
          ),
        ],
        activities.map((activity) => h.li([], [activity.description])),
      ),
    ],
  );
};

const paragraph = (value: string): Html => {
  const h = html<Message>();
  return h.p([], [value]);
};

const collaborationPill = (
  collaboration: 'individual' | 'group' | 'mixed',
  locale: Locale,
): Html => {
  const h = html<Message>();
  return h.span(
    [
      h.Class(
        'mt-2 inline-flex min-h-8 items-center gap-2 rounded-full border border-outline bg-surface-container-high px-3 text-[0.82rem] font-[750] text-on-surface',
      ),
    ],
    [
      icon<Message>(
        collaborationIconName(collaboration),
        'block size-4 flex-none text-primary [&_svg]:block [&_svg]:size-full',
      ),
      translateToken(locale, collaboration),
    ],
  );
};

const chipList = (items: ReadonlyArray<string>): Html => {
  const h = html<Message>();
  return h.ul(
    [
      h.Class(
        'flex flex-wrap gap-[0.45rem] mt-2 mr-0 mb-0 ml-0 p-0 list-none [&_li]:py-[0.4rem] [&_li]:px-3 [&_li]:border [&_li]:border-outline [&_li]:rounded-[1rem] [&_li]:text-on-surface-variant [&_li]:text-[0.8rem]',
      ),
    ],
    items.map((item) => h.li([], [item])),
  );
};

const formatOfferingPeriod = (academicYear: number, season: string, locale: Locale): string => {
  const academicYearLabel = `${academicYear}/${String(academicYear + 1).slice(-2)}`;
  if (season === 'full-year') {
    return translate(locale, 'offering.academicYear', { year: academicYearLabel });
  }
  const calendarYear = season === 'autumn' ? academicYear : academicYear + 1;
  return `${translateToken(locale, season)} ${calendarYear} · ${academicYearLabel}`;
};

const formatTimestamp = (value: string, locale: Locale): string =>
  new Intl.DateTimeFormat(localeTag(locale), {
    dateStyle: 'medium',
    timeZone: 'Europe/Oslo',
  }).format(new Date(value));
