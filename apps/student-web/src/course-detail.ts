import type { CourseInsightResponseDtoType } from '@course-data/course-contracts';
import type { Html, HtmlBuilder } from 'foldkit/html';

import { localeTag, translate, translateToken, type Localization } from './i18n';
import { collaborationIconName, icon, termSeasonIconName } from './icons';

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

const decisionSectionClass =
  'p-[clamp(1.25rem,4vw,2.25rem)] border border-outline-variant rounded-m3-large bg-surface-container-low';

const sectionHeadingClass =
  'grid gap-[0.35rem] mb-5 [&_h2]:m-0 [&_h2]:text-[clamp(1.35rem,3vw,1.8rem)] [&_h2]:tracking-[-0.025em] [&_p]:max-w-192 [&_p]:m-0 [&_p]:text-on-surface-variant [&_p]:leading-[1.5]';

const factGridClass = 'grid gap-3 grid-cols-[repeat(auto-fit,minmax(min(100%,18rem),1fr))]';

const factCardClass =
  'min-w-0 p-4 rounded-m3-medium bg-surface [&_h3]:mt-0 [&_h3]:mr-0 [&_h3]:mb-[0.55rem] [&_h3]:ml-0 [&_h3]:text-base [&_p]:my-1 [&_p]:mx-0 [&_p]:text-on-surface-variant [&_p]:leading-[1.55]';

const factCardUncertainClass =
  'min-w-0 p-4 border border-dashed border-outline rounded-m3-medium bg-surface [&_h3]:mt-0 [&_h3]:mr-0 [&_h3]:mb-[0.55rem] [&_h3]:ml-0 [&_h3]:text-base [&_p]:my-1 [&_p]:mx-0 [&_p]:text-on-surface-variant [&_p]:leading-[1.55]';

const factStateClass =
  'inline-flex items-center min-h-[1.7rem] py-[0.2rem] px-[0.65rem] rounded-[1rem] bg-surface-container-highest text-on-surface-variant text-xs font-bold whitespace-nowrap';

const uncertainFactStateClass =
  'inline-flex items-center min-h-[1.7rem] py-[0.2rem] px-[0.65rem] rounded-[1rem] bg-tertiary-container text-on-tertiary-container text-xs font-bold whitespace-nowrap';

export const courseInsightView = <Message>(
  response: CourseInsightResponse,
  partial: boolean,
  locale: Localization,
  h: HtmlBuilder<Message>,
): Html => {
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
  ): Html => factView(label, fact, renderKnown, locale, inferenceEvidenceIds, h);

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
                [h.Class('mb-1! text-warning text-xs font-extrabold tracking-[0.1em] uppercase')],
                [translate(locale, 'detail.partial')],
              ),
              h.p([], [translate(locale, 'detail.partialHelp')]),
            ],
          )
        : h.div(
            [
              h.Class(
                'py-4 px-5 rounded-m3-medium bg-primary-container text-on-primary-container font-semibold leading-[1.5]',
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
                [h.Class('mb-2 text-on-primary text-xs font-extrabold tracking-[0.1em] uppercase')],
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
                h,
              ),
              compactFact(
                translate(locale, 'detail.level'),
                course.level,
                (value) => translateToken(locale, value),
                locale,
                h,
              ),
              compactFact(
                translate(locale, 'detail.language'),
                course.teachingLanguage,
                String,
                locale,
                h,
              ),
            ],
          ),
          evidenceLinks(
            course.title.evidenceIds,
            locale,
            'text-on-primary [&_a]:text-on-primary [@media(min-width:64rem)]:col-span-full',
            h,
          ),
        ],
      ),
      decisionSection(
        translate(locale, 'detail.availability'),
        translate(locale, 'detail.availabilityHelp'),
        [
          decisionFact(translate(locale, 'detail.termLocation'), course.offerings, (offerings) =>
            offeringList(offerings, locale, h),
          ),
        ],
        h,
      ),
      decisionSection(
        translate(locale, 'detail.learn'),
        translate(locale, 'detail.learnHelp'),
        [
          decisionFact(translate(locale, 'detail.content'), course.content, (value) =>
            paragraph(value, h),
          ),
          decisionFact(
            translate(locale, 'detail.learningOutcomes'),
            course.learningOutcomes,
            (value) => paragraph(value, h),
          ),
        ],
        h,
      ),
      decisionSection(
        translate(locale, 'detail.works'),
        translate(locale, 'detail.worksHelp'),
        [
          decisionFact(
            translate(locale, 'detail.teachingMethods'),
            course.teachingMethods,
            (value) => paragraph(value, h),
          ),
          decisionFact(translate(locale, 'detail.workForms'), course.workForms, (forms) =>
            chipList(
              forms.map((form) => translateToken(locale, form)),
              h,
            ),
          ),
          decisionFact(translate(locale, 'detail.collaboration'), course.collaboration, (value) =>
            collaborationPill(value, locale, h),
          ),
          decisionFact(translate(locale, 'detail.attendance'), course.attendance, (value) =>
            paragraph(translateToken(locale, value), h),
          ),
          decisionFact(translate(locale, 'detail.online'), course.onlineParticipation, (value) =>
            paragraph(translateToken(locale, value), h),
          ),
        ],
        h,
      ),
      decisionSection(
        translate(locale, 'detail.assessment'),
        translate(locale, 'detail.assessmentHelp'),
        [
          decisionFact(translate(locale, 'detail.assessmentFact'), course.assessment, (parts) =>
            assessmentList(parts, locale, h),
          ),
          decisionFact(
            translate(locale, 'detail.obligatory'),
            course.obligatoryActivities,
            (items) => obligatoryActivityList(items, locale, h),
          ),
        ],
        h,
      ),
      decisionSection(
        translate(locale, 'detail.requirements'),
        translate(locale, 'detail.requirementsHelp'),
        [
          decisionFact(translate(locale, 'detail.prerequisites'), course.prerequisites, (value) =>
            paragraph(value, h),
          ),
          decisionFact(translate(locale, 'detail.access'), course.accessRestrictions, (value) =>
            paragraph(value, h),
          ),
        ],
        h,
      ),
      gradeSection(course, locale, h),
      examParticipationSection(course, locale, h),
      sourceSection(course, locale, h),
    ],
  );
};

const compactFact = <A, Message>(
  label: string,
  fact: ProtocolFact<A>,
  format: (value: A) => string,
  locale: Localization,
  h: HtmlBuilder<Message>,
): Html => {
  return h.div(
    [
      h.Class(
        'min-w-28 py-3 px-4 border border-[color-mix(in_srgb,currentcolor_35%,transparent)] rounded-m3-medium [&_dt]:mb-[0.2rem] [&_dt]:text-xs [&_dt]:opacity-80 [&_dd]:m-0 [&_dd]:font-bold',
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

const decisionSection = <Message>(
  title: string,
  description: string,
  facts: ReadonlyArray<Html>,
  h: HtmlBuilder<Message>,
): Html => {
  return h.section(
    [h.Class(decisionSectionClass)],
    [
      h.header([h.Class(sectionHeadingClass)], [h.h2([], [title]), h.p([], [description])]),
      h.div([h.Class(factGridClass)], [...facts]),
    ],
  );
};

const noInferenceEvidenceIds: ReadonlySet<string> = new Set();

const factView = <A, Message>(
  label: string,
  fact: ProtocolFact<A>,
  renderKnown: (value: A) => Html,
  locale: Localization,
  inferenceEvidenceIds: ReadonlySet<string>,
  h: HtmlBuilder<Message>,
): Html => {
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
        evidenceLinks(fact.evidenceIds, locale, '', h),
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
            h.li(
              [],
              [renderKnown(candidate.value), evidenceLinks(candidate.evidenceIds, locale, '', h)],
            ),
          ),
        ),
        evidenceLinks(fact.evidenceIds, locale, '', h),
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
      evidenceLinks(fact.evidenceIds, locale, '', h),
    ],
  );
};

const gradeSection = <Message>(
  course: CourseInsight,
  locale: Localization,
  h: HtmlBuilder<Message>,
): Html => {
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
            (period) => paragraph(`${period.fromYear}–${period.toYear}`, h),
            locale,
            noInferenceEvidenceIds,
            h,
          ),
          factView(
            translate(locale, 'detail.sampleSize'),
            grades.sampleSize,
            (value) =>
              paragraph(
                translate(locale, 'detail.results', {
                  count: value.toLocaleString(localeTag(locale.locale)),
                }),
                h,
              ),
            locale,
            noInferenceEvidenceIds,
            h,
          ),
          factView(
            translate(locale, 'detail.failureRate'),
            grades.failureRatePercent,
            (value) =>
              paragraph(
                new Intl.NumberFormat(localeTag(locale.locale), {
                  style: 'percent',
                  maximumFractionDigits: 1,
                }).format(value / 100),
                h,
              ),
            locale,
            noInferenceEvidenceIds,
            h,
          ),
          factView(
            translate(locale, 'detail.averageGrade'),
            grades.averageGrade,
            (value) => paragraph(value, h),
            locale,
            noInferenceEvidenceIds,
            h,
          ),
          factView(
            translate(locale, 'detail.medianGrade'),
            grades.medianGrade,
            (value) => paragraph(value, h),
            locale,
            noInferenceEvidenceIds,
            h,
          ),
        ],
      ),
      factView(
        translate(locale, 'detail.distribution'),
        grades.distribution,
        (distribution) => gradeDistribution(distribution, locale, h),
        locale,
        noInferenceEvidenceIds,
        h,
      ),
    ],
  );
};

const gradeDistribution = <Message>(
  distribution: CourseInsight['gradeOutcomes']['distribution'] extends ProtocolFact<infer A>
    ? A
    : never,
  locale: Localization,
  h: HtmlBuilder<Message>,
): Html => {
  return h.div(
    [h.Class('overflow-x-auto')],
    [
      h.table(
        [
          h.Class(
            'w-full border-collapse [&_th]:py-[0.65rem] [&_th]:px-3 [&_th]:border-b [&_th]:border-outline-variant [&_th]:text-left [&_td]:py-[0.65rem] [&_td]:px-3 [&_td]:border-b [&_td]:border-outline-variant [&_td]:text-left [&_thead_th]:text-on-surface-variant [&_thead_th]:text-xs',
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

const examParticipationSection = <Message>(
  course: CourseInsight,
  locale: Localization,
  h: HtmlBuilder<Message>,
): Html => {
  const participation = course.examParticipation;
  const count = (value: number) =>
    paragraph(
      translate(locale, 'detail.examRegistrations', {
        count: value.toLocaleString(localeTag(locale.locale)),
      }),
      h,
    );

  return h.section(
    [h.Class(decisionSectionClass)],
    [
      h.header(
        [h.Class(sectionHeadingClass)],
        [
          h.h2([], [translate(locale, 'detail.examParticipation')]),
          h.p([], [translate(locale, 'detail.examParticipationHelp')]),
        ],
      ),
      h.div(
        [h.Class(factGridClass)],
        [
          factView(
            translate(locale, 'detail.coveredPeriod'),
            participation.period,
            (period) => paragraph(`${period.fromYear}–${period.toYear}`, h),
            locale,
            noInferenceEvidenceIds,
            h,
          ),
          factView(
            translate(locale, 'detail.registered'),
            participation.registered,
            count,
            locale,
            noInferenceEvidenceIds,
            h,
          ),
          factView(
            translate(locale, 'detail.attended'),
            participation.attended,
            count,
            locale,
            noInferenceEvidenceIds,
            h,
          ),
          factView(
            translate(locale, 'detail.passed'),
            participation.passed,
            count,
            locale,
            noInferenceEvidenceIds,
            h,
          ),
          factView(
            translate(locale, 'detail.failed'),
            participation.failed,
            count,
            locale,
            noInferenceEvidenceIds,
            h,
          ),
          factView(
            translate(locale, 'detail.passedAfterRepeat'),
            participation.passedAfterRepeat,
            count,
            locale,
            noInferenceEvidenceIds,
            h,
          ),
        ],
      ),
    ],
  );
};

const sourceSection = <Message>(
  course: CourseInsight,
  locale: Localization,
  h: HtmlBuilder<Message>,
): Html => {
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
                  ? 'p-4 border-l-[0.3rem] border-l-error rounded-m3-medium bg-surface [&_h3]:m-0 [&_h3]:text-base [&_p]:mt-[0.45rem] [&_p]:mr-0 [&_p]:mb-0 [&_p]:ml-0 [&_p]:text-on-surface-variant [&_p]:text-sm [&_p]:leading-[1.45]'
                  : 'p-4 border-l-[0.3rem] border-l-primary rounded-m3-medium bg-surface [&_h3]:m-0 [&_h3]:text-base [&_p]:mt-[0.45rem] [&_p]:mr-0 [&_p]:mb-0 [&_p]:ml-0 [&_p]:text-on-surface-variant [&_p]:text-sm [&_p]:leading-[1.45]',
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
                'scroll-mt-4 p-4 rounded-m3-medium bg-surface-container [&_p]:my-[0.45rem] [&_p]:mx-0 [&_p]:text-on-surface-variant [&_p]:text-sm [&_p]:leading-[1.5]',
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
                    [h.Class('text-on-surface-variant text-sm italic')],
                    [translate(locale, 'detail.noExternalLink')],
                  )
                : h.a(
                    [
                      h.Href(evidence.sourceUrl),
                      h.Target('_blank'),
                      h.Rel('noreferrer'),
                      h.Class('text-sm'),
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

const evidenceLinks = <Message>(
  evidenceIds: ReadonlyArray<string>,
  locale: Localization,
  contextClass: string,
  h: HtmlBuilder<Message>,
): Html => {
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

const offeringList = <Message>(
  offerings: CourseInsight['offerings'] extends ProtocolFact<infer A> ? A : never,
  locale: Localization,
  h: HtmlBuilder<Message>,
): Html => {
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
            h,
          ),
          h.span([], [label]),
        ],
      );
    }),
  );
};

const assessmentList = <Message>(
  assessment: CourseInsight['assessment'] extends ProtocolFact<infer A> ? A : never,
  locale: Localization,
  h: HtmlBuilder<Message>,
): Html => {
  const formatWeight = (value: number): string =>
    new Intl.NumberFormat(localeTag(locale.locale), { maximumFractionDigits: 2 }).format(value);
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
          part.weightPercent.state === 'known'
            ? h.empty
            : h.div(
                [h.Class('text-sm text-on-surface-variant')],
                [
                  h.p(
                    [],
                    [
                      `${translate(locale, 'detail.assessmentWeight')}: ${translateToken(locale, part.weightPercent.state)}. ${part.weightPercent.reason}`,
                    ],
                  ),
                  evidenceLinks(part.weightPercent.evidenceIds, locale, '', h),
                ],
              ),
        ],
      ),
    ),
  );
};

const obligatoryActivityList = <Message>(
  activities: CourseInsight['obligatoryActivities'] extends ProtocolFact<infer A> ? A : never,
  locale: Localization,
  h: HtmlBuilder<Message>,
): Html => {
  if (activities.length === 0) {
    return h.p([], [translate(locale, 'detail.noneReported')]);
  }
  return h.div(
    [h.Class('grid gap-3')],
    [
      h.p(
        [h.Class('m-0 text-sm font-bold text-on-surface-variant')],
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

const paragraph = <Message>(value: string, h: HtmlBuilder<Message>): Html => h.p([], [value]);

const collaborationPill = <Message>(
  collaboration: 'individual' | 'group' | 'mixed',
  locale: Localization,
  h: HtmlBuilder<Message>,
): Html => {
  return h.span(
    [
      h.Class(
        'mt-2 inline-flex min-h-8 items-center gap-2 rounded-full border border-outline bg-surface-container-high px-3 text-sm font-bold text-on-surface',
      ),
    ],
    [
      icon<Message>(
        collaborationIconName(collaboration),
        'block size-4 flex-none text-primary [&_svg]:block [&_svg]:size-full',
        h,
      ),
      translateToken(locale, collaboration),
    ],
  );
};

const chipList = <Message>(items: ReadonlyArray<string>, h: HtmlBuilder<Message>): Html => {
  return h.ul(
    [
      h.Class(
        'flex flex-wrap gap-[0.45rem] mt-2 mr-0 mb-0 ml-0 p-0 list-none [&_li]:py-[0.4rem] [&_li]:px-3 [&_li]:border [&_li]:border-outline [&_li]:rounded-[1rem] [&_li]:text-on-surface-variant [&_li]:text-sm',
      ),
    ],
    items.map((item) => h.li([], [item])),
  );
};

const formatOfferingPeriod = (
  academicYear: number,
  season: string,
  locale: Localization,
): string => {
  const academicYearLabel = `${academicYear}/${String(academicYear + 1).slice(-2)}`;
  if (season === 'full-year') {
    return translate(locale, 'offering.academicYear', { year: academicYearLabel });
  }
  const calendarYear = season === 'autumn' ? academicYear : academicYear + 1;
  return `${translateToken(locale, season)} ${calendarYear} · ${academicYearLabel}`;
};

const formatTimestamp = (value: string, locale: Localization): string =>
  new Intl.DateTimeFormat(localeTag(locale.locale), {
    dateStyle: 'medium',
    timeZone: 'Europe/Oslo',
  }).format(new Date(value));
