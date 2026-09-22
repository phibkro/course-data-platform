import type {
  CourseDecisionSignalsDtoType,
  CourseGradeSummaryDtoType,
  CourseSearchItemDtoType,
} from '@course-data/course-contracts';
import { Match as M } from 'effect';
import { Button, Dialog, Input } from '@foldkit/ui';
import type { Html, HtmlBuilder } from 'foldkit/html';
import { createKeyedLazy, createLazy } from 'foldkit/html';

import {
  DEFAULT_SORT,
  DEFAULT_TERM,
  ChangedOutcomeView,
  ClosedCourse,
  GotRefineDialogMessage,
  RequestedOpenRefineDialog,
  RequestedMoreCourses,
  RequestedRemoveSavedCourse,
  RequestedSaveCourse,
  SubmittedSearch,
  ToggledEnglish,
  ToggledOpen,
  UpdatedQuery,
  catalogueResponse,
  decisionSignalsResponse,
  isCourseSaved,
  listUrl,
  feedbackRow,
  gradeSignalsResponse,
  normalizedUrl,
  savedToggleAvailability,
  scheduleCourseUrl,
  selectControl,
  checkboxControl,
  type Campus,
  type DecisionSignalsResult,
  type DetailResult,
  type GradeSignalsResult,
  type Level,
  type Message,
  type Model,
  type OutcomeView,
} from '../../app';
import {
  backButtonClass,
  buttonPrimary,
  buttonSecondary,
  compactButtonBase,
  fieldLabelClass,
  eyebrowClass,
  loadingIndicatorClass,
  stateCardBase,
  stateCardFailure,
  stateCardFailurePClass,
  stateCardH2Class,
  stateCardPClass,
  statusLabelErrorClass,
} from '../../app-styles';
import { pageHeader } from '../../components';
import type { CourseSearchResponse, CourseSearchSort } from '../../course-client';
import { courseInsightView } from '../../course-detail';
import {
  assessmentLabel,
  collaborationLabel,
  courseOfferingFacts,
  factStateLabel,
  formatOfferingPeriod,
  formatPercentage,
  gradeScaleLabel,
  type AssessmentForm,
  type DecisionSignal,
} from '../../course-facts';
import { localeTag, translate, translateToken, type Localization } from '../../i18n';
import { collaborationIconName, icon, termSeasonIconName, type AppIcon } from '../../icons';

const lazyCourseCard = createKeyedLazy();
const lazyCatalogueHeader = createLazy();
const lazyCatalogueControls = createLazy();

export const catalogueView = (model: Model, h: HtmlBuilder<Message>): Html => {
  return h.div(
    [h.Class('grid gap-5 pt-[clamp(1.25rem,4vw,3rem)]')],
    [
      lazyCatalogueHeader(catalogueHeader, [model.localization, h]),
      lazyCatalogueControls(catalogueControlsFromValues, [
        model.localization,
        model.query,
        model.term,
        model.campus,
        model.level,
        model.sort,
        model.openOnly,
        model.englishOnly,
        model.catalogue._tag === 'CatalogueInitialLoading',
        model.selectFields,
        h,
      ]),
      catalogueResultView(model, h),
    ],
  );
};

const catalogueHeader = (locale: Localization, h: HtmlBuilder<Message>): Html =>
  pageHeader(
    {
      eyebrow: translate(locale, 'catalogue.eyebrow'),
      title: translate(locale, 'catalogue.heading'),
      description: translate(locale, 'catalogue.intro'),
      showMobileBrand: true,
    },
    h,
  );

interface CatalogueControlsState {
  readonly localization: Localization;
  readonly query: string;
  readonly term: string;
  readonly campus: Campus;
  readonly level: Level;
  readonly sort: CourseSearchSort;
  readonly openOnly: boolean;
  readonly englishOnly: boolean;
  readonly loading: boolean;
  readonly selectFields: Model['selectFields'];
}

const catalogueControlsFromValues = (
  locale: Localization,
  query: string,
  term: string,
  campus: Campus,
  level: Level,
  sort: CourseSearchSort,
  openOnly: boolean,
  englishOnly: boolean,
  loading: boolean,
  selectFields: Model['selectFields'],
  h: HtmlBuilder<Message>,
): Html =>
  catalogueControls(
    {
      localization: locale,
      query,
      term,
      campus,
      level,
      sort,
      openOnly,
      englishOnly,
      loading,
      selectFields,
    },
    {},
    h,
  );

export const catalogueRefineDialogFromValues = (
  locale: Localization,
  query: string,
  term: string,
  campus: Campus,
  level: Level,
  sort: CourseSearchSort,
  openOnly: boolean,
  englishOnly: boolean,
  loading: boolean,
  refineDialog: Model['refineDialog'],
  selectFields: Model['selectFields'],
  h: HtmlBuilder<Message>,
): Html =>
  catalogueRefineDialog(
    {
      localization: locale,
      query,
      term,
      campus,
      level,
      sort,
      openOnly,
      englishOnly,
      loading,
      selectFields,
    },
    refineDialog,
    h,
  );

interface CatalogueControlsOptions {
  readonly className?: string;
  readonly idPrefix?: string;
}

const catalogueControlsFrameClass =
  'grid gap-4 p-[clamp(1rem,3vw,1.5rem)] border border-outline-variant rounded-m3-extra-large bg-surface-container-low shadow-m3-1';

const catalogueControlsSearchClass =
  'flex items-end gap-3 [@media(max-width:37rem)]:items-stretch [@media(max-width:37rem)]:flex-col';

const catalogueControls = (
  model: CatalogueControlsState,
  options: CatalogueControlsOptions,
  h: HtmlBuilder<Message>,
): Html => {
  const loading = model.loading;
  const idPrefix = options.idPrefix ?? '';
  const isDialog = options.className === 'catalogue-controls--dialog';
  return h.form(
    [
      h.Class(isDialog ? 'grid gap-4' : catalogueControlsFrameClass),
      h.Role('search'),
      h.OnSubmit(SubmittedSearch()),
      h.AriaLabel(translate(model.localization, 'catalogue.searchRegion')),
    ],
    [
      h.div(
        [h.Class(catalogueControlsSearchClass)],
        [
          Input.view<Message>(
            {
              id: `${idPrefix}course-query`,
              value: model.query,
              placeholder: translate(model.localization, 'catalogue.searchPlaceholder'),
              onInput: (value) => UpdatedQuery({ value }),
              toView: (attributes) =>
                h.div(
                  [h.Class('flex-1')],
                  [
                    h.label(
                      [...attributes.label, h.Class(fieldLabelClass)],
                      [translate(model.localization, 'catalogue.searchLabel')],
                    ),
                    h.input([
                      ...attributes.input,
                      h.Placeholder(translate(model.localization, 'catalogue.searchPlaceholder')),
                      h.Class(
                        'w-full min-h-14 px-4 border border-outline rounded-m3-medium outline-0 bg-surface-container-low text-on-surface text-base normal-case transition-[border-color,box-shadow] duration-150 ease-in-out focus-visible:border-primary focus-visible:shadow-[0_0_0_3px_var(--md-sys-color-primary-container)] disabled:opacity-70',
                      ),
                      h.Autocomplete('off'),
                    ]),
                  ],
                ),
            },
            h,
          ),
          Button.view<Message>(
            {
              type: 'submit',
              isDisabled: loading,
              toView: (attributes) =>
                h.button(
                  [...attributes.button, h.Class(buttonPrimary)],
                  [
                    loading
                      ? translate(model.localization, 'catalogue.searching')
                      : translate(model.localization, 'catalogue.search'),
                  ],
                ),
            },
            h,
          ),
        ],
      ),
      h.div(
        [
          h.Class(
            isDialog
              ? 'grid gap-3 grid-cols-[repeat(auto-fit,minmax(min(100%,11rem),1fr))]'
              : 'grid max-w-80',
          ),
        ],
        isDialog
          ? [
              selectControl(
                model.selectFields,
                'term-refine',
                translate(model.localization, 'catalogue.term'),
                model.term,
                [
                  [
                    '2026-autumn',
                    formatOfferingPeriod(2026, 'autumn', model.localization),
                    termSeasonIconName('autumn'),
                  ],
                  [
                    '2026-spring',
                    formatOfferingPeriod(2026, 'spring', model.localization),
                    termSeasonIconName('spring'),
                  ],
                  [
                    '2027-autumn',
                    formatOfferingPeriod(2027, 'autumn', model.localization),
                    termSeasonIconName('autumn'),
                  ],
                  [
                    '2027-spring',
                    formatOfferingPeriod(2027, 'spring', model.localization),
                    termSeasonIconName('spring'),
                  ],
                ],
                { portal: false },
                h,
              ),
              selectControl(
                model.selectFields,
                'campus-refine',
                translate(model.localization, 'catalogue.campus'),
                model.campus,
                [
                  ['all', translate(model.localization, 'catalogue.allCampuses')],
                  ['trondheim', translate(model.localization, 'catalogue.trondheim')],
                  ['gjovik', translate(model.localization, 'catalogue.gjovik')],
                  ['alesund', translate(model.localization, 'catalogue.alesund')],
                ],
                { portal: false },
                h,
              ),
              selectControl(
                model.selectFields,
                'level-refine',
                translate(model.localization, 'catalogue.level'),
                model.level,
                [
                  ['all', translate(model.localization, 'catalogue.allLevels')],
                  ['bachelor', translate(model.localization, 'catalogue.bachelor')],
                  ['master', translate(model.localization, 'catalogue.master')],
                  ['phd', translate(model.localization, 'catalogue.phd')],
                ],
                { portal: false },
                h,
              ),
              selectControl(
                model.selectFields,
                'sort-refine',
                translate(model.localization, 'catalogue.sort'),
                model.sort,
                [
                  ['relevance', translate(model.localization, 'catalogue.relevance')],
                  ['title-asc', translate(model.localization, 'catalogue.titleAsc')],
                  ['title-desc', translate(model.localization, 'catalogue.titleDesc')],
                  ['code-asc', translate(model.localization, 'catalogue.codeAsc')],
                  ['code-desc', translate(model.localization, 'catalogue.codeDesc')],
                ],
                { portal: false },
                h,
              ),
            ]
          : [
              selectControl(
                model.selectFields,
                'campus-inline',
                translate(model.localization, 'catalogue.campus'),
                model.campus,
                [
                  ['all', translate(model.localization, 'catalogue.allCampuses')],
                  ['trondheim', translate(model.localization, 'catalogue.trondheim')],
                  ['gjovik', translate(model.localization, 'catalogue.gjovik')],
                  ['alesund', translate(model.localization, 'catalogue.alesund')],
                ],
                {},
                h,
              ),
            ],
      ),
      isDialog
        ? h.div(
            [h.Class('flex flex-wrap gap-3')],
            [
              checkboxControl(
                `${idPrefix}open-admission`,
                translate(model.localization, 'catalogue.openAdmission'),
                model.openOnly,
                (isChecked) => ToggledOpen({ isChecked }),
                h,
              ),
              checkboxControl(
                `${idPrefix}english`,
                translate(model.localization, 'catalogue.english'),
                model.englishOnly,
                (isChecked) => ToggledEnglish({ isChecked }),
                h,
              ),
            ],
          )
        : h.empty,
    ],
  );
};

const activeRefinementCount = (model: Model): number =>
  [
    model.query.trim().length > 0,
    model.term !== DEFAULT_TERM,
    model.campus !== 'all',
    model.level !== 'all',
    model.sort !== DEFAULT_SORT,
    model.openOnly,
    model.englishOnly,
  ].filter(Boolean).length;

const catalogueRefineActionClass =
  'pointer-events-auto flex justify-end [@media(min-width:48rem)_and_(min-height:34rem)]:sticky [@media(min-width:48rem)_and_(min-height:34rem)]:z-5 [@media(min-width:48rem)_and_(min-height:34rem)]:top-4 [@media(min-width:48rem)_and_(min-height:34rem)]:right-auto [@media(min-width:48rem)_and_(min-height:34rem)]:bottom-auto [@media(min-width:48rem)_and_(min-height:34rem)]:flex [@media(min-width:48rem)_and_(min-height:34rem)]:min-h-17 [@media(min-width:48rem)_and_(min-height:34rem)]:items-center [@media(min-width:48rem)_and_(min-height:34rem)]:justify-between [@media(min-width:48rem)_and_(min-height:34rem)]:gap-4 [@media(min-width:48rem)_and_(min-height:34rem)]:py-[0.65rem] [@media(min-width:48rem)_and_(min-height:34rem)]:pr-3 [@media(min-width:48rem)_and_(min-height:34rem)]:pl-4 [@media(min-width:48rem)_and_(min-height:34rem)]:border [@media(min-width:48rem)_and_(min-height:34rem)]:border-outline-variant [@media(min-width:48rem)_and_(min-height:34rem)]:rounded-[1.5rem] [@media(min-width:48rem)_and_(min-height:34rem)]:bg-[color-mix(in_srgb,var(--md-sys-color-surface-container)_92%,transparent)] [@media(min-width:48rem)_and_(min-height:34rem)]:shadow-m3-1 [@media(min-width:48rem)_and_(min-height:34rem)]:backdrop-blur-[1rem]';

const catalogueRefineActionSummaryClass =
  'hidden [@media(min-width:48rem)_and_(min-height:34rem)]:grid [@media(min-width:48rem)_and_(min-height:34rem)]:min-w-0 [@media(min-width:48rem)_and_(min-height:34rem)]:gap-[0.15rem]';

const catalogueRefineActionButtonClass = `${compactButtonBase} inline-flex min-h-12 items-center gap-[0.55rem] py-3 px-4 border border-outline-variant rounded-[1.5rem] bg-primary-container shadow-m3-2 text-on-primary-container font-bold [@media(min-width:48rem)_and_(min-height:34rem)]:flex-none [@media(min-width:48rem)_and_(min-height:34rem)]:shadow-none`;

export const catalogueRefineAction = (model: Model, h: HtmlBuilder<Message>): Html => {
  const count = activeRefinementCount(model);
  return h.div(
    [h.Class(catalogueRefineActionClass)],
    [
      h.div(
        [h.Class(catalogueRefineActionSummaryClass)],
        [
          h.span(
            [h.Class('[@media(min-width:48rem)_and_(min-height:34rem)]:font-bold')],
            [
              count === 0
                ? translate(model.localization, 'catalogue.allCourses')
                : translate(model.localization, 'catalogue.activeRefinements', {
                    count,
                    suffix: model.localization.locale === 'en' && count !== 1 ? 's' : '',
                  }),
            ],
          ),
          h.span(
            [
              h.Class(
                '[@media(min-width:48rem)_and_(min-height:34rem)]:overflow-hidden [@media(min-width:48rem)_and_(min-height:34rem)]:text-on-surface-variant [@media(min-width:48rem)_and_(min-height:34rem)]:text-sm [@media(min-width:48rem)_and_(min-height:34rem)]:text-ellipsis [@media(min-width:48rem)_and_(min-height:34rem)]:whitespace-nowrap',
              ),
            ],
            [translate(model.localization, 'catalogue.refineHelp')],
          ),
        ],
      ),
      h.button(
        [
          h.Class(catalogueRefineActionButtonClass),
          h.Type('button'),
          h.OnClick(RequestedOpenRefineDialog()),
          h.AriaHasPopup('dialog'),
          h.AriaControls('catalogue-refine'),
        ],
        [
          icon('refine', 'block size-5 [&_svg]:block [&_svg]:w-full [&_svg]:h-full', h),
          h.span(
            [],
            [
              count === 0
                ? translate(model.localization, 'catalogue.refine')
                : translate(model.localization, 'catalogue.refineCount', { count }),
            ],
          ),
        ],
      ),
    ],
  );
};

export const refineDialogPanelClass =
  'fixed right-0 bottom-0 left-0 grid max-h-[min(92svh,52rem)] gap-5 pt-5 pr-[max(1rem,env(safe-area-inset-right))] pb-[max(1rem,env(safe-area-inset-bottom))] pl-[max(1rem,env(safe-area-inset-left))] overflow-y-auto border border-outline-variant rounded-t-m3-extra-large bg-surface shadow-m3-2 [transform:translateY(0)] transition-transform duration-200 ease-in-out data-closed:[transform:translateY(100%)] [@media(min-width:48rem)_and_(min-height:34rem)]:top-1/2 [@media(min-width:48rem)_and_(min-height:34rem)]:right-auto [@media(min-width:48rem)_and_(min-height:34rem)]:bottom-auto [@media(min-width:48rem)_and_(min-height:34rem)]:left-1/2 [@media(min-width:48rem)_and_(min-height:34rem)]:w-[min(calc(100%-3rem),44rem)] [@media(min-width:48rem)_and_(min-height:34rem)]:p-6 [@media(min-width:48rem)_and_(min-height:34rem)]:rounded-m3-extra-large [@media(min-width:48rem)_and_(min-height:34rem)]:[transform:translate(-50%,-50%)] [@media(min-width:48rem)_and_(min-height:34rem)]:transition-[opacity,transform] duration-200 ease-in-out [@media(min-width:48rem)_and_(min-height:34rem)]:data-closed:opacity-0 [@media(min-width:48rem)_and_(min-height:34rem)]:data-closed:[transform:translate(-50%,-47%)_scale(0.98)]';

const catalogueRefineDialog = (
  model: CatalogueControlsState,
  refineDialog: Model['refineDialog'],
  h: HtmlBuilder<Message>,
): Html => {
  return h.submodel({
    slotId: 'catalogue-refine-dialog',
    model: refineDialog,
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
                            h.p(
                              [h.Class(eyebrowClass)],
                              [translate(model.localization, 'nav.explore')],
                            ),
                            h.h2(
                              [
                                ...title,
                                h.Class('text-[clamp(1.6rem,6vw,2.25rem)] tracking-[-0.035em]'),
                              ],
                              [translate(model.localization, 'catalogue.refineHeading')],
                            ),
                            h.p(
                              [
                                ...description,
                                h.Class('mt-[0.4rem] text-on-surface-variant leading-[1.5]'),
                              ],
                              [translate(model.localization, 'catalogue.refineDescription')],
                            ),
                          ],
                        ),
                        h.button(
                          [
                            ...closeButton,
                            ...initialFocus,
                            h.Id('catalogue-refine-close'),
                            h.Class(
                              'grid size-11 flex-none p-[0.7rem] place-items-center border-0 rounded-full bg-surface-container text-on-surface cursor-pointer',
                            ),
                            h.Type('button'),
                            h.AriaLabel(
                              translate(model.localization, 'catalogue.closeRefinements'),
                            ),
                          ],
                          [icon('close', undefined, h)],
                        ),
                      ],
                    ),
                    catalogueControls(
                      model,
                      {
                        className: 'catalogue-controls--dialog',
                        idPrefix: 'refine-',
                      },
                      h,
                    ),
                    h.footer(
                      [h.Class('flex justify-end')],
                      [
                        h.button(
                          [
                            ...closeButton,
                            h.Class(`${buttonPrimary} min-w-[min(100%,12rem)]`),
                            h.Type('button'),
                          ],
                          [translate(model.localization, 'catalogue.viewResults')],
                        ),
                      ],
                    ),
                  ],
                ),
              ]
            : [],
        ),
    },
    toParentMessage: (message) => GotRefineDialogMessage({ message }),
  });
};

const catalogueResultView = (model: Model, h: HtmlBuilder<Message>): Html => {
  switch (model.catalogue._tag) {
    case 'CatalogueInitialLoading':
      return h.section(
        [h.Class(stateCardBase), h.Role('status'), h.AriaLive('polite')],
        [
          h.div([h.Class(loadingIndicatorClass), h.AriaHidden(true)], []),
          h.h2([h.Class(stateCardH2Class)], [translate(model.localization, 'catalogue.loading')]),
          h.p([h.Class(stateCardPClass)], [translate(model.localization, 'catalogue.loadingHelp')]),
        ],
      );
    case 'CatalogueFailure':
      return h.section(
        [h.Class(stateCardFailure), h.Role('alert')],
        [
          h.p(
            [h.Class(statusLabelErrorClass)],
            [translate(model.localization, 'catalogue.unavailable')],
          ),
          h.h2(
            [h.Class(stateCardH2Class)],
            [translate(model.localization, 'catalogue.loadFailed')],
          ),
          h.p([h.Class(stateCardFailurePClass)], [model.catalogue.error]),
          h.p(
            [h.Class(stateCardFailurePClass)],
            [translate(model.localization, 'catalogue.retry')],
          ),
        ],
      );
    case 'CatalogueEmpty':
      return h.section(
        [h.Class(stateCardBase), h.Role('status')],
        [
          h.h2([h.Class(stateCardH2Class)], [translate(model.localization, 'catalogue.empty')]),
          h.p([h.Class(stateCardPClass)], [translate(model.localization, 'catalogue.emptyHelp')]),
        ],
      );
    case 'CataloguePartial':
      return catalogueList(model, model.catalogue.response, true, h);
    case 'CatalogueSuccess':
      return catalogueList(model, model.catalogue.response, false, h);
  }
};

const catalogueList = (
  model: Model,
  response: CourseSearchResponse,
  partial: boolean,
  h: HtmlBuilder<Message>,
): Html => {
  const shown = response.items.slice(0, model.visibleCount);
  const canRevealLocal = model.visibleCount < response.items.length;
  const canFetch = response.meta.hasMore;
  return h.section(
    [
      h.Class('grid gap-4'),
      h.AriaLabel(translate(model.localization, 'catalogue.results')),
      h.AriaBusy(model.nextPage._tag === 'NextPageLoading'),
    ],
    [
      partial
        ? h.div(
            [
              h.Class('py-4 px-5 rounded-m3-medium bg-warning-container text-on-warning-container'),
              h.Role('status'),
            ],
            [translate(model.localization, 'catalogue.partial')],
          )
        : h.empty,
      h.header(
        [
          h.Class(
            'flex items-end justify-between gap-4 py-2 px-1 border-b border-outline-variant [@media(max-width:37rem)]:items-start [@media(max-width:37rem)]:flex-col',
          ),
        ],
        [
          h.div(
            [],
            [
              h.h2([], [translate(model.localization, 'catalogue.courses')]),
              h.p(
                [h.AriaLive('polite'), h.Class('text-on-surface-variant text-sm')],
                [
                  translate(model.localization, 'catalogue.showing', {
                    shown: shown.length,
                    total: response.meta.total,
                  }),
                ],
              ),
            ],
          ),
          h.p(
            [h.Class('text-on-surface-variant text-sm')],
            [
              translate(model.localization, 'catalogue.official'),
              ' · ',
              translate(model.localization, 'outcomes.source'),
            ],
          ),
        ],
      ),
      h.ol(
        [h.Class('grid gap-3 p-0 list-none')],
        shown.map((course) =>
          lazyCourseCard(course.courseKey, courseCard, [
            normalizedUrl(model, course.code),
            course,
            decisionSignalForCourse(model.decisionSignals, course.code),
            gradeSignalForCourse(model.gradeSignals, course.code),
            model.localization,
            model.outcomeView,
            isCourseSaved(model.savedCourses, course.code),
            savedToggleAvailability(model.savedCourses),
            listUrl(model),
            isCourseSaved(model.savedCourses, course.code)
              ? scheduleCourseUrl(model, course.code)
              : null,
            h,
          ]),
        ),
      ),
      model.nextPage._tag === 'NextPageFailure'
        ? h.div(
            [h.Class('grid justify-items-center gap-3')],
            [
              h.div(
                [
                  h.Class(
                    'w-full py-[0.9rem] px-4 border border-error rounded-m3-medium bg-error-container text-on-error-container',
                  ),
                  h.Role('alert'),
                ],
                [
                  h.strong([], [translate(model.localization, 'catalogue.moreFailed')]),
                  h.span([], [` ${model.nextPage.error}`]),
                ],
              ),
              Button.view<Message>(
                {
                  type: 'button',
                  onClick: RequestedMoreCourses(),
                  toView: (attributes) =>
                    h.button(
                      [...attributes.button, h.Class(`${buttonSecondary} min-w-[min(100%,18rem)]`)],
                      [translate(model.localization, 'catalogue.showMore')],
                    ),
                },
                h,
              ),
            ],
          )
        : canRevealLocal || canFetch
          ? h.div(
              [
                h.Id('catalogue-scroll-sentinel'),
                h.Class('min-h-px text-center text-sm text-on-surface-variant'),
                h.Role('status'),
                h.AriaLive('polite'),
              ],
              [
                model.nextPage._tag === 'NextPageLoading'
                  ? translate(model.localization, 'catalogue.loadingMore')
                  : '',
              ],
            )
          : h.p(
              [h.Class('m-0 text-on-surface-variant text-center')],
              [translate(model.localization, 'catalogue.end')],
            ),
    ],
  );
};

/**
 * A course card's title anchor carries a whole-card `after:absolute
 * after:inset-0` overlay so the entire card opens Inspect. Any explicit
 * control or link placed inside such a card must share this stacking
 * treatment, or the overlay intercepts its clicks instead of the control.
 */
const aboveCardOverlayClass = 'relative z-[2]';

type SavedToggleTone = 'state' | 'destructive';

const savedToggleClass = (saved: boolean, tone: SavedToggleTone): string =>
  `${compactButtonBase} ${aboveCardOverlayClass} inline-flex min-h-11 flex-none items-center gap-2 rounded-[1.5rem] border px-3 text-sm font-bold ${
    saved
      ? tone === 'destructive'
        ? 'border-error bg-error-container text-on-error-container'
        : 'border-secondary bg-secondary-container text-on-secondary-container'
      : 'border-outline bg-surface-container text-primary'
  }`;

/**
 * Saving is one action with a stable visible verb and a course-specific
 * accessible name. It sits above the whole-card Inspect target rather than
 * inside it, and it never waits for enrichment.
 *
 * Disabled has two distinct causes and never shares a message between them:
 * still loading is transient and self-resolving, while a recovery state is
 * not, so it is named separately and links to where the student can act.
 */
export const savedCourseToggle = (
  courseCode: string,
  saved: boolean,
  availability: 'ready' | 'loading' | 'paused',
  locale: Localization,
  recoveryHref: string,
  tone: SavedToggleTone,
  h: HtmlBuilder<Message>,
): Html => {
  const ready = availability === 'ready';
  const accessibleLabel = translate(locale, saved ? 'list.removeCourse' : 'list.saveCourse', {
    code: courseCode,
  });
  const title =
    availability === 'ready'
      ? accessibleLabel
      : translate(locale, availability === 'loading' ? 'list.savePending' : 'list.savePaused');
  const button = Button.view<Message>(
    {
      type: 'button',
      isDisabled: !ready,
      onClick: saved
        ? RequestedRemoveSavedCourse({ courseCode })
        : RequestedSaveCourse({ courseCode }),
      toView: (attributes) =>
        h.button(
          [
            ...attributes.button,
            h.Id(`saved-toggle-${courseCode}`),
            h.Class(savedToggleClass(saved, tone)),
            h.AriaLabel(accessibleLabel),
            h.Title(title),
          ],
          [
            icon(saved ? 'check' : 'list', 'block size-4 [&_svg]:block [&_svg]:size-full', h),
            h.span([], [translate(locale, saved ? 'list.remove' : 'list.save')]),
          ],
        ),
    },
    h,
  );
  if (availability !== 'paused') return button;
  return h.span(
    [h.Class(`${aboveCardOverlayClass} inline-flex flex-col items-end gap-1`)],
    [
      button,
      h.a(
        [h.Href(recoveryHref), h.Class('text-xs leading-[1.3] underline text-on-surface-variant')],
        [translate(locale, 'list.savePausedLink')],
      ),
    ],
  );
};

const courseCardClass =
  '@container relative grid gap-4 p-[1.1rem] border border-outline-variant rounded-m3-large bg-surface-container-low transition-[border-color,box-shadow] duration-150 ease-in-out has-[a:hover]:border-primary has-[a:hover]:shadow-m3-1 has-[a:focus-visible]:border-primary has-[a:focus-visible]:shadow-m3-1 [@media(min-width:64rem)]:items-stretch [@media(min-width:64rem)]:grid-cols-[minmax(16rem,0.85fr)_minmax(0,1.65fr)]';

export const factDtClass = 'text-current text-xs font-bold tracking-[0.05em] uppercase';

const factDdClass = 'mt-[0.2rem] text-sm leading-[1.35] [overflow-wrap:anywhere]';

type GradeSignal =
  | CourseGradeSummaryDtoType
  | 'loading'
  | 'failure'
  | 'idle'
  | 'missing'
  | 'partial-missing';

const decisionSignalForCourse = (
  state: DecisionSignalsResult,
  courseCode: string,
): DecisionSignal => {
  const signals = decisionSignalsResponse(state)?.items.find(
    (item) => item.courseCode === courseCode,
  );
  if (signals !== undefined) return signals;
  return M.value(state._tag).pipe(
    M.when('DecisionSignalsLoading', () => 'loading' as const),
    M.when('DecisionSignalsFailure', () => 'failure' as const),
    M.when('DecisionSignalsIdle', () => 'idle' as const),
    M.when('DecisionSignalsSuccess', () => 'missing' as const),
    M.exhaustive,
  );
};

const gradeSignalForCourse = (state: GradeSignalsResult, courseCode: string): GradeSignal => {
  const summary = gradeSignalsResponse(state)?.items.find((item) => item.courseCode === courseCode);
  if (summary !== undefined) return summary;
  return M.value(state._tag).pipe(
    M.when('GradeSignalsLoading', () => 'loading' as const),
    M.when('GradeSignalsFailure', () => 'failure' as const),
    M.when('GradeSignalsIdle', () => 'idle' as const),
    M.when('GradeSignalsSuccess', () => 'missing' as const),
    M.when('GradeSignalsPartial', () => 'partial-missing' as const),
    M.exhaustive,
  );
};

/**
 * The factual cache stays separate from student-owned state: a saved course
 * borrows facts already loaded in this session and otherwise shows that they
 * were never requested.
 */
export const catalogueItemForCode = (
  model: Model,
  courseCode: string,
): CourseSearchItemDtoType | null =>
  catalogueResponse(model.catalogue)?.items.find((item) => item.code === courseCode) ?? null;

export const savedDecisionSignal = (
  model: Model,
  courseCode: string,
): CourseDecisionSignalsDtoType | null => {
  const signal = decisionSignalForCourse(model.decisionSignals, courseCode);
  return typeof signal === 'string' ? null : signal;
};

export const savedGradeSignal = (
  model: Model,
  courseCode: string,
): CourseGradeSummaryDtoType | null => {
  const signal = gradeSignalForCourse(model.gradeSignals, courseCode);
  return typeof signal === 'string' ? null : signal;
};

export const courseTitle = (course: CourseSearchItemDtoType, locale: Localization): string =>
  course.title.state === 'known'
    ? course.title.value
    : translate(locale, 'course.titleUnavailable');

export const courseIdentityFacts = (
  course: CourseSearchItemDtoType,
  decisionSignal: DecisionSignal,
  locale: Localization,
  h: HtmlBuilder<Message>,
): Html => {
  const { offering, place, term, credits } = courseOfferingFacts(course, decisionSignal, locale);
  return h.dl(
    [h.Class('grid gap-x-4 gap-y-3 @min-[24rem]:grid-cols-2')],
    [
      h.div(
        [h.Class('min-w-0')],
        [
          h.dt([h.Class(factDtClass)], [translate(locale, 'detail.credits')]),
          h.dd([h.Class(factDdClass)], [credits]),
        ],
      ),
      h.div(
        [h.Class('min-w-0')],
        [
          h.dt([h.Class(factDtClass)], [translate(locale, 'course.termFact')]),
          h.dd(
            [h.Class(`${factDdClass} inline-flex items-start gap-1.5`)],
            [
              offering === null
                ? h.empty
                : icon(
                    termSeasonIconName(offering.season),
                    'mt-0.5 block size-4 flex-none text-primary [&_svg]:block [&_svg]:size-full',
                    h,
                  ),
              h.span([], [term]),
            ],
          ),
        ],
      ),
      h.div(
        [h.Class('min-w-0')],
        [
          h.dt([h.Class(factDtClass)], [translate(locale, 'course.campusFact')]),
          h.dd([h.Class(factDdClass)], [place]),
        ],
      ),
    ],
  );
};

const courseCard = (
  href: string,
  course: CourseSearchItemDtoType,
  decisionSignal: DecisionSignal,
  gradeSignal: GradeSignal,
  locale: Localization,
  outcomeView: OutcomeView,
  saved: boolean,
  savedAvailability: 'ready' | 'loading' | 'paused',
  recoveryHref: string,
  scheduleHref: string | null,
  h: HtmlBuilder<Message>,
): Html => {
  const title = courseTitle(course, locale);
  return h.li(
    [],
    [
      h.article(
        [h.Class(courseCardClass)],
        [
          h.div(
            [
              h.Class(
                'grid min-w-0 content-start gap-3 [@media(min-width:64rem)]:pr-5 [@media(min-width:64rem)]:border-r [@media(min-width:64rem)]:border-outline-variant',
              ),
            ],
            [
              h.div(
                [h.Class('grid items-start gap-3')],
                [
                  h.div(
                    [h.Class('min-w-0')],
                    [
                      h.p(
                        [
                          h.Class(
                            'mb-[0.3rem] text-primary text-xs font-extrabold tracking-[0.1em] uppercase',
                          ),
                        ],
                        [course.code],
                      ),
                      h.h3(
                        [h.Class('text-lg leading-[1.35] [overflow-wrap:anywhere]')],
                        [
                          h.a(
                            [
                              h.Href(href),
                              h.AriaLabel(
                                translate(locale, 'course.open', { code: course.code, title }),
                              ),
                              h.Class(
                                "text-on-surface no-underline after:absolute after:inset-0 after:content-['']",
                              ),
                            ],
                            [title],
                          ),
                        ],
                      ),
                    ],
                  ),
                  h.div(
                    [h.Class('relative z-[2] flex flex-wrap items-center gap-2')],
                    [
                      savedCourseToggle(
                        course.code,
                        saved,
                        savedAvailability,
                        locale,
                        recoveryHref,
                        'state',
                        h,
                      ),
                      scheduleHref === null
                        ? h.empty
                        : h.a(
                            [
                              h.Href(scheduleHref),
                              h.Class(
                                `${compactButtonBase} inline-flex min-h-11 items-center gap-1.5 rounded-[1.5rem] border border-outline bg-surface-container px-3 text-sm font-bold text-primary no-underline`,
                              ),
                            ],
                            [
                              icon(
                                'schedule',
                                'block size-4 flex-none [&_svg]:block [&_svg]:size-full',
                                h,
                              ),
                              translate(locale, 'signals.openSchedule'),
                            ],
                          ),
                    ],
                  ),
                ],
              ),
              courseIdentityFacts(course, decisionSignal, locale, h),
            ],
          ),
          h.div(
            [
              h.Class(
                'grid min-w-0 gap-3 [@media(min-width:80rem)]:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]',
              ),
            ],
            [
              decisionSignalView(decisionSignal, locale, h),
              gradeSignalView(gradeSignal, locale, outcomeView, h),
            ],
          ),
        ],
      ),
    ],
  );
};

const assessmentIconName = (form: AssessmentForm): AppIcon =>
  M.value(form).pipe(
    M.when('written-exam', () => 'assessment-written' as const),
    M.when('oral-exam', () => 'assessment-oral' as const),
    M.when('home-exam', () => 'assessment-home-exam' as const),
    M.when('project', () => 'assessment-project' as const),
    M.when('portfolio', () => 'assessment-portfolio' as const),
    M.when('practical', () => 'assessment-practical' as const),
    M.when('assignment', () => 'assessment-assignment' as const),
    M.when('other', () => 'assessment-other' as const),
    M.exhaustive,
  );

const formatAssessmentWeight = (value: number, locale: Localization): string =>
  `${new Intl.NumberFormat(localeTag(locale.locale), { maximumFractionDigits: 2 }).format(value)}%`;

export const decisionSignalView = (
  signal: DecisionSignal,
  locale: Localization,
  h: HtmlBuilder<Message>,
): Html => {
  const stateClass =
    '@container grid min-w-0 content-start gap-3 p-3 rounded-m3-medium bg-secondary-container text-on-secondary-container';
  if (typeof signal === 'string') {
    const message = M.value(signal).pipe(
      M.when('loading', () => translate(locale, 'signals.checking')),
      M.when('failure', () => translate(locale, 'signals.failed')),
      M.when('idle', () => translate(locale, 'signals.waiting')),
      M.when('missing', () => translateToken(locale, 'unknown')),
      M.exhaustive,
    );
    return h.div(
      [h.Class(`${stateClass} bg-surface-container text-on-surface-variant`)],
      [
        h.p([h.Class(factDtClass)], [translate(locale, 'signals.heading')]),
        h.p([h.Class('m-0 text-sm leading-[1.4]')], [message]),
      ],
    );
  }

  if (signal.sourceStatus.status === 'failed') {
    return h.div(
      [h.Class(`${stateClass} bg-surface-container text-on-surface-variant`)],
      [
        h.p([h.Class(factDtClass)], [translate(locale, 'signals.heading')]),
        h.p([h.Class('m-0 text-sm leading-[1.4]')], [translate(locale, 'signals.failed')]),
      ],
    );
  }

  const parts = signal.assessment.state === 'known' ? signal.assessment.value : [];
  const hasProportionalWeights =
    parts.length > 1 &&
    parts.every((part) => part.weightPercent.state === 'known') &&
    parts.reduce(
      (total, part) =>
        total + (part.weightPercent.state === 'known' ? part.weightPercent.value : 0),
      0,
    ) > 0;
  const assessmentPart = (
    part: (typeof parts)[number],
    index: number,
    grouped: boolean,
    h: HtmlBuilder<Message>,
  ): Html => {
    const label = assessmentLabel(part.form, locale);
    const weight =
      part.weightPercent.state === 'known'
        ? formatAssessmentWeight(part.weightPercent.value, locale)
        : null;
    const accessibleLabel =
      weight === null ? label : `${label}, ${weight} ${translate(locale, 'signals.graded')}`;
    return h.li(
      [
        h.Class(
          grouped
            ? `flex w-full items-center justify-between gap-2 bg-secondary px-3 py-2 text-left text-on-secondary text-xs font-bold leading-[1.25] @min-[28rem]:w-auto @min-[28rem]:justify-center @min-[28rem]:px-2.5 @min-[28rem]:py-1.5 @min-[28rem]:text-center ${
                index === 0
                  ? ''
                  : 'border-t border-on-secondary/30 @min-[28rem]:border-t-0 @min-[28rem]:border-l'
              }`
            : 'inline-flex min-h-8 items-center gap-1.5 rounded-full bg-secondary px-2.5 text-on-secondary text-xs font-bold',
        ),
        ...(grouped
          ? [
              // tailwind-exempt: the growth factor is the assessment part's own
              // weight, so it exists only at render time.
              h.Style({
                flexGrow:
                  hasProportionalWeights && part.weightPercent.state === 'known'
                    ? String(part.weightPercent.value)
                    : '1',
              }),
            ]
          : []),
        h.Title(accessibleLabel),
        h.AriaLabel(accessibleLabel),
      ],
      [
        icon(
          assessmentIconName(part.form),
          'block size-4 shrink-0 [&_svg]:block [&_svg]:size-full',
          h,
        ),
        h.span([h.Class('flex-1 @min-[28rem]:flex-none')], [label]),
        weight === null
          ? h.empty
          : h.span([h.Class('shrink-0 font-extrabold tabular-nums')], [weight]),
      ],
    );
  };
  const assessment =
    signal.assessment.state === 'known'
      ? parts.length === 0
        ? h.p([h.Class('m-0 text-sm')], [translate(locale, 'signals.noneReported')])
        : parts.length === 1
          ? h.ul(
              [h.Class('flex flex-wrap p-0 list-none')],
              [assessmentPart(parts[0]!, 0, false, h)],
            )
          : h.ul(
              [
                h.Class(
                  'flex w-full max-w-full flex-col overflow-hidden rounded-m3-medium border border-secondary p-0 list-none @min-[28rem]:flex-row @min-[28rem]:rounded-full',
                ),
                h.AriaLabel(translate(locale, 'signals.gradedAssessment')),
              ],
              parts.map((part, index) => assessmentPart(part, index, true, h)),
            )
      : h.p([h.Class('m-0 text-sm')], [factStateLabel(signal.assessment.state, locale)]);
  const obligatory =
    signal.obligatoryActivities.state === 'known'
      ? signal.obligatoryActivities.value.length > 0
        ? h.div(
            [h.Class('flex flex-wrap items-center gap-1.5')],
            [
              h.span(
                [
                  h.Class(
                    'inline-flex min-h-7 items-center rounded-full bg-constraint px-2.5 text-xs font-extrabold text-on-constraint',
                  ),
                ],
                [translate(locale, 'signals.required')],
              ),
              h.span(
                [
                  h.Class(
                    'inline-flex min-h-7 items-center rounded-full bg-surface-container-highest px-2.5 text-xs font-extrabold text-on-surface-variant',
                  ),
                ],
                [translate(locale, 'signals.ungraded')],
              ),
              h.span(
                [h.Class('text-xs font-bold')],
                [
                  signal.obligatoryActivities.value.length === 1
                    ? translate(locale, 'signals.oneActivity')
                    : translate(locale, 'signals.activityCount', {
                        count: signal.obligatoryActivities.value.length,
                      }),
                ],
              ),
            ],
          )
        : h.p([h.Class('m-0 text-sm font-bold')], [translate(locale, 'signals.noneReported')])
      : h.p(
          [h.Class('m-0 text-sm font-bold')],
          [factStateLabel(signal.obligatoryActivities.state, locale)],
        );
  const collaboration =
    signal.collaboration.state === 'known'
      ? h.span(
          [
            h.Class(
              'inline-flex min-h-7 items-center gap-1.5 rounded-full bg-surface-container-highest px-2.5 text-xs font-extrabold text-on-surface',
            ),
          ],
          [
            icon(
              collaborationIconName(signal.collaboration.value),
              'block size-4 flex-none [&_svg]:block [&_svg]:size-full',
              h,
            ),
            collaborationLabel(signal.collaboration.value, locale),
          ],
        )
      : h.span([], [factStateLabel(signal.collaboration.state, locale)]);
  const workloadPatterns = [
    ...parts.flatMap((part) =>
      part.workloadPattern.state === 'known' ? [part.workloadPattern.value] : [],
    ),
    ...(signal.obligatoryActivities.state === 'known'
      ? signal.obligatoryActivities.value.flatMap((activity) =>
          activity.workloadPattern.state === 'known' ? [activity.workloadPattern.value] : [],
        )
      : []),
  ].filter((pattern, index, all) => all.indexOf(pattern) === index);
  const workloadPatternLabel = (pattern: (typeof workloadPatterns)[number]): string =>
    M.value(pattern).pipe(
      M.when('distributed', () => translate(locale, 'signals.timingDistributed')),
      M.when('concentrated', () => translate(locale, 'signals.timingConcentrated')),
      M.when('recurring', () => translate(locale, 'signals.timingRecurring')),
      M.when('milestone', () => translate(locale, 'signals.timingMilestone')),
      M.exhaustive,
    );
  const workloadTiming =
    workloadPatterns.length === 0
      ? h.span(
          [h.Class('text-on-secondary-container/80')],
          [translate(locale, 'signals.timingUnknown')],
        )
      : h.div(
          [h.Class('flex flex-wrap gap-1.5')],
          workloadPatterns.map((pattern) =>
            h.span(
              [
                h.Class(
                  'inline-flex min-h-7 items-center rounded-full bg-surface-container-highest px-2.5 text-xs font-extrabold text-on-surface',
                ),
              ],
              [workloadPatternLabel(pattern)],
            ),
          ),
        );
  const attendance =
    signal.attendance.state === 'known'
      ? h.span(
          [
            h.Class(
              signal.attendance.value === 'required'
                ? 'inline-flex min-h-7 items-center rounded-full bg-constraint px-2.5 text-xs font-extrabold text-on-constraint'
                : 'inline-flex min-h-7 items-center rounded-full bg-surface-container-highest px-2.5 text-xs font-extrabold text-on-surface',
            ),
          ],
          [
            translate(
              locale,
              signal.attendance.value === 'required'
                ? 'signals.attendanceRequired'
                : 'signals.attendanceNotRequired',
            ),
          ],
        )
      : h.span([], [factStateLabel(signal.attendance.state, locale)]);
  const observedDate =
    signal.sourceStatus.observedAt === null
      ? null
      : new Intl.DateTimeFormat(localeTag(locale.locale), { dateStyle: 'medium' }).format(
          new Date(signal.sourceStatus.observedAt),
        );
  const sourceEvidence = signal.evidence.find(
    (evidence) => evidence.kind !== 'fixture' && evidence.sourceUrl !== null,
  );
  const inferred = signal.evidence.some((evidence) => evidence.kind === 'inference');
  const factRowClass =
    'grid gap-1.5 @min-[24rem]:grid-cols-[minmax(7.5rem,0.8fr)_minmax(0,1fr)] @min-[24rem]:gap-3';

  return h.div(
    [h.Class(stateClass)],
    [
      h.div(
        [h.Class('flex items-baseline justify-between gap-3')],
        [
          h.p([h.Class(factDtClass)], [translate(locale, 'signals.heading')]),
          inferred
            ? h.p(
                [
                  h.Class('m-0 shrink-0 text-xs font-bold'),
                  h.Title(translate(locale, 'signals.inferred')),
                ],
                [translate(locale, 'detail.inferred')],
              )
            : h.empty,
        ],
      ),
      h.dl(
        [h.Class('grid gap-2.5')],
        [
          h.div(
            [h.Class(factRowClass)],
            [
              h.dt([h.Class(factDtClass)], [translate(locale, 'signals.gradedAssessment')]),
              h.dd([h.Class('m-0 min-w-0')], [assessment]),
            ],
          ),
          h.div(
            [h.Class(factRowClass)],
            [
              h.dt([h.Class(factDtClass)], [translate(locale, 'signals.obligatory')]),
              h.dd([h.Class('m-0')], [obligatory]),
            ],
          ),
          h.div(
            [h.Class(factRowClass)],
            [
              h.dt([h.Class(factDtClass)], [translate(locale, 'detail.collaboration')]),
              h.dd([h.Class('m-0 text-sm font-bold')], [collaboration]),
            ],
          ),
          h.div(
            [h.Class(factRowClass)],
            [
              h.dt([h.Class(factDtClass)], [translate(locale, 'signals.workloadTiming')]),
              h.dd([h.Class('m-0 text-sm font-bold')], [workloadTiming]),
            ],
          ),
          h.div(
            [h.Class(factRowClass)],
            [
              h.dt([h.Class(factDtClass)], [translate(locale, 'signals.attendance')]),
              h.dd([h.Class('m-0 text-sm font-bold')], [attendance]),
            ],
          ),
        ],
      ),
      sourceEvidence?.sourceUrl === null || sourceEvidence?.sourceUrl === undefined
        ? observedDate === null
          ? h.empty
          : h.p(
              [h.Class('m-0 border-t border-on-secondary-container/15 pt-2 text-xs font-bold')],
              [translate(locale, 'signals.checked', { date: observedDate })],
            )
        : h.div(
            [
              h.Class(
                'flex flex-wrap items-center justify-between gap-2 border-t border-on-secondary-container/15 pt-1',
              ),
            ],
            [
              h.a(
                [
                  h.Href(sourceEvidence.sourceUrl),
                  h.Target('_blank'),
                  h.Rel('noreferrer'),
                  h.Class(
                    `${aboveCardOverlayClass} inline-flex min-h-11 items-center text-xs font-extrabold underline-offset-4 hover:underline`,
                  ),
                ],
                [translate(locale, 'signals.officialSource')],
              ),
              observedDate === null
                ? h.empty
                : h.span(
                    [h.Class('text-xs font-bold')],
                    [translate(locale, 'signals.checked', { date: observedDate })],
                  ),
            ],
          ),
    ],
  );
};

const outcomeStateClass =
  'grid gap-2 min-w-0 p-3 rounded-m3-medium bg-primary-container text-on-primary-container';

export const gradeSignalView = (
  signal: GradeSignal,
  locale: Localization,
  outcomeView: OutcomeView,
  h: HtmlBuilder<Message>,
): Html => {
  if (typeof signal !== 'string') return gradeSummaryView(signal, locale, outcomeView, h);
  const message = M.value(signal).pipe(
    M.when('loading', () => translate(locale, 'outcomes.checking')),
    M.when('failure', () => translate(locale, 'outcomes.failed')),
    M.when('idle', () => translate(locale, 'outcomes.waiting')),
    M.when('missing', () => translate(locale, 'outcomes.missing')),
    M.when('partial-missing', () => translate(locale, 'outcomes.missing')),
    M.exhaustive,
  );
  return h.div(
    [h.Class(`${outcomeStateClass} bg-surface-container text-on-surface-variant`)],
    [
      h.p([h.Class(factDtClass)], [translate(locale, 'outcomes.heading')]),
      h.p([h.Class('m-0 text-sm leading-[1.4]')], [message]),
    ],
  );
};

const gradeOrder = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'] as const;

const gradeDisplayLabel = (grade: string, locale: Localization): string =>
  M.value(grade).pipe(
    M.when('G', () => translate(locale, 'outcomes.pass')),
    M.when('H', () => translate(locale, 'outcomes.fail')),
    M.orElse(() => grade),
  );

const distributionStateMessage = (
  distribution: CourseGradeSummaryDtoType['distribution'],
  locale: Localization,
): string => {
  switch (distribution.state) {
    case 'known':
      return distribution.value.length === 0
        ? translate(locale, 'outcomes.noBuckets')
        : translate(locale, 'outcomes.available');
    case 'suppressed':
      return translate(locale, 'outcomes.protected');
    case 'conflicting':
      return translate(locale, 'outcomes.conflicting');
    case 'unknown':
      return translate(locale, 'outcomes.unknown');
    case 'unavailable':
      return translate(locale, 'outcomes.unavailable');
  }
};

type GradeBucket = {
  readonly grade: string;
  readonly count: number;
  readonly percentage: number;
};

const normalizeGradeBuckets = (buckets: ReadonlyArray<GradeBucket>): ReadonlyArray<GradeBucket> => {
  const total = buckets.reduce((sum, bucket) => sum + bucket.count, 0);
  if (total <= 0) return [];
  return buckets.map((bucket) => ({
    ...bucket,
    percentage: (bucket.count / total) * 100,
  }));
};

const gradeSummaryView = (
  summary: CourseGradeSummaryDtoType,
  locale: Localization,
  requestedView: OutcomeView,
  h: HtmlBuilder<Message>,
): Html => {
  const period =
    summary.period.state === 'known'
      ? `${summary.period.value.fromYear}–${summary.period.value.toYear}`
      : null;
  const sourceBuckets =
    summary.distribution.state === 'known'
      ? [...summary.distribution.value].sort(
          (left, right) =>
            gradeOrder.indexOf(left.grade as (typeof gradeOrder)[number]) -
            gradeOrder.indexOf(right.grade as (typeof gradeOrder)[number]),
        )
      : [];

  if (sourceBuckets.length === 0) {
    const sample =
      summary.sampleSize.state === 'known'
        ? translate(locale, 'outcomes.sample', {
            value: summary.sampleSize.value.toLocaleString(localeTag(locale.locale)),
          })
        : null;
    const failure =
      summary.failureRatePercent.state === 'known'
        ? translate(locale, 'outcomes.failedRate', {
            value: formatPercentage(summary.failureRatePercent.value, locale),
          })
        : null;
    const metadata = [failure, sample, period].filter((value): value is string => value !== null);
    return h.div(
      [h.Class(`${outcomeStateClass} bg-surface-container text-on-surface-variant`)],
      [
        h.p([h.Class(factDtClass)], [translate(locale, 'outcomes.heading')]),
        h.p(
          [h.Class('m-0 text-sm leading-[1.4]')],
          [
            metadata.length === 0
              ? distributionStateMessage(summary.distribution, locale)
              : `${distributionStateMessage(summary.distribution, locale)} · ${metadata.join(' · ')}`,
          ],
        ),
      ],
    );
  }

  const letterBuckets = sourceBuckets.filter((bucket) => /^[A-F]$/.test(bucket.grade));
  const passFailBuckets = sourceBuckets.filter(
    (bucket) => bucket.grade === 'G' || bucket.grade === 'H',
  );
  const hasLetter = letterBuckets.some((bucket) => bucket.count > 0);
  const hasPassFail = passFailBuckets.some((bucket) => bucket.count > 0);
  const hasBothScales = hasLetter && hasPassFail;
  const selectedScale: OutcomeView = hasBothScales
    ? requestedView
    : hasPassFail
      ? 'pass-fail'
      : 'letter';
  const buckets = normalizeGradeBuckets(
    selectedScale === 'letter' ? letterBuckets : passFailBuckets,
  );
  const selectedSampleSize = buckets.reduce((sum, bucket) => sum + bucket.count, 0);
  const failedGrade = selectedScale === 'letter' ? 'F' : 'H';
  const failedBucket = buckets.find((bucket) => bucket.grade === failedGrade);
  const failure =
    failedBucket === undefined
      ? null
      : translate(locale, 'outcomes.failedRate', {
          value: formatPercentage(failedBucket.percentage, locale),
        });
  const sample =
    selectedSampleSize > 0
      ? translate(locale, 'outcomes.sample', {
          value: selectedSampleSize.toLocaleString(localeTag(locale.locale)),
        })
      : null;
  const metadata = [failure, sample, period].filter((value): value is string => value !== null);
  const scale = gradeScaleLabel(selectedScale, locale);
  const maxPercentage = Math.max(...buckets.map((bucket) => bucket.percentage), 1);
  const accessibleDistribution = buckets
    .map((bucket) =>
      translate(locale, 'outcomes.percent', {
        label: gradeDisplayLabel(bucket.grade, locale),
        value: formatPercentage(bucket.percentage, locale),
      }),
    )
    .join(', ');
  const accessibleSummary = `${scale}. ${accessibleDistribution}.${metadata.length === 0 ? '' : ` ${metadata.join(', ')}.`}`;
  const passBucket = buckets.find((bucket) => bucket.grade === 'G');
  const failBucket = buckets.find((bucket) => bucket.grade === 'H');
  const isPassFail =
    selectedScale === 'pass-fail' && passBucket !== undefined && failBucket !== undefined;
  const distributionChart = isPassFail
    ? (() => {
        const total = Math.max(passBucket.percentage + failBucket.percentage, 1);
        const passShare = Math.max(0, Math.min((passBucket.percentage / total) * 100, 100));
        const legendItem = (
          colorClass: string,
          label: string,
          percentage: number,
          h: HtmlBuilder<Message>,
        ): Html =>
          h.div(
            [h.Class('grid grid-cols-[0.75rem_minmax(0,1fr)_auto] items-center gap-2')],
            [
              h.span([h.Class(`size-3 rounded-full ${colorClass}`)], []),
              h.span([h.Class('text-xs font-bold')], [label]),
              h.span(
                [h.Class('text-xs font-extrabold tabular-nums')],
                [`${formatPercentage(percentage, locale)}%`],
              ),
            ],
          );

        return h.div(
          [
            h.Class('grid grid-cols-[4.75rem_minmax(0,1fr)] items-center gap-4 py-1'),
            h.AriaHidden(true),
          ],
          [
            h.div(
              [
                h.Class(
                  'grid size-19 place-items-center rounded-full shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--md-sys-color-outline-variant)_65%,transparent)]',
                ),
                // tailwind-exempt: the sweep angle is the observed pass share.
                h.Style({
                  backgroundImage: `conic-gradient(var(--color-valid) 0 ${passShare}%, var(--color-danger) ${passShare}% 100%)`,
                }),
              ],
              [h.span([h.Class('size-11 rounded-full bg-primary-container')], [])],
            ),
            h.div(
              [h.Class('grid gap-2')],
              [
                legendItem(
                  'bg-valid',
                  gradeDisplayLabel(passBucket.grade, locale),
                  passBucket.percentage,
                  h,
                ),
                legendItem(
                  'bg-danger',
                  gradeDisplayLabel(failBucket.grade, locale),
                  failBucket.percentage,
                  h,
                ),
              ],
            ),
          ],
        );
      })()
    : h.div(
        [
          h.Class('grid items-end gap-x-1 gap-y-1'),
          // tailwind-exempt: one column per observed grade bucket.
          h.Style({
            gridTemplateColumns: `repeat(${buckets.length}, minmax(1.75rem, 1fr))`,
          }),
          h.AriaHidden(true),
        ],
        [
          ...buckets.map((bucket) =>
            h.div(
              [
                h.Class('flex h-14 items-end justify-center'),
                h.Title(
                  translate(locale, 'outcomes.percent', {
                    label: gradeDisplayLabel(bucket.grade, locale),
                    value: formatPercentage(bucket.percentage, locale),
                  }),
                ),
              ],
              [
                h.span(
                  [
                    h.Class(
                      `block min-h-1 w-[clamp(0.6rem,48%,1.35rem)] rounded-t-sm ${
                        bucket.grade === 'F' || bucket.grade === 'H' ? 'bg-danger' : 'bg-valid'
                      }`,
                    ),
                    // tailwind-exempt: bar height is this bucket's share of the
                    // tallest observed bucket.
                    h.Style({
                      height: `${Math.max((bucket.percentage / maxPercentage) * 100, 4)}%`,
                    }),
                  ],
                  [],
                ),
              ],
            ),
          ),
          ...buckets.map((bucket) =>
            h.span(
              [h.Class('text-center text-xs font-extrabold leading-none')],
              [gradeDisplayLabel(bucket.grade, locale)],
            ),
          ),
        ],
      );

  const toggle = hasBothScales
    ? h.div(
        [
          h.Class(
            `${aboveCardOverlayClass} grid grid-cols-2 overflow-hidden rounded-full border border-outline bg-surface-container-low`,
          ),
          h.Role('group'),
          h.AriaLabel(translate(locale, 'outcomes.view')),
        ],
        (['letter', 'pass-fail'] as const).map((view) =>
          h.button(
            [
              h.Type('button'),
              h.Class(
                `min-h-11 cursor-pointer border-0 px-3 text-xs font-extrabold ${
                  selectedScale === view
                    ? 'bg-primary text-on-primary'
                    : 'bg-transparent text-on-surface-variant'
                }`,
              ),
              h.AriaPressed(String(selectedScale === view)),
              h.OnClick(ChangedOutcomeView({ value: view })),
            ],
            [gradeScaleLabel(view, locale)],
          ),
        ),
      )
    : h.empty;

  return h.div(
    [h.Class(outcomeStateClass)],
    [
      h.div(
        [h.Class('flex flex-wrap items-start justify-between gap-x-3 gap-y-1')],
        [
          h.div(
            [h.Class('grid gap-0.5')],
            [
              h.p([h.Class(factDtClass)], [translate(locale, 'outcomes.heading')]),
              h.p([h.Class('m-0 text-xs font-bold')], [scale]),
            ],
          ),
        ],
      ),
      toggle,
      h.figure(
        [
          h.Class('grid gap-2 m-0'),
          h.Role('img'),
          h.AriaLabel(translate(locale, 'outcomes.chartLabel', { summary: accessibleSummary })),
        ],
        [
          distributionChart,
          metadata.length === 0
            ? h.empty
            : h.p([h.Class('m-0 text-xs font-semibold leading-[1.35]')], [metadata.join(' · ')]),
        ],
      ),
    ],
  );
};

export const selectedCourseView = (model: Model, h: HtmlBuilder<Message>): Html => {
  const selectedCode = model.selectedCode;
  return h.div(
    [h.Class('grid gap-4 pt-4')],
    [
      h.div(
        [
          /**
           * Saving is the decision this page exists to support, so it stays
           * reachable while the evidence below is read rather than only at the
           * top of a long scroll. The row sits above the whole-card overlay
           * (z-2) and below the fixed dialogs, and carries the surface colour
           * so content passes beneath it instead of through it.
           */
          h.Class(
            'sticky top-0 z-[3] flex flex-wrap items-center justify-between gap-3 bg-surface py-2',
          ),
        ],
        [
          Button.view<Message>(
            {
              type: 'button',
              onClick: ClosedCourse(),
              toView: (attributes) =>
                h.button(
                  [...attributes.button, h.Class(backButtonClass)],
                  [translate(model.localization, 'course.back')],
                ),
            },
            h,
          ),
          selectedCode === null
            ? h.empty
            : savedCourseToggle(
                selectedCode,
                isCourseSaved(model.savedCourses, selectedCode),
                savedToggleAvailability(model.savedCourses),
                model.localization,
                listUrl(model),
                'state',
                h,
              ),
        ],
      ),
      model.detail._tag === 'DetailSuccess' || model.detail._tag === 'DetailPartial'
        ? feedbackRow(model.localization, h)
        : h.empty,
      detailResultView(model.detail, model.localization, h),
    ],
  );
};

const detailResultView = (
  detail: DetailResult,
  locale: Localization,
  h: HtmlBuilder<Message>,
): Html => {
  switch (detail._tag) {
    case 'DetailClosed':
      return h.empty;
    case 'DetailLoading':
      return h.section(
        [h.Class(stateCardBase), h.Role('status'), h.AriaLive('polite')],
        [
          h.div([h.Class(loadingIndicatorClass), h.AriaHidden(true)], []),
          h.h2([h.Class(stateCardH2Class)], [translate(locale, 'detail.loading')]),
          h.p([h.Class(stateCardPClass)], [translate(locale, 'detail.loadingHelp')]),
        ],
      );
    case 'DetailFailure':
      return h.section(
        [h.Class(stateCardFailure), h.Role('alert')],
        [
          h.p([h.Class(statusLabelErrorClass)], [translate(locale, 'detail.unavailable')]),
          h.h2([h.Class(stateCardH2Class)], [translate(locale, 'detail.loadFailed')]),
          h.p([h.Class(stateCardFailurePClass)], [detail.error]),
        ],
      );
    case 'DetailPartial':
      return courseInsightView(detail.response, true, locale, h);
    case 'DetailSuccess':
      return courseInsightView(detail.response, false, locale, h);
  }
};
