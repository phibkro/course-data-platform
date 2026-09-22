import { Effect, Schema as S } from 'effect';
import { Command, type Update } from 'foldkit';
import type { Html, HtmlBuilder } from 'foldkit/html';
import { defineMessageUnion } from 'foldkit/message';
import { defineView } from 'foldkit/submodel';
import { modifyFields } from 'foldkit/struct';

import {
  colorModes,
  decodeThemePreference,
  defaultThemePreference,
  persistThemePreference,
  presetPreference,
  selectedPresetId,
  themePresets,
  type ColorMode,
  type ThemePreference,
  type ThemePresetId,
} from '../../theme';
import { buttonSecondary, eyebrowClass } from '../../app-styles';
import { icon } from '../../icons';
import { translate, type Localization } from '../../i18n';

const BaseColorSchema = S.Literals(['mist', 'zinc', 'stone', 'mauve', 'olive', 'neutral']);
const ThemeColorSchema = S.Literals(['blue', 'violet', 'amber', 'rose', 'emerald', 'sky']);
const ChartColorSchema = S.Literals(['sky', 'violet', 'emerald', 'rose', 'indigo', 'amber']);
const ColorModeSchema = S.Literals(colorModes);
const ThemePresetIdSchema = S.Literals([
  'fjord',
  'aurora',
  'birch',
  'heather',
  'pine',
  'polar-night',
]);
export const ThemePreferenceSchema = S.Struct({
  version: S.Literal(1),
  baseColor: BaseColorSchema,
  themeColor: ThemeColorSchema,
  chartColor: ChartColorSchema,
  mode: ColorModeSchema,
});

export const Model = S.Struct({ preference: ThemePreferenceSchema });
export type Model = typeof Model.Type;

export const Message = defineMessageUnion({
  ChangedThemePreset: { value: ThemePresetIdSchema },
  ChangedColorMode: { value: ColorModeSchema },
  ResetThemePreference: {},
  PersistedThemePreference: {},
  FailedThemePreferencePersistence: {},
});
export type Message = typeof Message.Type;

export const PersistThemePreference = Command.define('PersistThemePreference', {
  args: { preference: ThemePreferenceSchema },
  messages: [Message.PersistedThemePreference, Message.FailedThemePreferencePersistence],
  execute: ({ preference }) =>
    Effect.try({
      try: () => persistThemePreference(preference),
      catch: () => new Error('Theme preference could not be persisted'),
    }).pipe(
      Effect.as(Message.PersistedThemePreference()),
      Effect.catch(() => Effect.succeed(Message.FailedThemePreferencePersistence())),
    ),
});

export const init = (preference: ThemePreference = defaultThemePreference): Model => ({
  preference: decodeThemePreference(preference),
});

type UpdateReturn = Update.Return<Model, Message>;

export const update = (model: Model, message: Message) =>
  Message.match<UpdateReturn>(message, {
    ChangedThemePreset: ({ value }) => {
      const preference = presetPreference(value, model.preference.mode);
      return {
        model: modifyFields(model, { preference: () => preference }),
        commands: [PersistThemePreference({ preference })],
      };
    },
    ChangedColorMode: ({ value }) => {
      const preference = decodeThemePreference({ ...model.preference, mode: value });
      return {
        model: modifyFields(model, { preference: () => preference }),
        commands: [PersistThemePreference({ preference })],
      };
    },
    ResetThemePreference: () => ({
      model: modifyFields(model, { preference: () => defaultThemePreference }),
      commands: [PersistThemePreference({ preference: defaultThemePreference })],
    }),
    PersistedThemePreference: () => ({ model }),
    FailedThemePreferencePersistence: () => ({ model }),
  });

export interface ViewInputs {
  readonly locale: Localization;
  readonly renderMobileLanguageControl: () => Html;
  readonly renderFooter: () => Html;
}

const themePresetName = (locale: Localization, presetId: ThemePresetId): string => {
  switch (presetId) {
    case 'fjord':
      return translate(locale, 'appearance.fjord');
    case 'aurora':
      return translate(locale, 'appearance.aurora');
    case 'birch':
      return translate(locale, 'appearance.birch');
    case 'heather':
      return translate(locale, 'appearance.heather');
    case 'pine':
      return translate(locale, 'appearance.pine');
    case 'polar-night':
      return translate(locale, 'appearance.polarNight');
  }
};

const themePresetDescription = (locale: Localization, presetId: ThemePresetId): string => {
  switch (presetId) {
    case 'fjord':
      return translate(locale, 'appearance.fjordDescription');
    case 'aurora':
      return translate(locale, 'appearance.auroraDescription');
    case 'birch':
      return translate(locale, 'appearance.birchDescription');
    case 'heather':
      return translate(locale, 'appearance.heatherDescription');
    case 'pine':
      return translate(locale, 'appearance.pineDescription');
    case 'polar-night':
      return translate(locale, 'appearance.polarNightDescription');
  }
};

const colorModeLabel = (locale: Localization, mode: ColorMode): string => {
  switch (mode) {
    case 'system':
      return translate(locale, 'appearance.system');
    case 'light':
      return translate(locale, 'appearance.light');
    case 'dark':
      return translate(locale, 'appearance.dark');
  }
};

const themePreview = (locale: Localization, h: HtmlBuilder<Message>): Html => {
  return h.section(
    [
      h.Class(
        'grid overflow-hidden border border-outline-variant rounded-m3-large bg-surface-container-low shadow-m3-1',
      ),
      h.AriaLabel(translate(locale, 'appearance.preview')),
    ],
    [
      h.header(
        [h.Class('grid gap-2 p-4 bg-primary-container text-on-primary-container')],
        [
          h.div(
            [h.Class('flex items-center justify-between gap-3')],
            [
              h.span(
                [h.Class('text-xs font-extrabold tracking-[0.08em] uppercase')],
                [translate(locale, 'appearance.previewTerm')],
              ),
              h.span(
                [h.Class('rounded-full border border-current/40 py-1 px-2.5 text-xs font-bold')],
                [translate(locale, 'appearance.previewCredits')],
              ),
            ],
          ),
          h.h3(
            [h.Class('text-xl tracking-[-0.025em]')],
            [translate(locale, 'appearance.previewCourse')],
          ),
        ],
      ),
      h.div(
        [h.Class('grid gap-4 p-4')],
        [
          h.div(
            [h.Class('grid h-18 grid-cols-5 items-end gap-2'), h.AriaHidden(true)],
            [
              h.span([h.Class('h-[38%] rounded-t-md bg-chart-1')], []),
              h.span([h.Class('h-[72%] rounded-t-md bg-chart-2')], []),
              h.span([h.Class('h-[54%] rounded-t-md bg-chart-3')], []),
              h.span([h.Class('h-full rounded-t-md bg-chart-4')], []),
              h.span([h.Class('h-[63%] rounded-t-md bg-chart-5')], []),
            ],
          ),
          h.div(
            [h.Class('flex flex-wrap gap-2 text-xs font-bold')],
            [
              h.span(
                [h.Class('rounded-full bg-constraint py-1.5 px-3 text-on-constraint')],
                [translate(locale, 'appearance.previewRequired')],
              ),
              h.span(
                [h.Class('rounded-full bg-valid py-1.5 px-3 text-on-valid')],
                [translate(locale, 'appearance.previewValid')],
              ),
              h.span(
                [
                  h.Class(
                    'rounded-full bg-warning-container py-1.5 px-3 text-on-warning-container',
                  ),
                ],
                [translate(locale, 'appearance.previewWarning')],
              ),
            ],
          ),
        ],
      ),
    ],
  );
};

export const view = defineView<Model, Message, ViewInputs>(
  (model, { locale, renderFooter, renderMobileLanguageControl }, h) => {
    const preference = model.preference;
    const selectedPreset = selectedPresetId(preference);
    return h.section(
      [h.Class('grid gap-5 pt-[clamp(1.5rem,4vw,3rem)]')],
      [
        h.header(
          [],
          [
            h.p([h.Class(eyebrowClass)], [translate(locale, 'appearance.label')]),
            h.h1(
              [h.Class('text-[clamp(1.6rem,6vw,2.25rem)] tracking-[-0.035em]')],
              [translate(locale, 'appearance.heading')],
            ),
            h.p(
              [h.Class('mt-[0.4rem] max-w-168 text-on-surface-variant leading-[1.5]')],
              [translate(locale, 'appearance.description')],
            ),
          ],
        ),
        h.div(
          [
            h.Class(
              'grid gap-5 [@media(min-width:48rem)]:grid-cols-[minmax(0,1.45fr)_minmax(16rem,0.8fr)]',
            ),
          ],
          [
            h.div(
              [h.Class('grid gap-3')],
              [
                h.h3(
                  [h.Class('text-sm font-extrabold')],
                  [translate(locale, 'appearance.palettes')],
                ),
                h.div(
                  [
                    h.Class('grid grid-cols-[repeat(auto-fit,minmax(min(100%,12rem),1fr))] gap-3'),
                    h.Role('group'),
                    h.AriaLabel(translate(locale, 'appearance.palettes')),
                  ],
                  themePresets.map((preset) => {
                    const isSelected = selectedPreset === preset.id;
                    return h.button(
                      [
                        h.Type('button'),
                        h.Class(
                          `theme-preset-card theme-preset-card--${preset.id} relative grid min-h-28 gap-2 overflow-hidden rounded-m3-large border p-3 text-left cursor-pointer focus-visible:outline-3 focus-visible:outline-tertiary focus-visible:outline-offset-2 ${
                            isSelected
                              ? 'border-primary shadow-[0_0_0_2px_var(--md-sys-color-primary)]'
                              : 'border-outline-variant'
                          }`,
                        ),
                        h.OnClick(Message.ChangedThemePreset({ value: preset.id })),
                        h.AriaPressed(String(isSelected)),
                      ],
                      [
                        h.span(
                          [
                            h.Class(
                              'theme-preset-card__swatch h-10 rounded-m3-medium border border-outline-variant',
                            ),
                            h.AriaHidden(true),
                          ],
                          [],
                        ),
                        h.span(
                          [h.Class('flex items-center justify-between gap-2')],
                          [
                            h.span(
                              [h.Class('font-extrabold')],
                              [themePresetName(locale, preset.id)],
                            ),
                            isSelected
                              ? icon<Message>(
                                  'check',
                                  'block size-5 text-primary [&_svg]:block [&_svg]:size-full',
                                  h,
                                )
                              : h.empty,
                          ],
                        ),
                        h.span(
                          [h.Class('text-xs text-on-surface-variant leading-[1.4]')],
                          [themePresetDescription(locale, preset.id)],
                        ),
                      ],
                    );
                  }),
                ),
                h.div(
                  [
                    h.Class('grid gap-2 pt-1'),
                    h.Role('group'),
                    h.AriaLabel(translate(locale, 'appearance.mode')),
                  ],
                  [
                    h.h3(
                      [h.Class('text-sm font-extrabold')],
                      [translate(locale, 'appearance.mode')],
                    ),
                    h.div(
                      [
                        h.Class(
                          'grid grid-cols-3 overflow-hidden rounded-m3-medium border border-outline',
                        ),
                      ],
                      colorModes.map((mode) =>
                        h.button(
                          [
                            h.Type('button'),
                            h.Class(
                              `min-h-11 border-0 border-r border-outline last:border-r-0 font-bold cursor-pointer ${
                                preference.mode === mode
                                  ? 'bg-primary text-on-primary'
                                  : 'bg-surface-container text-on-surface'
                              }`,
                            ),
                            h.OnClick(Message.ChangedColorMode({ value: mode })),
                            h.AriaPressed(String(preference.mode === mode)),
                          ],
                          [colorModeLabel(locale, mode)],
                        ),
                      ),
                    ),
                  ],
                ),
              ],
            ),
            h.div(
              [h.Class('grid content-start gap-3')],
              [
                themePreview(locale, h),
                h.button(
                  [
                    h.Type('button'),
                    h.Class(buttonSecondary),
                    h.OnClick(Message.ResetThemePreference()),
                  ],
                  [translate(locale, 'appearance.reset')],
                ),
              ],
            ),
          ],
        ),
        /**
         * The narrow layout has no sidebar, so this page is where its app-level
         * preferences live. Language sat at the end of every page before, which
         * made finding it depend on how far the student had scrolled; it is one
         * tap from the bottom bar here instead, and never competes with the
         * heading of the page being read.
         */
        h.section(
          [h.Class('grid gap-3 [@media(min-width:48rem)_and_(min-height:34rem)]:hidden')],
          [
            h.h2([h.Class(eyebrowClass)], [translate(locale, 'locale.label')]),
            h.div([h.Class('w-[min(100%,20rem)]')], [renderMobileLanguageControl()]),
          ],
        ),
        renderFooter(),
      ],
    );
  },
);
