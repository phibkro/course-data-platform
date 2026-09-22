import { Option, Schema as S } from 'effect';
import type { Command } from 'foldkit';
import { html } from 'foldkit/html';
import type { Html } from 'foldkit/html';
import { m } from 'foldkit/message';
import { defineView } from 'foldkit/submodel';
import { Button, Checkbox } from '@foldkit/ui';
import type {
  CourseDecisionSignalsDtoType,
  CourseGradeSummaryDtoType,
  CourseSearchItemDtoType,
} from '@course-data/course-contracts';

import { buttonSecondary, compactButtonBase } from '../../app-styles';
import { localeTag, translate, type Locale } from '../../i18n';
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

export const ClosedCompare = m('ClosedCompare');
export const ToggledCompareDifferencesOnly = m('ToggledCompareDifferencesOnly', {
  differencesOnly: S.Boolean,
});
export const Message = S.Union([ClosedCompare, ToggledCompareDifferencesOnly]);
export type Message = typeof Message.Type;

export const RequestedComparisonUrlWrite = m('RequestedComparisonUrlWrite');
export const OutMessage = S.Union([RequestedComparisonUrlWrite]);
export type OutMessage = typeof OutMessage.Type;

export const init = (codes: ReadonlyArray<string>, differencesOnly = true): Model => ({
  codes: [...codes],
  differencesOnly,
});

export const update = (
  model: Model,
  message: Message,
): readonly [Model, ReadonlyArray<Command.Command<Message>>, Option.Option<OutMessage>] => {
  switch (message._tag) {
    case 'ClosedCompare':
      return [{ ...model, codes: [] }, [], Option.some(RequestedComparisonUrlWrite())];
    case 'ToggledCompareDifferencesOnly':
      return [{ ...model, differencesOnly: message.differencesOnly }, [], Option.none()];
  }
};

export interface CompareCourseFacts {
  readonly course: SavedCourse;
  readonly item: CourseSearchItemDtoType | null;
  readonly decisionSignal: CourseDecisionSignalsDtoType | null;
  readonly gradeSignal: CourseGradeSummaryDtoType | null;
}

export interface ViewInputs {
  readonly locale: Locale;
  readonly courses: ReadonlyArray<SavedCourse>;
  readonly facts: ReadonlyArray<CompareCourseFacts>;
  readonly feedback: Html;
}

const controlGroupClass =
  'grid gap-2 [&>*]:w-full [&>*]:justify-center @min-[28rem]:flex @min-[28rem]:flex-wrap @min-[28rem]:items-center @min-[28rem]:[&>*]:w-auto';

interface CompareCell {
  readonly text: string;
  readonly known: boolean;
}

const compareCell = (text: string, known = true): CompareCell => ({ text, known });

const factCell = <Value>(
  fact: { readonly state: string; readonly value?: Value } | null | undefined,
  locale: Locale,
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
  locale: Locale,
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
        factCell(grade?.sampleSize, locale, (value) => value.toLocaleString(localeTag(locale))),
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

export const view = defineView<Model, Message, ViewInputs>(
  (model, { courses, facts, feedback, locale }) => {
    const h = html<Message>();
    const rows = compareRows(locale, facts);
    const visible = model.differencesOnly ? rows.filter(compareRowDiffers) : rows;
    const headerCellClass =
      'px-3 py-2 text-left align-bottom text-sm font-extrabold text-on-surface';

    return h.section(
      [
        h.Class(
          'grid gap-3 rounded-m3-large border border-outline-variant bg-surface-container-low p-4',
        ),
        h.AriaLabel(translate(locale, 'compare.heading')),
      ],
      [
        h.div(
          [
            h.Class(
              'grid gap-3 @min-[32rem]:flex @min-[32rem]:items-start @min-[32rem]:justify-between',
            ),
          ],
          [
            h.div(
              [],
              [
                h.h2([h.Class('m-0 text-lg font-bold')], [translate(locale, 'compare.heading')]),
                h.p(
                  [h.Class('m-0 mt-1 text-on-surface-variant text-sm leading-[1.45]')],
                  [translate(locale, 'compare.intro')],
                ),
              ],
            ),
            h.div(
              [h.Class(controlGroupClass)],
              [
                Checkbox.view<Message>({
                  id: 'compare-differences-only',
                  isChecked: model.differencesOnly,
                  onToggle: (differencesOnly) => ToggledCompareDifferencesOnly({ differencesOnly }),
                  toView: (attributes) =>
                    h.label(
                      [
                        ...attributes.label,
                        h.Class(
                          'inline-flex min-h-11 cursor-pointer items-center gap-[0.55rem] rounded-[1.5rem] border border-outline px-3 text-sm font-bold text-on-surface-variant has-[[data-checked]]:border-primary has-[[data-checked]]:bg-primary-container has-[[data-checked]]:text-on-primary-container',
                        ),
                      ],
                      [
                        h.span(
                          [
                            ...attributes.checkbox,
                            h.Class(
                              'grid size-[1.15rem] place-items-center rounded-[0.3rem] border-2 border-current text-xs leading-none',
                            ),
                          ],
                          [model.differencesOnly ? '✓' : ''],
                        ),
                        h.span([], [translate(locale, 'compare.differencesOnly')]),
                      ],
                    ),
                }),
                Button.view<Message>({
                  type: 'button',
                  onClick: ClosedCompare(),
                  toView: (attributes) =>
                    h.button(
                      [
                        ...attributes.button,
                        h.Class(`${compactButtonBase} ${buttonSecondary} min-h-11`),
                      ],
                      [translate(locale, 'compare.close')],
                    ),
                }),
              ],
            ),
          ],
        ),
        visible.length === 0
          ? h.p(
              [h.Class('m-0 text-on-surface-variant text-sm leading-[1.45]'), h.Role('status')],
              [translate(locale, 'compare.identical')],
            )
          : h.div(
              [h.Class('overflow-x-auto')],
              [
                h.table(
                  [h.Class('w-full border-collapse text-sm')],
                  [
                    h.thead(
                      [],
                      [
                        h.tr(
                          [],
                          [
                            h.th(
                              [
                                h.Scope('col'),
                                h.Class(
                                  `${headerCellClass} sticky left-0 bg-surface-container-low`,
                                ),
                              ],
                              [translate(locale, 'compare.dimension')],
                            ),
                            ...courses.map((course) =>
                              h.th([h.Scope('col'), h.Class(headerCellClass)], [course.courseCode]),
                            ),
                          ],
                        ),
                      ],
                    ),
                    h.tbody(
                      [],
                      visible.map((row) =>
                        h.tr(
                          [h.Class('border-t border-outline-variant')],
                          [
                            h.th(
                              [
                                h.Scope('row'),
                                h.Class(
                                  'sticky left-0 bg-surface-container-low px-3 py-2 text-left align-top font-bold text-on-surface-variant',
                                ),
                              ],
                              [row.label],
                            ),
                            ...row.cells.map((cell) =>
                              h.td(
                                [
                                  h.Class(
                                    `px-3 py-2 align-top ${cell.known ? 'text-on-surface' : 'text-on-surface-variant italic'}`,
                                  ),
                                ],
                                [cell.text],
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
              ],
            ),
        feedback,
      ],
    );
  },
);
