import { Checkbox } from '@foldkit/ui';
import type { Html, HtmlBuilder } from 'foldkit/html';

export interface PageHeaderOptions {
  readonly eyebrow: string;
  readonly title: string;
  readonly description: string;
  readonly showMobileBrand?: boolean;
}

export const pageHeader = <Message>(
  { eyebrow, title, description, showMobileBrand = false }: PageHeaderOptions,
  h: HtmlBuilder<Message>,
): Html =>
  h.header(
    [],
    [
      h.div(
        [h.Class('mb-3 flex items-center gap-3')],
        [
          showMobileBrand
            ? h.img([
                h.Src('/course-lens-icon.svg'),
                h.Alt(''),
                h.AriaHidden(true),
                h.Class('block size-10 [@media(min-width:48rem)]:hidden'),
              ])
            : h.empty,
          h.p(
            [h.Class('m-0 text-primary text-xs font-extrabold tracking-[0.1em] uppercase')],
            [eyebrow],
          ),
        ],
      ),
      h.h1(
        [
          h.Class(
            'max-w-[22ch] text-[clamp(2rem,5vw,3rem)] font-extrabold tracking-[-0.045em] leading-[1.02]',
          ),
        ],
        [title],
      ),
      h.p(
        [h.Class('mt-3 max-w-168 text-on-surface-variant text-base leading-[1.5]')],
        [description],
      ),
    ],
  );

export interface SelectionChipOptions<Message> {
  readonly id: string;
  readonly label: string;
  readonly isSelected: boolean;
  readonly onToggle: (isSelected: boolean) => Message;
  readonly describedBy?: string;
  readonly isDisabled?: boolean;
}

export const selectionChip = <Message>(
  {
    id,
    label,
    isSelected,
    onToggle,
    describedBy,
    isDisabled = false,
  }: SelectionChipOptions<Message>,
  h: HtmlBuilder<Message>,
): Html =>
  Checkbox.view<Message>(
    {
      id,
      isChecked: isSelected,
      isDisabled,
      onToggle,
      toView: (attributes) =>
        h.label(
          [
            ...attributes.label,
            h.Class(
              `relative inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm font-bold transition-[border-color,background-color,color,box-shadow] focus-within:outline-3 focus-within:outline-tertiary focus-within:outline-offset-2 ${
                isDisabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'
              } ${
                isSelected
                  ? 'border-primary bg-primary text-on-primary shadow-m3-1'
                  : 'border-outline-variant bg-surface-container-low text-on-surface hover:border-primary hover:bg-surface-container'
              }`,
            ),
          ],
          [
            h.span(
              [
                ...attributes.checkbox,
                h.AriaLabelledBy(`${id}-text`),
                ...(describedBy === undefined ? [] : [h.AriaDescribedBy(describedBy)]),
                h.Class(
                  `absolute inset-0 z-10 rounded-full outline-none ${isDisabled ? 'cursor-not-allowed' : 'cursor-pointer'}`,
                ),
              ],
              [],
            ),
            isSelected ? h.span([h.AriaHidden(true)], ['✓']) : h.empty,
            h.span([h.Id(`${id}-text`)], [label]),
          ],
        ),
    },
    h,
  );
