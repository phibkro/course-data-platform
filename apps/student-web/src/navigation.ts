import type { Html } from 'foldkit/html';
import { html } from 'foldkit/html';

import { icon, type AppIcon } from './icons';

export interface NavigationItem {
  readonly id: 'list' | 'schedule' | 'explore' | 'degree' | 'more';
  readonly label: string;
  readonly accessibleLabel: string;
  readonly icon: AppIcon;
  readonly href: string | null;
  readonly isPrimary: boolean;
}

/**
 * The desktop sidebar and mobile bottom bar intentionally consume the same
 * explicit navigation model. Planned destinations stay non-interactive until
 * the corresponding product surface exists.
 */
export const primaryNavigation: ReadonlyArray<NavigationItem> = [
  {
    id: 'list',
    label: 'List',
    accessibleLabel: 'List',
    icon: 'list',
    href: null,
    isPrimary: false,
  },
  {
    id: 'schedule',
    label: 'Schedule',
    accessibleLabel: 'Schedule',
    icon: 'schedule',
    href: null,
    isPrimary: false,
  },
  {
    id: 'explore',
    label: 'Explore',
    accessibleLabel: 'Explore',
    icon: 'explore',
    href: '/',
    isPrimary: true,
  },
  {
    id: 'degree',
    label: 'Degree',
    accessibleLabel: 'Full degree overview',
    icon: 'degree',
    href: null,
    isPrimary: false,
  },
  {
    id: 'more',
    label: 'More',
    accessibleLabel: 'More',
    icon: 'more',
    href: null,
    isPrimary: false,
  },
];

const desktopItemBase =
  'flex items-center gap-3 min-h-14 py-3 px-4 rounded-[1.75rem] font-[650] no-underline';

const desktopItemIcon =
  'grid size-6 flex-none place-items-center leading-none [&_svg]:block [&_svg]:w-full [&_svg]:h-full';

const desktopItem = <Message>(item: NavigationItem): Html => {
  const h = html<Message>();
  const children = [icon<Message>(item.icon, desktopItemIcon), h.span([], [item.label])];

  return item.href === null
    ? h.span(
        [
          h.Class(`${desktopItemBase} text-on-surface-variant cursor-not-allowed opacity-[0.52]`),
          h.AriaDisabled(true),
          h.AriaLabel(`${item.accessibleLabel}, planned`),
          h.Title(`${item.accessibleLabel} is planned`),
        ],
        children,
      )
    : h.a(
        [
          h.Href(item.href),
          h.Class(`${desktopItemBase} bg-secondary-container text-on-secondary-container`),
          h.AriaCurrent('page'),
          h.AriaLabel(item.accessibleLabel),
        ],
        children,
      );
};

const mobileItemLayout = (isPrimary: boolean): string =>
  isPrimary
    ? 'flex min-w-0 min-h-15 items-center justify-start gap-[0.2rem] flex-col text-primary text-xs font-[650] leading-none no-underline -translate-y-[1.35rem] [-webkit-tap-highlight-color:transparent]'
    : 'flex min-w-0 min-h-15 items-center justify-end gap-[0.2rem] flex-col text-on-surface-variant text-xs font-[650] leading-none no-underline [-webkit-tap-highlight-color:transparent]';

const mobileItemIcon = (isPrimary: boolean): string =>
  isPrimary
    ? 'grid size-15 place-items-center rounded-full bg-primary text-on-primary shadow-m3-2 p-4 leading-none [&_svg]:block [&_svg]:w-full [&_svg]:h-full'
    : 'grid size-8 place-items-center leading-none [&_svg]:block [&_svg]:w-full [&_svg]:h-full';

const mobileItem = <Message>(item: NavigationItem): Html => {
  const h = html<Message>();
  const itemClass = mobileItemLayout(item.isPrimary);
  const children = [
    icon<Message>(item.icon, mobileItemIcon(item.isPrimary)),
    h.span([h.Class('max-w-full truncate')], [item.label]),
  ];

  return item.href === null
    ? h.span(
        [
          h.Class(`${itemClass} cursor-not-allowed opacity-[0.52]`),
          h.AriaDisabled(true),
          h.AriaLabel(`${item.accessibleLabel}, planned`),
          h.Title(`${item.accessibleLabel} is planned`),
        ],
        children,
      )
    : h.a(
        [
          h.Href(item.href),
          h.Class(itemClass),
          h.AriaCurrent('page'),
          h.AriaLabel(item.accessibleLabel),
        ],
        children,
      );
};

export const desktopNavigation = <Message>(): Html => {
  const h = html<Message>();
  return h.aside(
    [
      h.Class(
        'fixed inset-y-0 left-0 hidden w-66 py-6 px-4 bg-surface-container-low border-r border-outline-variant [@media(min-width:48rem)_and_(min-height:34rem)]:flex [@media(min-width:48rem)_and_(min-height:34rem)]:flex-col',
      ),
      h.AriaLabel('Primary navigation'),
    ],
    [
      h.div(
        [
          h.Class(
            'flex items-center gap-3 pt-2 px-3 pb-8 text-[1.125rem] font-[750] tracking-[-0.02em]',
          ),
        ],
        [
          h.span(
            [
              h.Class(
                'grid size-10 place-items-center rounded-[0.875rem] bg-primary text-on-primary',
              ),
              h.AriaHidden(true),
            ],
            ['C'],
          ),
          h.span([], ['Course lens']),
        ],
      ),
      h.nav([h.Class('grid gap-1')], primaryNavigation.map(desktopItem<Message>)),
      h.p(
        [h.Class('mt-auto mx-3 mb-0 text-on-surface-variant text-sm leading-[1.5]')],
        ['Facts stay traceable. Missing information stays visible.'],
      ),
    ],
  );
};

export const mobileNavigation = <Message>(): Html => {
  const h = html<Message>();
  return h.nav(
    [
      h.Class(
        'fixed z-10 inset-x-0 bottom-0 grid grid-cols-5 min-h-[calc(4.75rem_+_env(safe-area-inset-bottom))] pt-2 pr-[max(0.25rem,env(safe-area-inset-right))] pb-[max(0.5rem,env(safe-area-inset-bottom))] pl-[max(0.25rem,env(safe-area-inset-left))] border-t border-outline-variant bg-surface-container shadow-m3-2 [@media(min-width:48rem)_and_(min-height:34rem)]:hidden',
      ),
      h.AriaLabel('Primary navigation'),
    ],
    primaryNavigation.map(mobileItem<Message>),
  );
};
