import type { Html } from 'foldkit/html';
import { html } from 'foldkit/html';

import { translate, type Locale } from './i18n';
import { icon, type AppIcon } from './icons';

export type NavigationRoute = 'explore' | 'list';

export interface NavigationItem {
  readonly id: 'list' | 'schedule' | 'explore' | 'degree' | 'more';
  readonly label: string;
  readonly accessibleLabel: string;
  readonly icon: AppIcon;
  readonly href: string | null;
  readonly isPrimary: boolean;
  readonly isCurrent: boolean;
}

/**
 * The desktop sidebar and mobile bottom bar intentionally consume the same
 * explicit navigation model. Planned destinations stay non-interactive until
 * the corresponding product surface exists.
 */
export const primaryNavigation = (
  locale: Locale,
  route: NavigationRoute,
  exploreHref: string,
  listHref: string,
): ReadonlyArray<NavigationItem> => [
  {
    id: 'list',
    label: translate(locale, 'nav.list'),
    accessibleLabel: translate(locale, 'nav.list'),
    icon: 'list',
    href: listHref,
    isPrimary: false,
    isCurrent: route === 'list',
  },
  {
    id: 'schedule',
    label: translate(locale, 'nav.schedule'),
    accessibleLabel: translate(locale, 'nav.schedule'),
    icon: 'schedule',
    href: null,
    isPrimary: false,
    isCurrent: false,
  },
  {
    id: 'explore',
    label: translate(locale, 'nav.explore'),
    accessibleLabel: translate(locale, 'nav.explore'),
    icon: 'explore',
    href: exploreHref,
    isPrimary: true,
    isCurrent: route === 'explore',
  },
  {
    id: 'degree',
    label: translate(locale, 'nav.degree'),
    accessibleLabel: translate(locale, 'nav.degreeAccessible'),
    icon: 'degree',
    href: null,
    isPrimary: false,
    isCurrent: false,
  },
  {
    id: 'more',
    label: translate(locale, 'nav.more'),
    accessibleLabel: translate(locale, 'nav.more'),
    icon: 'more',
    href: null,
    isPrimary: false,
    isCurrent: false,
  },
];

const desktopItemBase =
  'flex items-center gap-3 min-h-14 py-3 px-4 rounded-[1.75rem] font-[650] no-underline';

const desktopItemIcon =
  'grid size-6 flex-none place-items-center leading-none [&_svg]:block [&_svg]:w-full [&_svg]:h-full';

const desktopItem = <Message>(locale: Locale, item: NavigationItem, collapsed: boolean): Html => {
  const h = html<Message>();
  const children = [
    icon<Message>(item.icon, desktopItemIcon),
    h.span([h.Class(collapsed ? 'sr-only' : '')], [item.label]),
  ];
  const layoutClass = collapsed ? 'justify-center px-3' : '';

  return item.href === null
    ? h.span(
        [
          h.Class(
            `${desktopItemBase} ${layoutClass} text-on-surface-variant cursor-not-allowed opacity-[0.52]`,
          ),
          h.AriaDisabled(true),
          h.AriaLabel(translate(locale, 'nav.planned', { label: item.accessibleLabel })),
          h.Title(translate(locale, 'nav.plannedTitle', { label: item.accessibleLabel })),
        ],
        children,
      )
    : h.a(
        [
          h.Href(item.href),
          h.Class(
            `${desktopItemBase} ${layoutClass} ${
              item.isCurrent
                ? 'bg-secondary-container text-on-secondary-container'
                : 'text-on-surface-variant hover:bg-surface-container-high'
            }`,
          ),
          ...(item.isCurrent ? [h.AriaCurrent('page')] : []),
          h.AriaLabel(item.accessibleLabel),
          ...(collapsed ? [h.Title(item.accessibleLabel)] : []),
        ],
        children,
      );
};

/**
 * Every destination shares one vertical rhythm: the same box, the same
 * alignment, and the same baseline for its label. Explore stays visually
 * distinct through its filled icon, not by protruding above its peers.
 */
const mobileItemLayout = (isPrimary: boolean, isCurrent = false): string =>
  `flex min-w-0 min-h-13 items-center justify-center gap-[0.2rem] flex-col ${
    isPrimary || isCurrent ? 'text-primary font-[800]' : 'text-on-surface-variant font-[650]'
  } text-xs leading-none no-underline [-webkit-tap-highlight-color:transparent]`;

const mobileItemIcon = (isPrimary: boolean): string =>
  isPrimary
    ? 'grid size-8 place-items-center rounded-full bg-primary text-on-primary p-1.5 leading-none [&_svg]:block [&_svg]:w-full [&_svg]:h-full'
    : 'grid size-8 place-items-center leading-none [&_svg]:block [&_svg]:w-full [&_svg]:h-full';

const mobileItem = <Message>(
  locale: Locale,
  item: NavigationItem,
  onAppearance?: Message,
): Html => {
  const h = html<Message>();
  const itemClass = mobileItemLayout(item.isPrimary, item.isCurrent);
  const children = [
    icon<Message>(item.icon, mobileItemIcon(item.isPrimary)),
    h.span([h.Class('max-w-full truncate')], [item.label]),
  ];

  if (item.id === 'more' && onAppearance !== undefined) {
    // The bottom bar gives each destination about eight characters before it
    // truncates, so the narrow label is the short word. The route stays
    // `/appearance` and the dialog keeps its full name.
    const appearanceLabel = translate(locale, 'appearance.navLabel');
    return h.button(
      [
        h.Type('button'),
        h.Class(`${itemClass} border-0 bg-transparent cursor-pointer [font:inherit]`),
        h.OnClick(onAppearance),
        h.AriaLabel(translate(locale, 'appearance.open')),
      ],
      [
        icon<Message>('appearance', mobileItemIcon(false)),
        h.span([h.Class('max-w-full truncate')], [appearanceLabel]),
      ],
    );
  }

  return item.href === null
    ? h.span(
        [
          h.Class(`${itemClass} cursor-not-allowed opacity-[0.52]`),
          h.AriaDisabled(true),
          h.AriaLabel(translate(locale, 'nav.planned', { label: item.accessibleLabel })),
          h.Title(translate(locale, 'nav.plannedTitle', { label: item.accessibleLabel })),
        ],
        children,
      )
    : h.a(
        [
          h.Href(item.href),
          h.Class(itemClass),
          ...(item.isCurrent ? [h.AriaCurrent('page')] : []),
          h.AriaLabel(item.accessibleLabel),
        ],
        children,
      );
};

export const desktopNavigation = <Message>(
  locale: Locale = 'en',
  collapsed = false,
  route: NavigationRoute = 'explore',
  exploreHref = '/',
  listHref = '/list',
  onToggle?: Message,
  onAppearance?: Message,
  languageControl?: Html,
): Html => {
  const h = html<Message>();
  const items = primaryNavigation(locale, route, exploreHref, listHref);
  return h.aside(
    [
      h.Class(
        `fixed inset-y-0 left-0 hidden ${collapsed ? 'w-20 px-2' : 'w-66 px-4'} py-6 bg-surface-container-low border-r border-outline-variant [transition:width_180ms_ease] [@media(min-width:48rem)_and_(min-height:34rem)]:flex [@media(min-width:48rem)_and_(min-height:34rem)]:flex-col`,
      ),
      h.AriaLabel(translate(locale, 'nav.primary')),
    ],
    [
      h.div(
        [
          h.Class(
            collapsed
              ? 'flex min-h-10 items-center justify-center pt-2 pb-8'
              : 'flex min-h-10 items-center gap-3 pt-2 px-3 pb-8 text-[1.125rem] font-[750] tracking-[-0.02em]',
          ),
        ],
        [
          h.span(
            [h.Class(collapsed ? 'sr-only' : 'min-w-0 flex-1')],
            [translate(locale, 'app.name')],
          ),
          onToggle === undefined
            ? h.empty
            : h.button(
                [
                  h.Type('button'),
                  h.Class(
                    'grid size-10 flex-none place-items-center rounded-full border-0 bg-surface-container-high text-on-surface cursor-pointer focus-visible:outline-3 focus-visible:outline-tertiary focus-visible:outline-offset-2',
                  ),
                  h.OnClick(onToggle),
                  h.AriaLabel(translate(locale, collapsed ? 'nav.expand' : 'nav.collapse')),
                  h.Title(translate(locale, collapsed ? 'nav.expand' : 'nav.collapse')),
                ],
                [
                  icon<Message>(
                    'sidebar',
                    `block size-5 [&_svg]:block [&_svg]:size-full ${collapsed ? '-scale-x-100' : ''}`,
                  ),
                ],
              ),
        ],
      ),
      h.nav(
        [h.Class('grid gap-1')],
        items.map((item) => desktopItem<Message>(locale, item, collapsed)),
      ),
      h.div(
        [
          h.Class(
            `mt-auto grid gap-4 border-t border-outline-variant pt-4 ${collapsed ? '' : 'mx-3'}`,
          ),
        ],
        [
          collapsed
            ? h.empty
            : h.p(
                [h.Class('m-0 text-on-surface-variant text-sm leading-[1.5]')],
                [translate(locale, 'nav.claim')],
              ),
          onAppearance === undefined
            ? h.empty
            : h.button(
                [
                  h.Type('button'),
                  h.Class(
                    `flex min-h-11 w-full items-center gap-3 border-0 rounded-m3-medium bg-transparent text-on-surface cursor-pointer [font:inherit] font-[650] focus-visible:outline-3 focus-visible:outline-tertiary focus-visible:outline-offset-2 ${
                      collapsed ? 'justify-center px-2' : 'px-3'
                    }`,
                  ),
                  h.OnClick(onAppearance),
                  h.AriaLabel(translate(locale, 'appearance.open')),
                  h.Title(translate(locale, 'appearance.label')),
                ],
                [
                  icon<Message>('appearance', 'block size-5 [&_svg]:block [&_svg]:size-full'),
                  h.span(
                    [h.Class(collapsed ? 'sr-only' : '')],
                    [translate(locale, 'appearance.label')],
                  ),
                ],
              ),
          languageControl ?? h.empty,
        ],
      ),
    ],
  );
};

export const mobileNavigation = <Message>(
  locale: Locale = 'en',
  route: NavigationRoute = 'explore',
  exploreHref = '/',
  listHref = '/list',
  onAppearance?: Message,
): Html => {
  const h = html<Message>();
  return h.nav(
    [
      h.Class(
        'fixed z-10 inset-x-0 bottom-0 grid grid-cols-5 min-h-[calc(4rem_+_env(safe-area-inset-bottom))] pt-1 pr-[max(0.25rem,env(safe-area-inset-right))] pb-[max(0.375rem,env(safe-area-inset-bottom))] pl-[max(0.25rem,env(safe-area-inset-left))] border-t border-outline-variant bg-surface-container shadow-m3-2 [@media(min-width:48rem)_and_(min-height:34rem)]:hidden',
      ),
      h.AriaLabel(translate(locale, 'nav.primary')),
    ],
    primaryNavigation(locale, route, exploreHref, listHref).map((item) =>
      mobileItem<Message>(locale, item, onAppearance),
    ),
  );
};
