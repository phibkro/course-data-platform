import { Option } from 'effect';
import type { Command } from 'foldkit';
import type { Html } from 'foldkit/html';
import { html } from 'foldkit/html';

import { Listbox } from '@foldkit/ui';

import { icon, type AppIcon } from './icons';

export interface SelectOption {
  readonly value: string;
  readonly label: string;
  readonly icon?: AppIcon;
}

const StyledListbox = Listbox.create<SelectOption, string>();

export const SelectFieldModel = Listbox.Model;
export type SelectFieldModel = Listbox.Model;
export const SelectFieldMessage = Listbox.Message;
export type SelectFieldMessage = Listbox.Message;

export const initSelectField = (id: string): SelectFieldModel =>
  Listbox.init({ id, isAnimated: true, isModal: false });

export const updateSelectField = (
  model: SelectFieldModel,
  message: SelectFieldMessage,
): readonly [
  SelectFieldModel,
  ReadonlyArray<Command.Command<SelectFieldMessage>>,
  Option.Option<Listbox.OutMessage<string>>,
] => StyledListbox.update(model, message);

interface SelectFieldViewOptions<Message> {
  readonly model: SelectFieldModel;
  readonly label: string;
  readonly value: string;
  readonly options: ReadonlyArray<SelectOption>;
  readonly toParentMessage: (message: SelectFieldMessage) => Message;
  readonly compact?: boolean;
  readonly portal?: boolean;
}

export const selectField = <Message>({
  model,
  label,
  value,
  options,
  toParentMessage,
  compact = false,
  portal = true,
}: SelectFieldViewOptions<Message>): Html => {
  const h = html<Message>();
  const selected = options.find((option) => option.value === value) ?? { value, label: value };
  const labelId = `${model.id}-label`;
  return h.div(
    [h.Class('grid gap-1.5')],
    [
      h.label(
        [
          h.Id(labelId),
          h.For(Listbox.buttonId(model.id)),
          h.Class(compact ? 'sr-only' : 'ml-1 text-[0.85rem] font-[650] text-on-surface-variant'),
        ],
        [label],
      ),
      h.submodel({
        slotId: model.id,
        model,
        view: StyledListbox.view,
        viewInputs: {
          items: options,
          itemToValue: (item) => item.value,
          itemToSearchText: (item) => item.label,
          maybeSelectedValue: Option.some(value),
          ariaLabelledBy: labelId,
          anchor: { placement: 'bottom-start', gap: 6, padding: 8, portal },
          className: 'relative min-w-0',
          buttonClassName: `flex min-h-12 w-full min-w-0 items-center justify-between gap-3 rounded-m3-medium border border-outline bg-surface px-3 text-left text-on-surface [font:inherit] cursor-pointer focus-visible:outline-3 focus-visible:outline-tertiary focus-visible:outline-offset-2 data-[open]:border-primary ${
            compact ? 'min-h-11 gap-1 px-1.5 text-xs font-[800]' : ''
          }`,
          buttonContent: h.span(
            [
              h.Class(
                `flex min-w-0 flex-1 items-center ${compact ? 'justify-center gap-1' : 'gap-2'}`,
              ),
            ],
            [
              selected?.icon === undefined
                ? h.empty
                : icon<Message>(
                    selected.icon,
                    'block size-4 flex-none [&_svg]:block [&_svg]:size-full',
                  ),
              h.span(
                [h.Class(compact ? 'flex-none whitespace-nowrap' : 'min-w-0 flex-1 truncate')],
                [selected?.label ?? value],
              ),
              icon<Message>(
                'caret-down',
                `block flex-none [transition:transform_140ms_ease] group-data-[open]:rotate-180 [&_svg]:block [&_svg]:size-full ${
                  compact ? 'size-3.5' : 'size-4'
                }`,
              ),
            ],
          ),
          itemsClassName:
            'z-50 min-w-48 max-w-[min(24rem,calc(100vw-1rem))] overflow-hidden rounded-m3-medium border border-outline-variant bg-surface-container-high shadow-m3-2 outline-none opacity-100 [transition:opacity_120ms_ease,transform_120ms_ease] data-[closed]:opacity-0 data-[closed]:-translate-y-1',
          itemsScrollClassName: 'grid max-h-72 gap-0.5 overflow-y-auto p-1.5',
          backdropClassName: 'fixed inset-0 z-0 bg-transparent',
          itemToConfig: (item, { isActive, isSelected }) => ({
            className: `flex min-h-11 items-center justify-between gap-3 rounded-m3-small px-3 text-sm cursor-pointer ${
              isActive ? 'bg-secondary-container text-on-secondary-container' : 'text-on-surface'
            } ${isSelected ? 'font-[800]' : ''}`,
            content: h.span(
              [h.Class('flex min-w-0 flex-1 items-center gap-3')],
              [
                item.icon === undefined
                  ? h.empty
                  : icon<Message>(
                      item.icon,
                      'block size-4 flex-none [&_svg]:block [&_svg]:size-full',
                    ),
                h.span([h.Class('min-w-0 flex-1 truncate')], [item.label]),
                isSelected
                  ? icon<Message>(
                      'check',
                      'block size-4 flex-none text-primary [&_svg]:block [&_svg]:size-full',
                    )
                  : h.empty,
              ],
            ),
          }),
        },
        toParentMessage,
      }),
    ],
  );
};
