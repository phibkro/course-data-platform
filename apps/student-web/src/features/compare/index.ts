import { Schema as S } from 'effect';
import type { Update } from 'foldkit';
import type { Html } from 'foldkit/html';
import { defineMessageUnion } from 'foldkit/message';
import { defineView } from 'foldkit/submodel';
import { modifyFields } from 'foldkit/struct';
import { Button } from '@foldkit/ui';
import type {
  CourseDecisionSignalsDtoType,
  CourseGradeSummaryDtoType,
  CourseSearchItemDtoType,
} from '@course-data/course-contracts';

import { buttonSecondary, compactButtonBase } from '../../app-styles';
import { selectionChip } from '../../components';
import { localeTag, translate, type Localization } from '../../i18n';
import type { SavedCourse } from '../../saved-courses';
import {
  assessmentLabel,
  collaborationLabel,
  courseOfferingFacts,
  factStateLabel,
  formatPercentage,
  gradeScaleLabel,
} from '../../course-facts';

export const Model = S.Struct({
  codes: S.Array(S.String),
  differencesOnly: S.Boolean,
});
export type Model = typeof Model.Type;

export const Message = defineMessageUnion({
  ClosedCompare: {},
  ToggledCompareDifferencesOnly: { differencesOnly: S.Boolean },
});
export type Message = typeof Message.Type;

export const OutMessage = defineMessageUnion({
  RequestedComparisonUrlWrite: {},
});
export type OutMessage = typeof OutMessage.Type;

export const init = (codes: ReadonlyArray<string>, differencesOnly = true): Model => ({
  codes: [...codes],
  differencesOnly,
});

type UpdateReturn = Update.ReturnWithOutMessage<Model, Message, OutMessage>;

export const update = (model: Model, message: Message) =>
  Message.match<UpdateReturn>(message, {
    ClosedCompare: () => ({
      model: modifyFields(model, { codes: () => [] }),
      outMessage: OutMessage.RequestedComparisonUrlWrite(),
    }),
    ToggledCompareDifferencesOnly: ({ differencesOnly }) => ({
      model: modifyFields(model, { differencesOnly: () => differencesOnly }),
    }),
  });

export interface CompareCourseFacts {
  readonly course: SavedCourse;
  readonly item: CourseSearchItemDtoType | null;
  readonly decisionSignal: CourseDecisionSignalsDtoType | null;
  readonly gradeSignal: CourseGradeSummaryDtoType | null;
}

export interface ViewInputs {
  readonly locale: Localization;
  readonly courses: ReadonlyArray<SavedCourse>;
  readonly facts: ReadonlyArray<CompareCourseFacts>;
  readonly feedback: Html;
}

const controlGroupClass = 'flex flex-wrap items-center gap-2';

interface CompareCell {
  readonly text: string;
  readonly known: boolean;
}

const compareCell = (text: string, known = true): CompareCell => ({ text, known });

const factCell = <Value>(
  fact: { readonly state: string; readonly value?: Value } | null | undefined,
  locale: Localization,
  render: (value: Value) => string,
): CompareCell =>
  fact === null || fact === undefined
    ? compareCell(translate(locale, 'compare.notLoaded'), false)
    : fact.state === 'known' && fact.value !== undefined
      ? compareCell(render(fact.value))
      : compareCell(factStateLabel(fact.state, locale), false);

interface CompareRow {
  readonly label: string;
  readonly cells: ReadonlyArray<CompareCell>;
}

export const compareRows = (
  locale: Localization,
  facts: ReadonlyArray<CompareCourseFacts>,
): ReadonlyArray<CompareRow> => {
  const items = facts.map((fact) => fact.item);
  const signals = facts.map((fact) => fact.decisionSignal);
  const grades = facts.map((fact) => fact.gradeSignal);
  const offeringFacts = facts.map((fact) =>
    fact.item === null
      ? null
      : courseOfferingFacts(fact.item, fact.decisionSignal ?? 'idle', locale),
  );
  const row = (label: string, cells: ReadonlyArray<CompareCell>): CompareRow => ({ label, cells });

  return [
    row(
      translate(locale, 'compare.credits'),
      items.map((item, index) =>
        item === null
          ? compareCell(translate(locale, 'compare.notLoaded'), false)
          : compareCell(
              offeringFacts[index]?.credits ?? translate(locale, 'compare.notLoaded'),
              true,
            ),
      ),
    ),
    row(
      translate(locale, 'compare.term'),
      offeringFacts.map((fact) =>
        fact === null
          ? compareCell(translate(locale, 'compare.notLoaded'), false)
          : compareCell(fact.term),
      ),
    ),
    row(
      translate(locale, 'compare.campus'),
      offeringFacts.map((fact) =>
        fact === null
          ? compareCell(translate(locale, 'compare.notLoaded'), false)
          : compareCell(fact.place),
      ),
    ),
    row(
      translate(locale, 'compare.assessment'),
      signals.map((signal) =>
        factCell(signal?.assessment, locale, (parts) =>
          parts
            .map((part) =>
              part.weightPercent.state === 'known'
                ? `${assessmentLabel(part.form, locale)} ${formatPercentage(part.weightPercent.value, locale)}%`
                : assessmentLabel(part.form, locale),
            )
            .join(' · '),
        ),
      ),
    ),
    row(
      translate(locale, 'compare.obligatory'),
      signals.map((signal) =>
        factCell(signal?.obligatoryActivities, locale, (activities) =>
          activities.length === 0
            ? translate(locale, 'compare.none')
            : activities.length === 1
              ? translate(locale, 'signals.oneActivity')
              : translate(locale, 'compare.activityCount', { count: activities.length }),
        ),
      ),
    ),
    row(
      translate(locale, 'compare.collaboration'),
      signals.map((signal) =>
        factCell(signal?.collaboration, locale, (value) => collaborationLabel(value, locale)),
      ),
    ),
    row(
      translate(locale, 'compare.outcomeScale'),
      grades.map((grade) =>
        factCell(grade?.gradingScale, locale, (scale) => gradeScaleLabel(scale, locale)),
      ),
    ),
    row(
      translate(locale, 'compare.failureRate'),
      grades.map((grade) =>
        factCell(
          grade?.failureRatePercent,
          locale,
          (value) => `${formatPercentage(value, locale)}%`,
        ),
      ),
    ),
    row(
      translate(locale, 'compare.sample'),
      grades.map((grade) =>
        factCell(grade?.sampleSize, locale, (value) =>
          value.toLocaleString(localeTag(locale.locale)),
        ),
      ),
    ),
    row(
      translate(locale, 'compare.period'),
      grades.map((grade) =>
        factCell(grade?.period, locale, (value) => `${value.fromYear}–${value.toYear}`),
      ),
    ),
  ];
};

const compareRowDiffers = (row: CompareRow): boolean => {
  const known = row.cells.filter((cell) => cell.known);
  if (known.length !== row.cells.length) return true;
  return known.some((cell) => cell.text !== known[0]?.text);
};

const comparisonCourseTitle = (
  fact: CompareCourseFacts | undefined,
  locale: Localization,
): string => {
  const item = fact?.item;
  return item !== null && item !== undefined && item.title.state === 'known'
    ? item.title.value
    : translate(locale, 'course.titleUnavailable');
};

export const view = defineView<Model, Message, ViewInputs>(
  (model, { courses, facts, feedback, locale }, h) => {
    const rows = compareRows(locale, facts);
    const visible = model.differencesOnly ? rows.filter(compareRowDiffers) : rows;
    const titleFor = (index: number): string => comparisonCourseTitle(facts[index], locale);
    const mobileCourseSummary = (course: SavedCourse, index: number): Html =>
      h.div(
        [h.Class('grid min-w-0 gap-2 p-4')],
        [
          h.span(
            [
              h.Class(
                'inline-flex w-fit rounded-full bg-primary-container px-2.5 py-1 text-xs font-extrabold tracking-[0.08em] text-on-primary-container',
              ),
            ],
            [course.courseCode],
          ),
          h.p(
            [h.Class('m-0 text-sm font-extrabold leading-[1.35] [overflow-wrap:anywhere]')],
            [titleFor(index)],
          ),
        ],
      );
    const mobileValue = (index: number, cell: CompareCell): Html =>
      h.div(
        [h.Class('grid gap-1 py-3 first:pt-0 last:pb-0')],
        [
          h.span(
            [
              h.Class(
                'inline-flex w-fit rounded-full bg-tertiary-container px-2 py-1 text-xs font-extrabold text-on-tertiary-container',
              ),
            ],
            [courses[index]?.courseCode ?? ''],
          ),
          h.p(
            [
              h.Class(
                `m-0 text-sm leading-[1.45] ${
                  cell.known ? 'text-on-surface' : 'text-on-surface-variant italic'
                }`,
              ),
            ],
            [cell.text],
          ),
        ],
      );

    return h.section(
      [
        h.Class(
          'grid gap-5 rounded-[1rem] border border-outline-variant bg-surface-container-low p-[clamp(1rem,2.5vw,1.5rem)] shadow-m3-1',
        ),
        h.AriaLabel(translate(locale, 'compare.heading')),
      ],
      [
        h.header(
          [
            h.Class(
              'grid gap-4 border-b border-outline-variant pb-4 [@media(min-width:48rem)]:grid-cols-[minmax(0,1fr)_auto]',
            ),
          ],
          [
            h.div(
              [h.Class('grid gap-2')],
              [
                h.h2(
                  [h.Class('m-0 text-[clamp(1.5rem,3vw,2rem)] font-extrabold tracking-[-0.035em]')],
                  [translate(locale, 'compare.heading')],
                ),
                h.p(
                  [h.Class('m-0 max-w-[42rem] text-sm leading-[1.5] text-on-surface-variant')],
                  [translate(locale, 'compare.intro')],
                ),
              ],
            ),
            h.div(
              [h.Class(controlGroupClass)],
              [
                selectionChip(
                  {
                    id: 'compare-differences-only',
                    label: translate(locale, 'compare.differencesOnly'),
                    isSelected: model.differencesOnly,
                    onToggle: (differencesOnly) =>
                      Message.ToggledCompareDifferencesOnly({ differencesOnly }),
                  },
                  h,
                ),
                Button.view<Message>(
                  {
                    type: 'button',
                    onClick: Message.ClosedCompare(),
                    toView: (attributes) =>
                      h.button(
                        [
                          ...attributes.button,
                          h.Class(`${compactButtonBase} ${buttonSecondary} min-h-11`),
                        ],
                        [translate(locale, 'compare.close')],
                      ),
                  },
                  h,
                ),
              ],
            ),
          ],
        ),
        h.div(
          [
            h.Class(
              'grid grid-cols-2 overflow-hidden rounded-m3-large border border-outline-variant bg-surface [@media(min-width:48rem)]:hidden',
            ),
          ],
          courses.map((course, index) => mobileCourseSummary(course, index)),
        ),
        visible.length === 0
          ? h.p(
              [h.Class('m-0 text-sm leading-[1.5] text-on-surface-variant'), h.Role('status')],
              [translate(locale, 'compare.identical')],
            )
          : h.div(
              [h.Class('grid gap-3')],
              [
                h.div(
                  [h.Class('hidden overflow-x-auto [@media(min-width:48rem)]:block')],
                  [
                    h.table(
                      [
                        h.Class(
                          'min-w-[64rem] w-full table-fixed border-separate border-spacing-0 text-sm',
                        ),
                      ],
                      [
                        h.thead(
                          [h.Class('border-b border-outline-variant')],
                          [
                            h.tr(
                              [],
                              [
                                h.th(
                                  [
                                    h.Scope('col'),
                                    h.Class(
                                      'sticky left-0 z-10 w-[17rem] bg-surface-container-low px-4 py-3 text-left align-bottom text-xs font-extrabold uppercase tracking-[0.08em] text-on-surface-variant',
                                    ),
                                  ],
                                  [translate(locale, 'compare.dimension')],
                                ),
                                ...courses.map((course, index) =>
                                  h.th(
                                    [
                                      h.Scope('col'),
                                      h.Class('min-w-[17rem] px-4 py-3 text-left align-bottom'),
                                    ],
                                    [
                                      h.div(
                                        [h.Class('grid gap-2')],
                                        [
                                          h.span(
                                            [
                                              h.Class(
                                                'inline-flex w-fit rounded-full bg-primary-container px-2.5 py-1 text-xs font-extrabold tracking-[0.08em] text-on-primary-container',
                                              ),
                                            ],
                                            [course.courseCode],
                                          ),
                                          h.p(
                                            [
                                              h.Class(
                                                'm-0 text-base font-extrabold leading-[1.3] [overflow-wrap:anywhere]',
                                              ),
                                            ],
                                            [titleFor(index)],
                                          ),
                                        ],
                                      ),
                                    ],
                                  ),
                                ),
                              ],
                            ),
                          ],
                        ),
                        h.tbody(
                          [],
                          visible.map((row, rowIndex) => {
                            const surface =
                              rowIndex % 2 === 0 ? 'bg-surface' : 'bg-surface-container';
                            return h.tr(
                              [
                                h.Class(
                                  `border-b border-outline-variant last:border-b-0 ${surface}`,
                                ),
                              ],
                              [
                                h.th(
                                  [
                                    h.Scope('row'),
                                    h.Class(
                                      `sticky left-0 z-10 w-[17rem] px-4 py-4 text-left align-top font-extrabold text-on-surface-variant ${surface}`,
                                    ),
                                  ],
                                  [row.label],
                                ),
                                ...row.cells.map((cell) =>
                                  h.td(
                                    [
                                      h.Class(
                                        `px-4 py-4 align-top leading-[1.45] ${
                                          cell.known
                                            ? 'text-on-surface'
                                            : 'text-on-surface-variant italic'
                                        }`,
                                      ),
                                    ],
                                    [cell.text],
                                  ),
                                ),
                              ],
                            );
                          }),
                        ),
                      ],
                    ),
                  ],
                ),
                h.div(
                  [h.Class('grid gap-3 [@media(min-width:48rem)]:hidden')],
                  visible.map((row) =>
                    h.article(
                      [
                        h.Class(
                          'grid gap-3 rounded-[1rem] border border-outline-variant bg-surface p-4 shadow-m3-1',
                        ),
                      ],
                      [
                        h.h3([h.Class('m-0 text-sm font-extrabold text-on-surface')], [row.label]),
                        h.div(
                          [h.Class('grid divide-y divide-outline-variant')],
                          row.cells.map((cell, index) => mobileValue(index, cell)),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
        feedback,
      ],
    );
  },
);
