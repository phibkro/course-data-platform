import type {
  CourseDecisionSignalsDtoType,
  CourseGradeSummaryDtoType,
  CourseSearchItemDtoType,
} from '@course-data/course-contracts';
import { Match as M, Option } from 'effect';
import { Button, Checkbox, Dialog, Input, RadioGroup } from '@foldkit/ui';
import type { Html, HtmlBuilder } from 'foldkit/html';
import { createKeyedLazy, createLazy } from 'foldkit/html';

import {
  CancelledLabelDelete,
  CancelledLabelEdit,
  CancelledRemoveSelected,
  ChangedCourseOriginFilter,
  ChangedLabelExclusion,
  ChangedLabelInclusion,
  ClearedCourseFilters,
  ClearedLabelFilter,
  ClearedSavedCourseSelection,
  ConfirmedDeleteLabel,
  ConfirmedRemoveSelected,
  DismissedAllSavedListActions,
  DismissedSavedListAction,
  GotLabelDialogMessage,
  GotCompareMessage,
  GotLabelDraftColorRadioGroupMessage,
  GotLabelFilterModeRadioGroupMessage,
  GotListDensityRadioGroupMessage,
  RequestedCompare,
  RequestedDeleteLabel,
  RequestedEditLabel,
  RequestedLabelDialog,
  RequestedRemoveSelected,
  RequestedSavedCoursesReset,
  RequestedUndoSavedListAction,
  SubmittedLabelForm,
  SubmittedSavedNote,
  ToggledLabelOnTarget,
  ToggledSavedCourseSelection,
  UpdatedLabelDraftName,
  UpdatedSavedNoteDraft,
  exploreUrl,
  feedbackRow,
  labelTargetIdentities,
  listDensities,
  normalizedUrl,
  noteDraftFor,
  projectedStudentCourses,
  savedListNoticeKey,
  savedListState,
  type ListDensity,
  type SavedCoursesResult,
  type Message,
  type Model,
  type OutcomeView,
  type SavedListNotice,
} from '../../app';
import {
  backButtonClass,
  buttonPrimary,
  buttonSecondary,
  eyebrowClass,
  compactButtonBase,
  fieldLabelClass,
  groupedAction,
  loadingIndicatorClass,
  stateCardBase,
  stateCardH2Class,
  stateCardPClass,
} from '../../app-styles';
import { localeTag, translate, type Localization } from '../../i18n';
import { courseOfferingFacts } from '../../course-facts';
import { icon } from '../../icons';
import {
  filterLabel,
  compareCourses,
  compareSelection,
  filterSavedCourses,
  filterUnlabeled,
  findLabel,
  hasLabel,
  isLabelFilterActive,
  labelColors,
  labelCourseCount,
  labelFilterModes,
  labelsByName,
  labelsForSavedCourse,
  unlabeledCourseCount,
  labelsMaxCount,
  normalizeLabelFilter,
  type Label,
  type LabelColor,
  type LabelFilter,
  type LabelFilterMode,
  type LabelPredicate,
  compareMaximum,
  compareMinimum,
  savedCoursesNewestFirst,
  type SavedCourse,
  type SavedListState,
} from '../../saved-courses';
import {
  courseOriginFilters,
  filterStudentCoursesByOrigin,
  type CourseOriginFilter,
  type StudentCourse,
} from '../../student-courses';
import {
  catalogueItemForCode,
  catalogueRefineAction,
  courseIdentityFacts,
  factDtClass,
  courseTitle,
  decisionSignalView,
  gradeSignalView,
  savedDecisionSignal,
  savedGradeSignal,
  refineDialogPanelClass,
  savedCourseToggle,
} from '../explore';
import { init as initCompare, type CompareCourseFacts, view as compareView } from '../compare';
export const LabelFilterModeRadioGroup = RadioGroup.create<LabelFilterMode>();
export const ListDensityRadioGroup = RadioGroup.create<ListDensity>();
export const LabelDraftColorRadioGroup = RadioGroup.create<LabelColor>();

const lazySavedCourseRow = createKeyedLazy();
const lazyListHeader = createLazy();

export const savedCoursesPersistenceAlert = (model: Model, h: HtmlBuilder<Message>): Html => {
  if (!model.savedCoursesPersistFailed) return h.empty;
  return h.div(
    [
      h.Class(
        'mb-4 py-[0.9rem] px-4 border border-error rounded-m3-medium bg-error-container text-on-error-container',
      ),
      h.Role('alert'),
    ],
    [translate(model.localization, 'list.persistFailed')],
  );
};

/**
 * Save and Remove are each one action with an explicit confirmation rather
 * than a silent state flip. The banner names what just happened, offers
 * Undo while the ephemeral snapshot is still available, and Dismiss so the
 * student is never forced to wait it out.
 */
const savedListActionStatus = (model: Model, h: HtmlBuilder<Message>): Html => {
  const notices = model.savedListActions;
  if (notices.length === 0) return h.empty;
  const buttonClass = `${compactButtonBase} ${buttonSecondary}`;

  const noticeCard = (notice: SavedListNotice, h: HtmlBuilder<Message>): Html => {
    const key = savedListNoticeKey(notice);
    const single = notice._tag === 'SavedActionRemoved' && notice.courses.length === 1;
    const removed = notice._tag === 'SavedActionRemoved' ? notice.courses : [];
    const message =
      notice._tag === 'SavedActionSaved'
        ? translate(model.localization, 'list.savedStatus', { code: notice.courseCode })
        : single && removed[0] !== undefined
          ? translate(model.localization, 'list.removedStatus', { code: removed[0].courseCode })
          : translate(model.localization, 'list.removedManyStatus', { count: removed.length });
    const undoLabel =
      notice._tag === 'SavedActionSaved'
        ? translate(model.localization, 'list.undoSave', { code: notice.courseCode })
        : single && removed[0] !== undefined
          ? translate(model.localization, 'list.undoRemove', { code: removed[0].courseCode })
          : translate(model.localization, 'list.undoRemoveMany', { count: removed.length });

    return h.div(
      [
        h.Class(
          'pointer-events-auto flex flex-wrap items-center justify-between gap-3 rounded-m3-medium border border-outline bg-surface-container py-[0.9rem] px-4 text-on-surface shadow-m3-2',
        ),
        h.Role('status'),
        h.AriaLive('polite'),
      ],
      [
        h.p([h.Class('m-0')], [message]),
        h.div(
          [h.Class('flex items-center gap-2')],
          [
            Button.view<Message>(
              {
                type: 'button',
                onClick: RequestedUndoSavedListAction({ key }),
                toView: (attributes) =>
                  h.button(
                    [...attributes.button, h.Class(buttonClass), h.AriaLabel(undoLabel)],
                    [translate(model.localization, 'list.undo')],
                  ),
              },
              h,
            ),
            Button.view<Message>(
              {
                type: 'button',
                onClick: DismissedSavedListAction({ key }),
                // Its own name: sharing Undo's would give two buttons one
                // accessible name for opposite outcomes.
                toView: (attributes) =>
                  h.button(
                    [...attributes.button, h.Class(buttonClass)],
                    [translate(model.localization, 'list.dismissStatus')],
                  ),
              },
              h,
            ),
          ],
        ),
      ],
    );
  };

  /**
   * Each notice keeps its own Undo, so a second action does not cost the
   * student the first one. Clearing them one at a time is the tax that
   * stacking introduces, so the group offers a single way out once there is
   * more than one to clear.
   */
  return h.div(
    [h.Class('pointer-events-none grid gap-2')],
    [
      ...notices.map((notice) => noticeCard(notice, h)),
      notices.length < 2
        ? h.empty
        : h.div(
            [h.Class('pointer-events-auto flex justify-end')],
            [
              Button.view<Message>(
                {
                  type: 'button',
                  onClick: DismissedAllSavedListActions(),
                  toView: (attributes) =>
                    h.button(
                      [...attributes.button, h.Class(`${buttonClass} min-h-11`)],
                      [
                        translate(model.localization, 'list.dismissAllStatus', {
                          count: notices.length,
                        }),
                      ],
                    ),
                },
                h,
              ),
            ],
          ),
    ],
  );
};

const listHeader = (locale: Localization, h: HtmlBuilder<Message>): Html => {
  return h.header(
    [h.Class('pt-[clamp(1.5rem,4vw,3rem)] pb-2 grid gap-4')],
    [
      h.div(
        [],
        [
          h.p([h.Class(eyebrowClass)], [translate(locale, 'list.eyebrow')]),
          h.h1(
            [
              h.Class(
                'max-w-[22ch] text-[clamp(2rem,5vw,3.25rem)] font-bold tracking-[-0.05em] leading-none',
              ),
            ],
            [translate(locale, 'list.heading')],
          ),
          h.p(
            [h.Class('max-w-192 mt-4 text-on-surface-variant text-base leading-[1.6]')],
            [translate(locale, 'list.intro')],
          ),
        ],
      ),
    ],
  );
};

/**
 * Label colours come from repository-owned semantic label tokens that are
 * independent of the active theme accent, with checked light and dark pairs.
 * Colour is decoration: every chip also carries the label name as text.
 */
const labelChipTone = (color: LabelColor): string =>
  M.value(color).pipe(
    M.when('violet', () => 'bg-label-violet text-on-label-violet'),
    M.when('amber', () => 'bg-label-amber text-on-label-amber'),
    M.when('rose', () => 'bg-label-rose text-on-label-rose'),
    M.when('emerald', () => 'bg-label-emerald text-on-label-emerald'),
    M.when('sky', () => 'bg-label-sky text-on-label-sky'),
    M.exhaustive,
  );

const labelDotTone = (color: LabelColor): string =>
  M.value(color).pipe(
    M.when('violet', () => 'bg-label-violet'),
    M.when('amber', () => 'bg-label-amber'),
    M.when('rose', () => 'bg-label-rose'),
    M.when('emerald', () => 'bg-label-emerald'),
    M.when('sky', () => 'bg-label-sky'),
    M.exhaustive,
  );

const labelColorName = (color: LabelColor, locale: Localization): string =>
  M.value(color).pipe(
    M.when('violet', () => translate(locale, 'label.colorViolet')),
    M.when('amber', () => translate(locale, 'label.colorAmber')),
    M.when('rose', () => translate(locale, 'label.colorRose')),
    M.when('emerald', () => translate(locale, 'label.colorEmerald')),
    M.when('sky', () => translate(locale, 'label.colorSky')),
    M.exhaustive,
  );

const labelChipClass = (color: LabelColor): string =>
  `inline-flex min-h-7 items-center gap-1.5 rounded-full border border-outline-variant px-2.5 text-xs font-bold ${labelChipTone(color)}`;

const labelChip = (label: Label, id: string | null, h: HtmlBuilder<Message>): Html => {
  return h.span(
    [h.Class(labelChipClass(label.color)), ...(id === null ? [] : [h.Id(id)])],
    [label.name],
  );
};

const labelDot = (color: LabelColor, h: HtmlBuilder<Message>): Html => {
  return h.span(
    [
      h.Class(
        `size-2.5 flex-none rounded-full border border-outline-variant ${labelDotTone(color)}`,
      ),
      h.AriaHidden(true),
    ],
    [],
  );
};

/** The count is visible as a number and named for assistive technology, so the
 *  chip never depends on the digit alone to explain itself. */
const labelCountBadge = (count: number, locale: Localization, h: HtmlBuilder<Message>): Html => {
  return h.span(
    [h.Class('inline-flex items-center gap-1')],
    [
      h.span([h.Class('tabular-nums')], [String(count)]),
      h.span(
        [h.Class('sr-only')],
        [translate(locale, count === 1 ? 'list.labelCountUnitOne' : 'list.labelCountUnit')],
      ),
    ],
  );
};

/**
 * A saved row is selectable, and looks it. Selection used to be reported only
 * by a small box at the row's edge, which left the row reading as a static
 * item that happened to have a control on it. The whole row carries the state
 * now — border and surface — so what is selected is legible from a glance down
 * the column rather than from the checkboxes alone.
 */
const savedRowClass = (isSelected: boolean): string =>
  `@container grid gap-4 p-[1.1rem] rounded-m3-large border transition-[background-color,border-color] duration-150 ease-in-out ${
    isSelected
      ? 'border-primary bg-primary-container/40'
      : 'border-outline-variant bg-surface-container-low'
  }`;

/**
 * A saved row is a single column first, and becomes a row only once it has the
 * width for one.
 *
 * The arrangement answers to the row's own width rather than the viewport's,
 * so it holds inside the sidebar-offset column and inside a comparison just as
 * it does on a phone. Selection and identity stay adjacent because they name
 * the same thing; the controls that act on the course take the far side when
 * there is a far side, and the line below it when there is not — which is what
 * keeps a long title from having to share a line it cannot fit on.
 */
const savedRowHeaderClass =
  'grid grid-cols-[auto_minmax(0,1fr)] items-start gap-3 @min-[32rem]:grid-cols-[auto_minmax(0,1fr)_auto]';

const savedRowActionsClass =
  'col-span-2 flex flex-wrap items-center gap-2 @min-[32rem]:col-span-1 @min-[32rem]:col-start-3 @min-[32rem]:row-start-1 @min-[32rem]:justify-end';

const rowCheckboxClass =
  'grid size-6 flex-none place-items-center rounded-[0.4rem] border-2 border-outline text-sm leading-none cursor-pointer has-[[data-checked]]:border-primary';

const noteFieldClass =
  'w-full min-h-20 p-3 border border-outline rounded-m3-medium outline-0 bg-surface-container-low text-on-surface text-base leading-[1.45] focus-visible:border-primary focus-visible:shadow-[0_0_0_3px_var(--md-sys-color-primary-container)]';

const systemBadgeClass =
  'inline-flex min-h-7 items-center rounded-full border border-primary/40 bg-primary-container px-2.5 text-xs font-extrabold text-on-primary-container';

const resultGradeLabel = (grade: string, locale: Localization): string => {
  switch (grade) {
    case 'pass':
      return translate(locale, 'progress.gradePass');
    case 'fail':
      return translate(locale, 'progress.gradeFail');
    case 'recognized':
      return translate(locale, 'progress.gradeRecognized');
    default:
      return grade;
  }
};

const resultSummary = (course: StudentCourse, locale: Localization): string | null => {
  const result = course.resultCourse?.latest;
  if (result === undefined) return null;
  return translate(locale, 'list.resultSummary', {
    grade: resultGradeLabel(result.grade, locale),
    term: translate(locale, result.term === 1 ? 'progress.termSpring' : 'progress.termAutumn'),
    year: result.year,
    credits: new Intl.NumberFormat(localeTag(locale.locale), { maximumFractionDigits: 2 }).format(
      result.credits,
    ),
  });
};

const resultEvidence = (
  course: StudentCourse,
  locale: Localization,
  h: HtmlBuilder<Message>,
): Html => {
  const summary = resultSummary(course, locale);
  if (summary === null) return h.empty;
  return h.section(
    [
      h.Class(
        'grid gap-1 rounded-m3-medium bg-secondary-container p-3 text-on-secondary-container',
      ),
      h.AriaLabel(translate(locale, 'list.resultEvidence')),
    ],
    [
      h.p(
        [h.Class('m-0 text-xs font-extrabold uppercase tracking-[0.08em]')],
        [translate(locale, 'list.resultEvidence')],
      ),
      h.p([h.Class('m-0 font-bold')], [summary]),
      h.p([h.Class('m-0 text-xs leading-[1.4]')], [translate(locale, 'list.resultEvidenceHelp')]),
    ],
  );
};

/**
 * A saved row shows the student's own material (identity, note, actions) plus
 * whatever official facts this session already loaded. It never invents a fact
 * state for a course whose evidence was not requested.
 */
const savedCourseRow = (
  href: string,
  course: StudentCourse,
  state: SavedListState,
  item: CourseSearchItemDtoType | null,
  decisionSignal: CourseDecisionSignalsDtoType | null,
  gradeSignal: CourseGradeSummaryDtoType | null,
  noteDraft: string,
  isSelected: boolean,
  locale: Localization,
  outcomeView: OutcomeView,
  density: ListDensity,
  h: HtmlBuilder<Message>,
): Html => {
  const savedCourse = course.savedCourse;
  const resultCourse = course.resultCourse;
  const noteFieldId = `saved-note-${course.courseCode}`;
  const noteHelpId = `${noteFieldId}-help`;
  const title = item === null ? (resultCourse?.title ?? null) : courseTitle(item, locale);
  const openLabel = translate(locale, 'list.openCourse', { code: course.courseCode });
  const labels = savedCourse === null ? [] : labelsForSavedCourse(state, course.identity);
  const selectionCheckbox =
    savedCourse === null
      ? h.span([h.Class('size-11 flex-none'), h.AriaHidden(true)], [])
      : Checkbox.view<Message>(
          {
            id: `select-${course.courseCode}`,
            isChecked: isSelected,
            onToggle: (checked) =>
              ToggledSavedCourseSelection({ courseCode: course.courseCode, isSelected: checked }),
            toView: (attributes) =>
              h.label(
                [
                  ...attributes.label,
                  // The visual box stays compact; the label keeps a 44px touch target.
                  h.Class(
                    'flex min-h-11 min-w-11 flex-none items-center justify-center cursor-pointer',
                  ),
                ],
                [
                  h.span(
                    [...attributes.checkbox, h.Class(rowCheckboxClass)],
                    [isSelected ? '✓' : ''],
                  ),
                  h.span(
                    [h.Class('sr-only')],
                    [translate(locale, 'list.selectCourse', { code: course.courseCode })],
                  ),
                ],
              ),
          },
          h,
        );
  const labelsAction =
    savedCourse === null
      ? h.empty
      : Button.view<Message>(
          {
            type: 'button',
            onClick: RequestedLabelDialog({ courseCodes: [course.courseCode] }),
            toView: (attributes) =>
              h.button(
                [
                  ...attributes.button,
                  h.Class(
                    `${compactButtonBase} inline-flex min-h-11 items-center gap-1.5 rounded-[1.5rem] border border-outline bg-surface-container px-3 text-sm font-bold text-primary`,
                  ),
                  h.AriaLabel(translate(locale, 'list.editLabelsFor', { code: course.courseCode })),
                  h.AriaHasPopup('dialog'),
                  h.AriaControls('saved-course-labels'),
                ],
                [translate(locale, 'list.openLabels')],
              ),
          },
          h,
        );
  const identityBlock = h.div(
    [h.Class('min-w-0 flex-1')],
    [
      h.p(
        [h.Class('mb-[0.3rem] text-primary text-xs font-extrabold tracking-[0.1em] uppercase')],
        [course.courseCode],
      ),
      h.h3(
        [
          // Density changes how much surrounds a saved course, never how
          // legible it is: compact buys its scan line from padding and gaps,
          // so the title keeps one size in both views.
          //
          // Real catalogue titles are long and arrive with enrichment, so the
          // text has to be allowed to break: a word that refuses to wrap sets
          // a floor under the row that a narrow screen cannot honour.
          h.Class('text-lg [overflow-wrap:anywhere]'),
        ],
        [
          h.a(
            [
              h.Href(href),
              h.AriaLabel(
                title === null
                  ? openLabel
                  : translate(locale, 'course.open', {
                      code: course.courseCode,
                      title,
                    }),
              ),
              h.Class('text-on-surface'),
            ],
            [title ?? openLabel],
          ),
        ],
      ),
    ],
  );
  const originsBlock = h.div(
    [
      h.Class('flex flex-wrap items-center gap-2'),
      h.Role('group'),
      h.AriaLabel(translate(locale, 'list.rowOrigins', { code: course.courseCode })),
    ],
    [
      ...(savedCourse === null
        ? []
        : [h.span([h.Class(systemBadgeClass)], [translate(locale, 'list.savedBadge')])]),
      ...(resultCourse === null
        ? []
        : [h.span([h.Class(systemBadgeClass)], [translate(locale, 'list.resultBadge')])]),
      savedCourse === null
        ? h.span(
            [h.Class('text-on-surface-variant text-sm')],
            [translate(locale, 'list.resultOnlyHelp')],
          )
        : h.empty,
    ],
  );
  const labelsBlock =
    savedCourse === null
      ? h.empty
      : h.div(
          [
            h.Class('flex flex-wrap items-center gap-2'),
            h.Role('group'),
            h.AriaLabel(translate(locale, 'list.rowLabels', { code: course.courseCode })),
          ],
          [
            ...labels.map((label) => labelChip(label, null, h)),
            labels.length === 0
              ? h.span(
                  [h.Class('text-on-surface-variant text-sm')],
                  [translate(locale, 'list.rowNoLabels')],
                )
              : h.empty,
          ],
        );

  /** Actions depend on ownership: result-only rows can become explicitly saved,
   *  while saved rows retain their existing label and removal controls. */
  const rowActions = h.div(
    [h.Class(savedRowActionsClass)],
    [
      labelsAction,
      savedCourse === null
        ? savedCourseToggle(course.courseCode, false, 'ready', locale, '', 'state', h)
        : savedCourseToggle(course.courseCode, true, 'ready', locale, '', 'destructive', h),
    ],
  );
  /**
   * Compact keeps the same saved-course identity, its current offering, its
   * labels, and its primary actions in one scan line. The evidence, findings,
   * and private note are not rewritten or summarized here — they stay whole in
   * card view and in Inspect, so density never changes what is known.
   */
  if (density === 'compact') {
    const offering =
      item === null ? null : courseOfferingFacts(item, decisionSignal ?? 'idle', locale);
    const facts =
      offering === null
        ? resultSummary(course, locale)
        : `${offering.credits} · ${offering.term} · ${offering.place}`;
    return h.li(
      [],
      [
        h.article(
          [h.Class(`${savedRowClass(isSelected)} gap-2 p-[0.8rem]`)],
          [
            h.div([h.Class(savedRowHeaderClass)], [selectionCheckbox, identityBlock, rowActions]),
            h.p(
              [h.Class('m-0 text-on-surface-variant text-sm leading-[1.4]')],
              [facts ?? translate(locale, 'list.factsNotLoaded')],
            ),
            originsBlock,
            labelsBlock,
          ],
        ),
      ],
    );
  }
  return h.li(
    [],
    [
      h.article(
        [h.Class(savedRowClass(isSelected))],
        [
          h.div([h.Class(savedRowHeaderClass)], [selectionCheckbox, identityBlock, rowActions]),
          originsBlock,
          labelsBlock,
          item === null
            ? h.div(
                [
                  h.Class(
                    'grid gap-1 p-3 rounded-m3-medium bg-surface-container text-on-surface-variant',
                  ),
                ],
                [
                  h.p([h.Class(factDtClass)], [translate(locale, 'list.factsNotLoaded')]),
                  h.p(
                    [h.Class('m-0 text-sm leading-[1.4]')],
                    [translate(locale, 'list.factsNotLoadedHelp')],
                  ),
                ],
              )
            : courseIdentityFacts(item, decisionSignal ?? 'idle', locale, h),
          decisionSignal === null && gradeSignal === null
            ? h.empty
            : h.div(
                [
                  h.Class(
                    'grid min-w-0 gap-3 [@media(min-width:64rem)]:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]',
                  ),
                ],
                [
                  decisionSignal === null ? h.empty : decisionSignalView(decisionSignal, locale, h),
                  gradeSignal === null
                    ? h.empty
                    : gradeSignalView(gradeSignal, locale, outcomeView, h),
                ],
              ),
          resultEvidence(course, locale, h),
          savedCourse === null
            ? h.empty
            : h.form(
                [
                  h.Class('grid gap-2'),
                  h.OnSubmit(SubmittedSavedNote({ courseCode: course.courseCode })),
                ],
                [
                  h.label(
                    [h.For(noteFieldId), h.Class(fieldLabelClass)],
                    [translate(locale, 'list.note')],
                  ),
                  h.textarea([
                    h.Id(noteFieldId),
                    h.Rows(2),
                    h.Value(noteDraft),
                    h.Placeholder(translate(locale, 'list.notePlaceholder')),
                    h.AriaDescribedBy(noteHelpId),
                    h.Class(noteFieldClass),
                    h.OnInput((value) =>
                      UpdatedSavedNoteDraft({ courseCode: course.courseCode, value }),
                    ),
                  ]),
                  h.p(
                    [
                      h.Id(noteHelpId),
                      h.Class('m-0 text-on-surface-variant text-xs leading-[1.4]'),
                    ],
                    [translate(locale, 'list.noteHelp')],
                  ),
                  h.div(
                    [h.Class('flex flex-wrap gap-3')],
                    [
                      Button.view<Message>(
                        {
                          type: 'submit',
                          toView: (attributes) =>
                            h.button(
                              [
                                ...attributes.button,
                                h.Class(`${compactButtonBase} ${buttonSecondary} min-h-11`),
                              ],
                              [translate(locale, 'list.saveNote')],
                            ),
                        },
                        h,
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

const courseCountLabel = (count: number, locale: Localization): string =>
  count === 1
    ? translate(locale, 'list.courseCountOne')
    : translate(locale, 'list.courseCountMany', { count });

const originFilterLabel = (
  filter: CourseOriginFilter,
  count: number,
  locale: Localization,
): string =>
  translate(
    locale,
    filter === 'all'
      ? 'list.originAll'
      : filter === 'saved'
        ? 'list.originSaved'
        : 'list.originResults',
    { count },
  );

const originFilterView = (
  model: Model,
  courses: ReadonlyArray<StudentCourse>,
  h: HtmlBuilder<Message>,
): Html =>
  h.div(
    [
      h.Class('flex flex-wrap items-center gap-2'),
      h.Role('group'),
      h.AriaLabel(translate(model.localization, 'list.originFilter')),
    ],
    courseOriginFilters.map((filter) => {
      const selected = model.courseOriginFilter === filter;
      const label = originFilterLabel(
        filter,
        filterStudentCoursesByOrigin(courses, filter).length,
        model.localization,
      );
      return Button.view<Message>(
        {
          type: 'button',
          onClick: ChangedCourseOriginFilter({ value: filter }),
          toView: (attributes) =>
            h.button(
              [
                ...attributes.button,
                h.Class(
                  `${compactButtonBase} min-h-11 rounded-full border px-4 ${
                    selected
                      ? 'border-primary bg-primary text-on-primary'
                      : 'border-outline bg-surface-container text-on-surface'
                  }`,
                ),
                h.AriaPressed(String(selected)),
              ],
              [label],
            ),
        },
        h,
      );
    }),
  );

const nameList = (
  names: ReadonlyArray<string>,
  locale: Localization,
  type: 'conjunction' | 'disjunction',
): string => new Intl.ListFormat(localeTag(locale.locale), { style: 'long', type }).format(names);

const labelsFromIds = (
  state: SavedListState,
  labelIds: ReadonlyArray<string>,
): ReadonlyArray<Label> =>
  labelIds
    .map((labelId) => findLabel(state, labelId))
    .filter((label): label is Label => label !== null);

/**
 * The names a filter group selects, with the derived `Unlabeled` set reading as
 * one more name so the restated sentence never has to special-case it.
 */
const predicateNames = (
  state: SavedListState,
  labelIds: ReadonlyArray<string>,
  unlabeled: boolean,
  locale: Localization,
): ReadonlyArray<string> => [
  ...labelsFromIds(state, labelIds).map((label) => label.name),
  ...(unlabeled ? [translate(locale, 'list.filterUnlabeled')] : []),
];

/**
 * The active recipe restated in the student's language. `All` reads as a
 * conjunction and `Any` as a disjunction, so the sentence and the switch can
 * never disagree about what is being shown.
 */
const labelFilterSummary = (
  state: SavedListState,
  filter: LabelFilter,
  locale: Localization,
): string => {
  const included = predicateNames(state, filter.includeLabelIds, filter.includeUnlabeled, locale);
  const excluded = predicateNames(state, filter.excludeLabelIds, filter.excludeUnlabeled, locale);
  const includedText = nameList(
    included,
    locale,
    filter.includeMode === 'all' ? 'conjunction' : 'disjunction',
  );
  const excludedText = nameList(excluded, locale, 'conjunction');
  if (included.length > 0 && excluded.length > 0) {
    return translate(locale, 'list.filterSummaryBoth', {
      labels: includedText,
      excluded: excludedText,
    });
  }
  if (included.length > 0) {
    return translate(locale, 'list.filterSummaryInclude', { labels: includedText });
  }
  if (excluded.length > 0) {
    return translate(locale, 'list.filterSummaryExclude', { excluded: excludedText });
  }
  return translate(locale, 'list.filterSummaryNone');
};

const labelFilterChipClass = (included: boolean): string =>
  `${compactButtonBase} inline-flex min-h-11 items-center gap-2 rounded-[1.5rem] border px-3 text-sm font-bold ${
    included
      ? 'border-primary bg-primary-container text-on-primary-container'
      : 'border-outline bg-surface-container text-on-surface'
  }`;

/**
 * One exclusion control for every predicate: a real label carries its colour
 * dot, the derived `Unlabeled` set carries none, and both read the same way.
 */
const excludeCheckbox = (
  id: string,
  isExcluded: boolean,
  predicate: LabelPredicate,
  name: string,
  dot: Html,
  locale: Localization,
  h: HtmlBuilder<Message>,
): Html => {
  return Checkbox.view<Message>(
    {
      id,
      isChecked: isExcluded,
      onToggle: (checked) => ChangedLabelExclusion({ predicate, isExcluded: checked }),
      toView: (attributes) =>
        h.label(
          [
            ...attributes.label,
            h.Class(
              'inline-flex min-h-11 items-center gap-[0.55rem] rounded-[1.5rem] border border-outline px-3 text-sm text-on-surface-variant cursor-pointer has-[[data-checked]]:border-error has-[[data-checked]]:bg-error-container has-[[data-checked]]:text-on-error-container',
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
              [isExcluded ? '✓' : ''],
            ),
            dot,
            h.span([], [translate(locale, 'list.filterExclude', { name })]),
          ],
        ),
    },
    h,
  );
};

/**
 * Label chips are the ordinary path: tap a label to include it. `All` and
 * `Exclude` live behind one progressive disclosure, so the common case stays a
 * single tap and the bounded composition is still reachable by keyboard.
 */
const labelFilterView = (model: Model, state: SavedListState, h: HtmlBuilder<Message>): Html => {
  const locale = model.localization;
  const labels = labelsByName(state);
  if (labels.length === 0) {
    return h.section(
      [
        h.Class(
          'grid gap-2 p-4 border border-outline-variant rounded-m3-large bg-surface-container-low',
        ),
        h.AriaLabel(translate(locale, 'list.labels')),
      ],
      [
        h.p([h.Class(factDtClass)], [translate(locale, 'list.labelsHeading')]),
        h.p(
          [h.Class('m-0 text-on-surface-variant text-sm leading-[1.45]')],
          [translate(locale, 'list.noLabels')],
        ),
        h.div([h.Class('flex')], [labelDialogAction([], locale, h)]),
      ],
    );
  }
  const filter = model.labelFilter;
  const included = new Set(filter.includeLabelIds);
  const excluded = new Set(filter.excludeLabelIds);
  const contradictory = predicateNames(
    state,
    model.labelFilterNotice?.contradictoryLabelIds ?? [],
    model.labelFilterNotice?.contradictoryUnlabeled ?? false,
    locale,
  );
  const unknownCount = model.labelFilterNotice?.unknownCount ?? 0;
  const unsatisfiable = normalizeLabelFilter(state, filter).isUnsatisfiable;
  const unlabeledName = translate(locale, 'list.filterUnlabeled');
  /**
   * `Unlabeled` sits with the label chips because it is one more way to name a
   * collection, but it is derived from membership rather than stored: it has no
   * colour swatch, cannot be renamed, and cannot go stale.
   */
  const unlabeledChip = Button.view<Message>(
    {
      type: 'button',
      onClick: ChangedLabelInclusion({
        predicate: filterUnlabeled,
        isIncluded: !filter.includeUnlabeled,
      }),
      toView: (attributes) =>
        h.button(
          [
            ...attributes.button,
            h.Class(`${labelFilterChipClass(filter.includeUnlabeled)} border-dashed`),
            h.AriaPressed(String(filter.includeUnlabeled)),
          ],
          [
            h.span([], [unlabeledName]),
            labelCountBadge(unlabeledCourseCount(state), locale, h),
            filter.excludeUnlabeled
              ? h.span(
                  [h.Class('text-xs font-extrabold uppercase')],
                  [translate(locale, 'list.filterExcludedBadge')],
                )
              : h.empty,
          ],
        ),
    },
    h,
  );
  const includeChips = labels.map((label) =>
    Button.view<Message>(
      {
        type: 'button',
        onClick: ChangedLabelInclusion({
          predicate: filterLabel(label.id),
          isIncluded: !included.has(label.id),
        }),
        toView: (attributes) =>
          h.button(
            [
              ...attributes.button,
              h.Class(labelFilterChipClass(included.has(label.id))),
              h.AriaPressed(String(included.has(label.id))),
            ],
            [
              labelDot(label.color, h),
              h.span([], [label.name]),
              labelCountBadge(labelCourseCount(state, label.id), locale, h),
              excluded.has(label.id)
                ? h.span(
                    [h.Class('text-xs font-extrabold uppercase')],
                    [translate(locale, 'list.filterExcludedBadge')],
                  )
                : h.empty,
            ],
          ),
      },
      h,
    ),
  );

  /**
   * `Any` and `All` only differ once two predicates are included: with one,
   * both readings select the same courses, so offering the choice would be
   * offering nothing. The switch appears when it starts to mean something, and
   * carries the size of each outcome so the decision reads as a result rather
   * than as a connective.
   */
  const includedPredicateCount = filter.includeLabelIds.length + (filter.includeUnlabeled ? 1 : 0);
  const countFor = (mode: LabelFilterMode): number =>
    filterSavedCourses(state, { ...filter, includeMode: mode }).length;
  const includeModeControl =
    includedPredicateCount < 2
      ? h.empty
      : h.submodel({
          slotId: 'label-filter-mode',
          model: model.labelFilterModeRadioGroup,
          view: LabelFilterModeRadioGroup.view,
          viewInputs: {
            options: labelFilterModes,
            selectedValue: Option.some(filter.includeMode),
            ariaLabel: translate(locale, 'list.filterMode'),
            toView: ({ group, options }) =>
              h.div(
                [
                  ...group,
                  h.Class('inline-flex w-fit overflow-hidden rounded-full border border-outline'),
                ],
                options.map((option) =>
                  h.button(
                    [
                      ...option.option,
                      h.Class(
                        `min-h-11 cursor-pointer border-0 px-4 text-sm font-extrabold ${
                          option.isSelected
                            ? 'bg-primary text-on-primary'
                            : 'bg-surface-container text-on-surface'
                        }`,
                      ),
                    ],
                    [
                      translate(
                        locale,
                        option.value === 'all' ? 'list.filterModeAll' : 'list.filterModeAny',
                      ),
                      h.span(
                        [h.Class('ml-2 font-bold tabular-nums opacity-[0.75]')],
                        [countFor(option.value).toLocaleString(localeTag(locale.locale))],
                      ),
                    ],
                  ),
                ),
              ),
          },
          toParentMessage: (message) => GotLabelFilterModeRadioGroupMessage({ message }),
        });

  return h.section(
    [
      h.Class(
        'grid gap-3 p-4 border border-outline-variant rounded-m3-large bg-surface-container-low',
      ),
      h.AriaLabel(translate(locale, 'list.filterHeading')),
    ],
    [
      h.div(
        [h.Class('flex flex-wrap items-center justify-between gap-3')],
        [
          h.p([h.Class(factDtClass)], [translate(locale, 'list.filterHeading')]),
          labelDialogAction([], locale, h),
        ],
      ),
      /**
       * Include and Exclude are peers, so they are shown as peers. Exclusion
       * used to live behind a disclosure, which made the harder half of the
       * language the hidden half.
       */
      h.div(
        [h.Class('grid gap-2')],
        [
          h.div(
            [h.Class('flex flex-wrap items-center justify-between gap-2')],
            [
              h.p([h.Class(factDtClass)], [translate(locale, 'list.filterIncludeHeading')]),
              includeModeControl,
            ],
          ),
          h.div(
            [
              h.Class('flex flex-wrap gap-2'),
              h.Role('group'),
              h.AriaLabel(translate(locale, 'list.filterIncludeHeading')),
            ],
            [...includeChips, unlabeledChip],
          ),
        ],
      ),
      h.div(
        [h.Class('grid gap-2')],
        [
          h.p([h.Class(factDtClass)], [translate(locale, 'list.filterExcludeHeading')]),
          h.div(
            [
              h.Class('flex flex-wrap gap-2'),
              h.Role('group'),
              h.AriaLabel(translate(locale, 'list.filterExcludeHeading')),
            ],
            [
              ...labels.map((label) =>
                excludeCheckbox(
                  `exclude-${label.id}`,
                  excluded.has(label.id),
                  filterLabel(label.id),
                  label.name,
                  labelDot(label.color, h),
                  locale,
                  h,
                ),
              ),
              excludeCheckbox(
                'exclude-unlabeled',
                filter.excludeUnlabeled,
                filterUnlabeled,
                unlabeledName,
                h.empty,
                locale,
                h,
              ),
            ],
          ),
          h.p(
            [h.Class('m-0 text-on-surface-variant text-xs leading-[1.45]')],
            [translate(locale, 'list.filterExcludeHelp')],
          ),
        ],
      ),
      h.p(
        [h.Class('m-0 text-on-surface-variant text-sm leading-[1.45]'), h.AriaLive('polite')],
        [labelFilterSummary(state, filter, locale)],
      ),
      contradictory.length === 0
        ? h.empty
        : h.p(
            [
              h.Class(
                'm-0 py-2 px-3 rounded-m3-medium bg-warning-container text-on-warning-container text-sm leading-[1.4]',
              ),
              h.Role('status'),
            ],
            [
              translate(locale, 'list.filterContradiction', {
                labels: nameList(contradictory, locale, 'conjunction'),
              }),
            ],
          ),
      // An `All` of Unlabeled and a real label cannot match anything: a course
      // either carries a label or carries none. The recipe is kept as asked and
      // explained here, rather than silently rewritten or shown as an empty List
      // with no reason.
      unsatisfiable
        ? h.p(
            [
              h.Class(
                'm-0 py-2 px-3 rounded-m3-medium bg-warning-container text-on-warning-container text-sm leading-[1.4]',
              ),
              h.Role('status'),
            ],
            [translate(locale, 'list.filterUnsatisfiable', { unlabeled: unlabeledName })],
          )
        : h.empty,
      unknownCount === 0
        ? h.empty
        : h.p(
            [
              h.Class(
                'm-0 py-2 px-3 rounded-m3-medium bg-warning-container text-on-warning-container text-sm leading-[1.4]',
              ),
              h.Role('status'),
            ],
            [translate(locale, 'list.filterUnknownDropped', { count: unknownCount })],
          ),
      isLabelFilterActive(filter)
        ? Button.view<Message>(
            {
              type: 'button',
              onClick: ClearedLabelFilter(),
              toView: (attributes) =>
                h.button(
                  [
                    ...attributes.button,
                    h.Class(`${compactButtonBase} ${buttonSecondary} justify-self-start min-h-11`),
                  ],
                  [translate(locale, 'list.filterClear')],
                ),
            },
            h,
          )
        : h.empty,
    ],
  );
};

const labelDialogAction = (
  courseCodes: ReadonlyArray<string>,
  locale: Localization,
  h: HtmlBuilder<Message>,
): Html => {
  const forSelection = courseCodes.length > 0;
  return Button.view<Message>(
    {
      type: 'button',
      onClick: RequestedLabelDialog({ courseCodes }),
      toView: (attributes) =>
        h.button(
          [
            ...attributes.button,
            h.Class(groupedAction('neutral')),
            h.AriaHasPopup('dialog'),
            h.AriaControls('saved-course-labels'),
            ...(forSelection ? [] : [h.AriaLabel(translate(locale, 'list.labelsManageOnly'))]),
          ],
          [translate(locale, forSelection ? 'list.selectionAddLabels' : 'list.labels')],
        ),
    },
    h,
  );
};

const selectionTrayClass =
  '@container pointer-events-auto grid gap-3 p-3 border border-outline rounded-[1.5rem] bg-surface-container-high shadow-m3-2 @min-[28rem]:flex @min-[28rem]:flex-wrap @min-[28rem]:items-center @min-[28rem]:justify-between';

/**
 * Layout answers to a container's own width at three named widths, and only
 * those three. They are a scale, not measurements: six hand-picked thresholds
 * had accumulated, which is the same drift as hand-picked font sizes — numbers
 * near enough to look deliberate and far enough apart to disagree.
 *
 *   24rem  two short facts can sit side by side
 *   28rem  a group of controls becomes a row
 *   32rem  a header gives its controls the far side
 *
 * Tailwind reads class names out of source text, so these cannot be composed
 * from a variable — `${threshold}:grid-cols-2` is never generated. The scale
 * therefore lives as literal strings held in named constants, and
 * `tests/architecture.test.ts` keeps a fourth from appearing.
 */

/**
 * A group of controls: one full-width column first, a row once the container
 * has the width for one.
 *
 * Stacked, buttons share a width and centre their labels, so the column reads
 * as one block of choices rather than a ragged edge of differently sized
 * pills. Side by side they take only the width their labels need. Either way
 * the group answers to its own container, so the same rule holds in a tray
 * pinned above the bottom bar and in a panel inside the reading column.
 */
const controlGroupClass =
  'grid gap-2 [&>*]:w-full [&>*]:justify-center @min-[28rem]:flex @min-[28rem]:flex-wrap @min-[28rem]:items-center @min-[28rem]:[&>*]:w-auto';

/**
 * Everything that hovers over the page bottom shares one stack, so the pieces
 * space themselves instead of each guessing the other's height — a guess that
 * breaks the moment a message wraps to a second line. The container ignores
 * pointer events; the cards inside take them back, so the page underneath
 * stays clickable through the gaps.
 *
 * It clears the bottom bar on the narrow layout and settles into the corner on
 * a wide one, where a full-width bar would be a banner across the reading
 * column rather than a notice beside it.
 */
const bottomStackClass =
  'pointer-events-none fixed inset-x-4 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-11 grid justify-items-stretch gap-2 [@media(min-width:48rem)_and_(min-height:34rem)]:inset-x-auto [@media(min-width:48rem)_and_(min-height:34rem)]:right-4 [@media(min-width:48rem)_and_(min-height:34rem)]:bottom-4 [@media(min-width:48rem)_and_(min-height:34rem)]:w-[min(calc(100%-2rem),28rem)]';

/** The selected saved courses, resolved once for whatever needs to act on them. */
export const selectedSavedCourses = (model: Model): ReadonlyArray<SavedCourse> => {
  const state = savedListState(model.savedCourses);
  // The tray acts on rows of the saved list, so it belongs to that page only.
  if (state === null || model.route !== 'list') return [];
  const selectedCodes = new Set(model.selectedCourseCodes);
  return savedCoursesNewestFirst(state).filter((course) => selectedCodes.has(course.courseCode));
};

export const bottomStackView = (
  model: Model,
  selected: ReadonlyArray<SavedCourse>,
  h: HtmlBuilder<Message>,
): Html => {
  const status = savedListActionStatus(model, h);
  const tray = selectionTrayView(model, selected, h);
  /**
   * Refine floats over the same region, so it belongs to the same stack.
   * Centred in its own fixed box it landed on top of a notice; here the stack
   * spaces them, and the rule stays "one owner of the page bottom".
   */
  const refine =
    model.route === 'explore' && model.selectedCode === null
      ? catalogueRefineAction(model, h)
      : h.empty;
  if (status === h.empty && tray === h.empty && refine === h.empty) return h.empty;
  return h.div([h.Class(bottomStackClass)], [status, tray, refine]);
};

/**
 * Selection is distinct from saving and stays ephemeral: it lives only in the
 * session, and the tray disappears with it.
 *
 * Labelling leads because it is the additive act. Removal is secondary and
 * asks first, because it discards notes and label attachments across several
 * courses at once — the confirmation swaps the tray's actions in place rather
 * than opening a dialog, matching how deleting a label already asks. A single
 * course still removes without a prompt: undo restores it, and prompting for
 * a reversible act only teaches the student to dismiss prompts.
 */
const selectionTrayView = (
  model: Model,
  selected: ReadonlyArray<SavedCourse>,
  h: HtmlBuilder<Message>,
): Html => {
  if (selected.length === 0) return h.empty;
  const locale = model.localization;
  return h.div(
    [
      h.Class(selectionTrayClass),
      h.Role('region'),
      h.AriaLabel(translate(locale, 'list.selectionTray')),
    ],
    [
      h.p(
        [h.Class('m-0 font-bold'), h.AriaLive('polite')],
        [
          selected.length === 1
            ? translate(locale, 'list.selectionCountOne')
            : translate(locale, 'list.selectionCount', { count: selected.length }),
        ],
      ),
      model.selectionRemovePending
        ? h.div(
            [h.Class(`${controlGroupClass} @container`), h.Role('group')],
            [
              h.p(
                [h.Class('m-0 basis-full text-sm leading-[1.45]'), h.Role('status')],
                [translate(locale, 'list.selectionRemoveConfirm', { count: selected.length })],
              ),
              Button.view<Message>(
                {
                  type: 'button',
                  onClick: ConfirmedRemoveSelected(),
                  toView: (attributes) =>
                    h.button(
                      [
                        ...attributes.button,
                        h.Class(
                          `${compactButtonBase} min-h-11 rounded-[1.5rem] border border-error bg-error-container px-3 text-sm font-bold text-on-error-container`,
                        ),
                      ],
                      [translate(locale, 'list.selectionRemoveConfirmAction')],
                    ),
                },
                h,
              ),
              Button.view<Message>(
                {
                  type: 'button',
                  onClick: CancelledRemoveSelected(),
                  toView: (attributes) =>
                    h.button(
                      [
                        ...attributes.button,
                        h.Class(`${compactButtonBase} ${buttonSecondary} min-h-11`),
                      ],
                      [translate(locale, 'list.selectionRemoveCancel')],
                    ),
                },
                h,
              ),
            ],
          )
        : h.div(
            [h.Class(controlGroupClass)],
            [
              selected.length < compareMinimum || selected.length > compareMaximum
                ? h.empty
                : Button.view<Message>(
                    {
                      type: 'button',
                      onClick: RequestedCompare(),
                      toView: (attributes) =>
                        h.button(
                          [
                            ...attributes.button,
                            h.Class(`${compactButtonBase} ${buttonPrimary} min-h-11`),
                          ],
                          [translate(locale, 'compare.open')],
                        ),
                    },
                    h,
                  ),
              labelDialogAction(
                selected.map((course) => course.courseCode),
                locale,
                h,
              ),
              Button.view<Message>(
                {
                  type: 'button',
                  onClick: ClearedSavedCourseSelection(),
                  toView: (attributes) =>
                    h.button(
                      [
                        ...attributes.button,
                        h.Class(`${compactButtonBase} ${buttonSecondary} min-h-11`),
                      ],
                      [translate(locale, 'list.selectionClear')],
                    ),
                },
                h,
              ),
              Button.view<Message>(
                {
                  type: 'button',
                  onClick: RequestedRemoveSelected(),
                  toView: (attributes) =>
                    h.button(
                      [
                        ...attributes.button,
                        h.Class(
                          `${compactButtonBase} min-h-11 rounded-[1.5rem] border border-error bg-error-container px-3 text-sm font-bold text-on-error-container`,
                        ),
                      ],
                      [translate(locale, 'list.selectionRemove')],
                    ),
                },
                h,
              ),
            ],
          ),
    ],
  );
};

const recoveryMessage = (
  recovery: Extract<SavedCoursesResult, { readonly _tag: 'SavedCoursesRecovery' }>,
  locale: Localization,
): string =>
  M.value(recovery.reason).pipe(
    M.when('unavailable', () => translate(locale, 'list.recoveryUnavailable')),
    M.when('unsupported-version', () =>
      translate(locale, 'list.recoveryUnsupported', {
        version: recovery.storedVersion ?? '?',
      }),
    ),
    M.when('invalid-json', () => translate(locale, 'list.recoveryCorrupt')),
    M.when('unreadable', () => translate(locale, 'list.recoveryCorrupt')),
    M.exhaustive,
  );

/**
 * Recovery never resets anything by itself: the stored value stays readable
 * and the destructive reset is an explicit student action.
 */
const savedCoursesRecoveryView = (
  recovery: Extract<SavedCoursesResult, { readonly _tag: 'SavedCoursesRecovery' }>,
  locale: Localization,
  h: HtmlBuilder<Message>,
): Html => {
  return h.section(
    [
      h.Class(
        'grid gap-3 p-[clamp(1.25rem,4vw,2rem)] border border-error rounded-m3-extra-large bg-error-container text-on-error-container',
      ),
      h.Role('alert'),
    ],
    [
      h.h2(
        [h.Class('text-[clamp(1.3rem,3vw,1.75rem)]')],
        [translate(locale, 'list.recoveryHeading')],
      ),
      h.p([h.Class('m-0 leading-[1.5]')], [recoveryMessage(recovery, locale)]),
      h.p([h.Class('m-0 leading-[1.5]')], [translate(locale, 'list.savePaused')]),
      recovery.raw.length === 0
        ? h.empty
        : h.details(
            [h.Class('rounded-m3-medium bg-surface-container-low text-on-surface p-3')],
            [
              h.summary(
                [h.Class('cursor-pointer font-bold')],
                [translate(locale, 'list.recoveryShowStored')],
              ),
              h.p(
                [h.Class('mt-2 mb-1 text-on-surface-variant text-sm leading-[1.4]')],
                [translate(locale, 'list.recoveryKept')],
              ),
              h.pre(
                [
                  h.Class(
                    'max-h-60 overflow-auto m-0 p-2 rounded-m3-medium bg-surface-container text-xs whitespace-pre-wrap [overflow-wrap:anywhere]',
                  ),
                ],
                [recovery.raw],
              ),
            ],
          ),
      h.p([h.Class('m-0 text-sm leading-[1.4]')], [translate(locale, 'list.resetHelp')]),
      Button.view<Message>(
        {
          type: 'button',
          onClick: RequestedSavedCoursesReset(),
          toView: (attributes) =>
            h.button(
              [
                ...attributes.button,
                h.Class(`${compactButtonBase} ${buttonSecondary} justify-self-start`),
              ],
              [translate(locale, 'list.reset')],
            ),
        },
        h,
      ),
    ],
  );
};

/**
 * The density switch. It is a display preference, so it sits with the count
 * rather than with the collection recipe, stays out of the URL, and never
 * changes which courses are shown.
 */
const listDensityChoice = (
  density: ListDensity,
  locale: Localization,
  radioGroup: Model['listDensityRadioGroup'],
  h: HtmlBuilder<Message>,
): Html =>
  h.submodel({
    slotId: 'list-density',
    model: radioGroup,
    view: ListDensityRadioGroup.view,
    viewInputs: {
      options: listDensities,
      selectedValue: Option.some(density),
      ariaLabel: translate(locale, 'list.density'),
      orientation: 'Horizontal',
      toView: ({ group, options }) =>
        h.div(
          [
            ...group,
            h.Class(
              'inline-flex w-fit flex-none overflow-hidden rounded-full border border-outline',
            ),
          ],
          options.map((option) =>
            h.button(
              [
                ...option.option,
                h.Type('button'),
                h.Class(
                  `min-h-11 cursor-pointer border-0 px-3 text-sm font-bold ${
                    option.isSelected
                      ? 'bg-primary text-on-primary'
                      : 'bg-surface-container text-on-surface'
                  }`,
                ),
              ],
              [
                translate(
                  locale,
                  option.value === 'card' ? 'list.densityCard' : 'list.densityCompact',
                ),
              ],
            ),
          ),
        ),
    },
    toParentMessage: (message) => GotListDensityRadioGroupMessage({ message }),
  });

const savedCourseListView = (
  model: Model,
  state: SavedListState,
  repaired: number,
  h: HtmlBuilder<Message>,
): Html => {
  const total = projectedStudentCourses(model);
  const matchingSavedIds = new Set(
    filterSavedCourses(state, model.labelFilter).map((course) => course.id),
  );
  const labelFilterActive = isLabelFilterActive(model.labelFilter);
  const afterLabels = labelFilterActive
    ? total.filter(
        (course) => course.savedCourse !== null && matchingSavedIds.has(course.savedCourse.id),
      )
    : total;
  const courses = filterStudentCoursesByOrigin(afterLabels, model.courseOriginFilter);
  const selectedCodes = new Set(model.selectedCourseCodes);
  const filterActive = labelFilterActive || model.courseOriginFilter !== 'all';
  if (total.length === 0) {
    return h.section(
      [h.Class(stateCardBase), h.Role('status')],
      [
        h.h2([h.Class(stateCardH2Class)], [translate(model.localization, 'list.empty')]),
        h.p([h.Class(stateCardPClass)], [translate(model.localization, 'list.emptyHelp')]),
        h.a(
          [
            h.Href(exploreUrl(model)),
            h.Class(`${backButtonClass} mt-4 inline-flex items-center no-underline`),
          ],
          [translate(model.localization, 'list.backToExplore')],
        ),
      ],
    );
  }
  return h.section(
    [h.Class('grid gap-4'), h.AriaLabel(translate(model.localization, 'list.heading'))],
    [
      repaired === 0
        ? h.empty
        : h.div(
            [
              h.Class('py-4 px-5 rounded-m3-medium bg-warning-container text-on-warning-container'),
              h.Role('status'),
            ],
            [translate(model.localization, 'list.repaired', { count: repaired })],
          ),
      (() => {
        const selection = compareSelection(state, model.compareCodes);
        if (selection === null) return h.empty;
        const courses = compareCourses(state, selection);
        const facts: ReadonlyArray<CompareCourseFacts> = courses.map((course) => ({
          course,
          item: catalogueItemForCode(model, course.courseCode),
          decisionSignal: savedDecisionSignal(model, course.courseCode),
          gradeSignal: savedGradeSignal(model, course.courseCode),
        }));
        return h.submodel({
          slotId: 'saved-course-comparison',
          model: initCompare(model.compareCodes, model.compareDifferencesOnly),
          view: compareView,
          viewInputs: {
            locale: model.localization,
            courses,
            facts,
            feedback: feedbackRow(model.localization, h),
          },
          toParentMessage: (message) => GotCompareMessage({ message }),
        });
      })(),
      originFilterView(model, total, h),
      state.savedCourses.length === 0 ? h.empty : labelFilterView(model, state, h),
      h.header(
        [h.Class('flex items-end justify-between gap-4 py-2 px-1 border-b border-outline-variant')],
        [
          h.p(
            [h.AriaLive('polite'), h.Class('m-0 text-on-surface-variant text-sm')],
            [
              filterActive
                ? translate(model.localization, 'list.filteredCount', {
                    shown: courses.length,
                    total: total.length,
                  })
                : courseCountLabel(total.length, model.localization),
            ],
          ),
          listDensityChoice(model.listDensity, model.localization, model.listDensityRadioGroup, h),
        ],
      ),
      // A collection that matches nothing is a filter outcome, never a failure
      // and never an empty course list.
      courses.length === 0
        ? h.section(
            [h.Class(stateCardBase), h.Role('status')],
            [
              h.h2(
                [h.Class(stateCardH2Class)],
                [translate(model.localization, 'list.filterEmpty')],
              ),
              h.p(
                [h.Class(stateCardPClass)],
                [translate(model.localization, 'list.filterEmptyHelp')],
              ),
              Button.view<Message>(
                {
                  type: 'button',
                  onClick: ClearedCourseFilters(),
                  toView: (attributes) =>
                    h.button(
                      [
                        ...attributes.button,
                        h.Class(`${compactButtonBase} ${buttonSecondary} mt-4`),
                      ],
                      [translate(model.localization, 'list.filtersClear')],
                    ),
                },
                h,
              ),
            ],
          )
        : h.ol(
            [h.Class('grid gap-3 p-0 list-none')],
            courses.map((course) =>
              lazySavedCourseRow(course.id, savedCourseRow, [
                normalizedUrl(model, course.courseCode),
                course,
                state,
                catalogueItemForCode(model, course.courseCode),
                savedDecisionSignal(model, course.courseCode),
                savedGradeSignal(model, course.courseCode),
                course.savedCourse === null ? '' : noteDraftFor(model, course.savedCourse),
                course.savedCourse !== null && selectedCodes.has(course.courseCode),
                model.localization,
                model.outcomeView,
                model.listDensity,
                h,
              ]),
            ),
          ),
    ],
  );
};

const labelErrorMessage = (model: Model): string | null => {
  if (model.labelError === null) return null;
  return M.value(model.labelError).pipe(
    M.when('empty-name', () => translate(model.localization, 'list.labelEmptyName')),
    M.when('duplicate-name', () => translate(model.localization, 'list.labelDuplicate')),
    M.when('limit-reached', () =>
      translate(model.localization, 'list.labelLimit', { count: labelsMaxCount }),
    ),
    M.when('unknown-label', () => translate(model.localization, 'list.labelUnknownError')),
    M.exhaustive,
  );
};

/**
 * One dialog owns the whole label vocabulary: create, rename, recolour, delete,
 * and attach or detach across the explicit target. Focus, Escape, and the
 * backdrop belong to the Dialog primitive rather than to hand-written handlers.
 *
 * Attachment across several courses is a three-state answer, so the checkbox is
 * indeterminate when a label is on only some of them and the visible text says
 * how many.
 */
export const labelDialogView = (model: Model, h: HtmlBuilder<Message>): Html => {
  const locale = model.localization;
  const state = savedListState(model.savedCourses);
  const labels = state === null ? [] : labelsByName(state);
  const targets = state === null ? [] : labelTargetIdentities(state, model.labelDialogTarget);
  const heading =
    targets.length === 0
      ? translate(locale, 'list.labelsManageOnly')
      : targets.length === 1
        ? translate(locale, 'list.labelsForCourse', { code: targets[0]!.courseCode })
        : translate(locale, 'list.labelsForSelection', { count: targets.length });
  const error = labelErrorMessage(model);
  const labelErrorId = 'label-draft-name-error';
  // `limit-reached` and `unknown-label` are not about the text in the field, so
  // they are announced without marking the input itself invalid.
  const nameError =
    model.labelError === 'empty-name' || model.labelError === 'duplicate-name' ? error : null;
  const attachmentOf = (
    label: Label,
  ): Readonly<{ matched: number; all: boolean; some: boolean }> => {
    if (state === null || targets.length === 0) return { matched: 0, all: false, some: false };
    const matched = targets.filter((identity) => hasLabel(state, label.id, identity)).length;
    return { matched, all: matched === targets.length, some: matched > 0 };
  };
  const deleteLabelButtonClass = `${compactButtonBase} min-h-11 rounded-[1.5rem] border border-error bg-error-container px-3 text-sm font-bold text-on-error-container`;
  const labelRow = (label: Label, h: HtmlBuilder<Message>): Html => {
    const attachment = attachmentOf(label);
    const count = state === null ? 0 : labelCourseCount(state, label.id);
    const confirmingDelete = model.labelPendingDelete === label.id;
    const labelNameId = `label-row-name-${label.id}`;
    const confirmPromptId = `label-row-confirm-${label.id}`;
    /**
     * Repeated row actions keep one stable visible wording. Interpolating the
     * label name into every button would make each row a different width and
     * read as a ragged column; the association is carried instead by the row's
     * action group, which is named for the label, and by each button's
     * accessible description, which points back at the row's own name.
     *
     * Deletion is permanent and drops every membership on the label, so a
     * misclick cannot delete it: the group's contents swap for an explicit
     * confirm/cancel pair rather than deleting on the first click. No new
     * dialog or focus trap is introduced; both controls stay inside the
     * existing labels Dialog and inside the same, still-named group.
     */
    const actions = h.div(
      [
        h.Class('flex flex-none flex-wrap items-center justify-end gap-2'),
        h.Role('group'),
        h.AriaLabel(translate(locale, 'list.labelRowActions', { name: label.name })),
      ],
      confirmingDelete
        ? [
            h.span(
              [
                h.Id(confirmPromptId),
                h.Role('status'),
                h.AriaLive('polite'),
                h.Class('text-error text-sm'),
              ],
              [translate(locale, 'list.deleteLabelConfirm', { name: label.name })],
            ),
            Button.view<Message>(
              {
                type: 'button',
                onClick: ConfirmedDeleteLabel({ labelId: label.id }),
                toView: (attributes) =>
                  h.button(
                    [
                      ...attributes.button,
                      h.Class(deleteLabelButtonClass),
                      h.AriaDescribedBy(confirmPromptId),
                    ],
                    [translate(locale, 'list.deleteLabel')],
                  ),
              },
              h,
            ),
            Button.view<Message>(
              {
                type: 'button',
                onClick: CancelledLabelDelete(),
                toView: (attributes) =>
                  h.button(
                    [
                      ...attributes.button,
                      h.Class(`${compactButtonBase} ${buttonSecondary} min-h-11`),
                    ],
                    [translate(locale, 'list.cancelDeleteLabel')],
                  ),
              },
              h,
            ),
          ]
        : [
            Button.view<Message>(
              {
                type: 'button',
                onClick: RequestedEditLabel({ labelId: label.id }),
                toView: (attributes) =>
                  h.button(
                    [
                      ...attributes.button,
                      h.Class(`${compactButtonBase} ${buttonSecondary} min-h-11`),
                      h.AriaDescribedBy(labelNameId),
                    ],
                    [translate(locale, 'list.editLabel')],
                  ),
              },
              h,
            ),
            Button.view<Message>(
              {
                type: 'button',
                onClick: RequestedDeleteLabel({ labelId: label.id }),
                toView: (attributes) =>
                  h.button(
                    [
                      ...attributes.button,
                      h.Class(deleteLabelButtonClass),
                      h.AriaDescribedBy(labelNameId),
                    ],
                    [translate(locale, 'list.deleteLabel')],
                  ),
              },
              h,
            ),
          ],
    );
    const identity =
      targets.length === 0
        ? h.div(
            [h.Class('flex min-w-0 flex-1 items-center gap-2')],
            [labelChip(label, labelNameId, h), labelCountBadge(count, locale, h)],
          )
        : Checkbox.view<Message>(
            {
              id: `label-target-${label.id}`,
              isChecked: attachment.all,
              isIndeterminate: attachment.some && !attachment.all,
              onToggle: (isAttached) => ToggledLabelOnTarget({ labelId: label.id, isAttached }),
              toView: (attributes) =>
                h.label(
                  [
                    ...attributes.label,
                    h.Class('flex min-w-0 flex-1 items-center gap-[0.6rem] cursor-pointer'),
                  ],
                  [
                    h.span(
                      [...attributes.checkbox, h.Class(rowCheckboxClass)],
                      [attachment.all ? '✓' : attachment.some ? '–' : ''],
                    ),
                    labelChip(label, labelNameId, h),
                    h.span(
                      [h.Class('text-on-surface-variant text-xs')],
                      [
                        attachment.all && targets.length === 1
                          ? translate(locale, 'list.labelOnCourse', {
                              code: targets[0]!.courseCode,
                            })
                          : attachment.some && !attachment.all
                            ? translate(locale, 'list.labelPartlyOnSelection', {
                                matched: attachment.matched,
                                count: targets.length,
                              })
                            : '',
                      ],
                    ),
                    labelCountBadge(count, locale, h),
                  ],
                ),
            },
            h,
          );
    return h.li(
      [h.Class('flex flex-wrap items-center justify-between gap-3 py-2')],
      [identity, actions],
    );
  };
  const colorChoice = h.submodel({
    slotId: 'label-draft-color',
    model: model.labelDraftColorRadioGroup,
    view: LabelDraftColorRadioGroup.view,
    viewInputs: {
      options: labelColors,
      selectedValue: Option.some(model.labelDraftColor),
      ariaLabel: translate(locale, 'list.labelColor'),
      orientation: 'Horizontal',
      toView: ({ group, options }) =>
        h.div(
          [h.Class('grid gap-2')],
          [
            h.p([h.Class(fieldLabelClass)], [translate(locale, 'list.labelColor')]),
            h.div(
              [...group, h.Class('flex flex-wrap gap-2')],
              options.map((option) =>
                h.button(
                  [
                    ...option.option,
                    // A bare <button> inside a <form> defaults to type="submit",
                    // so without this a colour choice would also Apply the form:
                    // browsing colours would create, rename, and attach labels.
                    h.Type('button'),
                    h.Class(
                      `${compactButtonBase} inline-flex min-h-11 items-center gap-2 rounded-[1.5rem] border px-3 text-sm font-bold ${labelChipTone(option.value)} ${
                        option.isSelected ? 'border-primary' : 'border-outline-variant'
                      }`,
                    ),
                  ],
                  [
                    option.isSelected
                      ? icon('check', 'block size-4 [&_svg]:block [&_svg]:size-full', h)
                      : h.empty,
                    h.span([], [labelColorName(option.value, locale)]),
                  ],
                ),
              ),
            ),
          ],
        ),
    },
    toParentMessage: (message) => GotLabelDraftColorRadioGroupMessage({ message }),
  });
  const form = h.form(
    [h.Class('grid gap-3'), h.OnSubmit(SubmittedLabelForm())],
    [
      Input.view<Message>(
        {
          id: 'label-draft-name',
          value: model.labelDraftName,
          onInput: (value) => UpdatedLabelDraftName({ value }),
          toView: (attributes) =>
            h.div(
              [h.Class('grid')],
              [
                h.label(
                  [...attributes.label, h.Class(fieldLabelClass)],
                  [translate(locale, 'list.labelName')],
                ),
                h.input([
                  ...attributes.input,
                  h.Placeholder(translate(locale, 'list.labelNamePlaceholder')),
                  h.Class(
                    'w-full min-h-14 px-4 border border-outline rounded-m3-medium outline-0 bg-surface-container-low text-on-surface text-base focus-visible:border-primary focus-visible:shadow-[0_0_0_3px_var(--md-sys-color-primary-container)]',
                  ),
                  h.Autocomplete('off'),
                  // Feedback is absent until an Apply attempt; once present it is
                  // tied to the field it describes, so a screen reader reaches it
                  // from the input rather than only through the live region.
                  ...(nameError === null
                    ? []
                    : [h.AriaInvalid(true), h.AriaDescribedBy(labelErrorId)]),
                ]),
              ],
            ),
        },
        h,
      ),
      colorChoice,
      h.div(
        [h.Class('flex flex-wrap justify-end gap-3')],
        [
          Button.view<Message>(
            {
              type: 'submit',
              toView: (attributes) =>
                h.button(
                  [...attributes.button, h.Class(`${compactButtonBase} ${buttonPrimary} min-h-12`)],
                  [
                    translate(
                      locale,
                      model.labelEditing === null ? 'list.addLabel' : 'list.saveLabel',
                    ),
                  ],
                ),
            },
            h,
          ),
          model.labelEditing === null
            ? h.empty
            : Button.view<Message>(
                {
                  type: 'button',
                  onClick: CancelledLabelEdit(),
                  toView: (attributes) =>
                    h.button(
                      [
                        ...attributes.button,
                        h.Class(`${compactButtonBase} ${buttonSecondary} min-h-12`),
                      ],
                      [translate(locale, 'list.cancelLabelEdit')],
                    ),
                },
                h,
              ),
        ],
      ),
    ],
  );
  return h.submodel({
    slotId: 'saved-course-labels-dialog',
    model: model.labelDialog,
    view: Dialog.view,
    viewInputs: {
      toView: ({
        dialog,
        backdrop,
        panel,
        title,
        description,
        initialFocus,
        closeButton,
        isVisible,
      }) =>
        h.dialog(
          [...dialog, h.Class('text-on-surface')],
          isVisible
            ? [
                h.div(
                  [
                    ...backdrop,
                    h.Class(
                      'fixed inset-0 bg-[color-mix(in_srgb,var(--md-sys-color-on-surface)_42%,transparent)] opacity-100 transition-opacity duration-200 ease-in-out data-closed:opacity-0',
                    ),
                  ],
                  [],
                ),
                h.section(
                  [...panel, h.Class(refineDialogPanelClass)],
                  [
                    h.header(
                      [h.Class('flex items-start justify-between gap-4')],
                      [
                        h.div(
                          [],
                          [
                            h.p([h.Class(eyebrowClass)], [translate(locale, 'list.labels')]),
                            h.h2(
                              [
                                ...title,
                                h.Class('text-[clamp(1.5rem,5vw,2rem)] tracking-[-0.035em]'),
                              ],
                              [heading],
                            ),
                            h.p(
                              [
                                ...description,
                                h.Class('mt-[0.4rem] text-on-surface-variant leading-[1.5]'),
                              ],
                              [translate(locale, 'list.labelsHelp')],
                            ),
                          ],
                        ),
                        h.button(
                          [
                            ...closeButton,
                            ...initialFocus,
                            h.Id('saved-course-labels-close'),
                            h.Class(
                              'grid size-11 flex-none place-items-center rounded-full border-0 bg-surface-container text-on-surface cursor-pointer',
                            ),
                            h.Type('button'),
                            h.AriaLabel(translate(locale, 'list.closeLabels')),
                          ],
                          [icon('close', undefined, h)],
                        ),
                      ],
                    ),
                    error === null
                      ? h.empty
                      : h.p(
                          [
                            h.Id(labelErrorId),
                            h.Class(
                              'm-0 py-3 px-4 border border-error rounded-m3-medium bg-error-container text-on-error-container',
                            ),
                            h.Role('alert'),
                          ],
                          [error],
                        ),
                    labels.length === 0
                      ? h.p(
                          [h.Class('m-0 text-on-surface-variant leading-[1.5]')],
                          [translate(locale, 'list.noLabels')],
                        )
                      : h.ul(
                          [
                            h.Class('grid gap-1 m-0 p-0 list-none divide-y divide-outline-variant'),
                            h.AriaLabel(translate(locale, 'list.labelsHeading')),
                          ],
                          labels.map((label) => labelRow(label, h)),
                        ),
                    form,
                  ],
                ),
              ]
            : [],
        ),
    },
    toParentMessage: (message) => GotLabelDialogMessage({ message }),
  });
};

const savedCoursesResultView = (model: Model, h: HtmlBuilder<Message>): Html => {
  switch (model.savedCourses._tag) {
    case 'SavedCoursesLoading':
      return h.section(
        [h.Class(stateCardBase), h.Role('status'), h.AriaLive('polite')],
        [
          h.div([h.Class(loadingIndicatorClass), h.AriaHidden(true)], []),
          h.h2([h.Class(stateCardH2Class)], [translate(model.localization, 'list.loading')]),
          h.p([h.Class(stateCardPClass)], [translate(model.localization, 'list.loadingHelp')]),
        ],
      );
    case 'SavedCoursesRecovery':
      return savedCoursesRecoveryView(model.savedCourses, model.localization, h);
    case 'SavedCoursesReady':
      return savedCourseListView(
        model,
        model.savedCourses.state,
        model.savedCourses.repairedEntries,
        h,
      );
  }
};

export const listView = (model: Model, h: HtmlBuilder<Message>): Html => {
  return h.div(
    [h.Class('grid gap-6')],
    [lazyListHeader(listHeader, [model.localization, h]), savedCoursesResultView(model, h)],
  );
};
