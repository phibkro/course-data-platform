import type { Html } from 'foldkit/html';
import { html } from 'foldkit/html';

import { translate, type Locale } from './i18n';
import { icon, type AppIcon } from './icons';

export type NavigationRoute = 'explore' | 'list' | 'appearance';

export interface NavigationItem {
  readonly id: 'list' | 'schedule' | 'explore' | 'degree' | 'appearance';
  readonly label: string;
  readonly accessibleLabel: string;
  readonly icon: AppIcon;
  readonly href: string | null;
  readonly isCurrent: boolean;
  /** 1 is the most important destination. Rank, never a position. */
  readonly priority: number;
}

/**
 * A rail and a bottom bar do not weight their slots the same way. Reading down
 * a sidebar, first means top. Reaching across a bottom bar one-handed, the
 * easiest slot is the middle one, and importance falls away towards the
 * corners. Encoding either order directly would make one surface's convenience
 * the other's arbitrary sequence.
 *
 * So the model carries rank and each surface derives its own seating:
 *
 *   sidebar      rank order, top to bottom
 *   bottom bar   the leading rank takes the middle seat, the rest fill the
 *                remaining seats in rank order, left to right
 *
 * An even number of seats has no middle, so the rule degenerates to plain rank
 * order — which is the right answer there rather than a special case.
 */
export const bottomBarSeating = <T extends { readonly priority: number }>(
  items: ReadonlyArray<T>,
): ReadonlyArray<T> => {
  const ranked = [...items].sort((left, right) => left.priority - right.priority);
  if (ranked.length % 2 === 0) return ranked;

  const middle = (ranked.length - 1) / 2;
  const [leading, ...rest] = ranked;
  if (leading === undefined) return ranked;

  const seats = [...rest];
  seats.splice(middle, 0, leading);
  return seats;
};

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
  appearanceHref: string,
): ReadonlyArray<NavigationItem> => [
  {
    id: 'list',
    label: translate(locale, 'nav.list'),
    accessibleLabel: translate(locale, 'nav.list'),
    icon: 'list',
    href: listHref,
    isCurrent: route === 'list',
    priority: 2,
  },
  {
    id: 'schedule',
    label: translate(locale, 'nav.schedule'),
    accessibleLabel: translate(locale, 'nav.schedule'),
    icon: 'schedule',
    href: null,
    isCurrent: false,
    priority: 3,
  },
  {
    id: 'explore',
    label: translate(locale, 'nav.explore'),
    accessibleLabel: translate(locale, 'nav.explore'),
    icon: 'explore',
    href: exploreHref,
    isCurrent: route === 'explore',
    priority: 1,
  },
  {
    id: 'degree',
    label: translate(locale, 'nav.degree'),
    accessibleLabel: translate(locale, 'nav.degreeAccessible'),
    icon: 'degree',
    href: null,
    isCurrent: false,
    priority: 4,
  },
  {
    id: 'appearance',
    /**
     * The bottom bar gives each destination about eight characters before it
     * truncates, so the visible label is the short word while the accessible
     * name stays the full one. The route is `/appearance` either way.
     */
    label: translate(locale, 'appearance.navLabel'),
    accessibleLabel: translate(locale, 'appearance.navLabel'),
    icon: 'appearance',
    href: appearanceHref,
    isCurrent: route === 'appearance',
    priority: 5,
  },
];

const desktopItemBase =
  'flex items-center gap-3 min-h-14 py-3 px-4 rounded-[1.75rem] font-semibold no-underline';

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
 * alignment, and the same baseline for its label.
 *
 * The filled pill marks the *current* destination, and nothing else. Only one
 * fact may own a strong visual channel: a mark that means both "important" and
 * "where you are" can say neither, because a permanently marked destination
 * reads as permanently active. Activeness owns it here because it is the fact
 * that changes; Explore's standing is carried by its centre position.
 */
const mobileItemLayout = (isCurrent: boolean): string =>
  `flex min-w-0 min-h-13 items-center justify-center gap-[0.2rem] flex-col ${
    isCurrent ? 'text-primary font-extrabold' : 'text-on-surface-variant font-semibold'
  } text-xs leading-none no-underline [-webkit-tap-highlight-color:transparent]`;

/**
 * The glyph is the same size in every state and only the pill behind it
 * changes. Sizing the glyph from the indicator meant the padded active icon
 * rendered at 1.25rem while every unpadded peer filled the full 2rem box, so
 * the icons disagreed with each other and with the label beneath them.
 */
const mobileItemIcon = (isCurrent: boolean): string =>
  `grid size-8 place-items-center rounded-full leading-none [&_svg]:block [&_svg]:size-5 ${
    isCurrent ? 'bg-primary text-on-primary' : ''
  }`;

/**
 * Every destination is a link or a planned placeholder. Appearance used to be
 * a button opening a dialog, which made it the one item rendered from a
 * different element with its own styling — and the one place a stray reset
 * could drift away from its peers. It is a page now, so there is no special
 * case left.
 */
const mobileItem = <Message>(locale: Locale, item: NavigationItem): Html => {
  const h = html<Message>();
  const itemClass = mobileItemLayout(item.isCurrent);
  const children = [
    icon<Message>(item.icon, mobileItemIcon(item.isCurrent)),
    h.span([h.Class('max-w-full truncate')], [item.label]),
  ];

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
  appearanceHref = '/appearance',
  onToggle?: Message,
  languageControl?: Html,
): Html => {
  const h = html<Message>();
  const items = primaryNavigation(locale, route, exploreHref, listHref, appearanceHref);
  return h.aside(
    [
      h.Class(
        `fixed inset-y-0 left-0 hidden ${collapsed ? 'w-20 px-2' : 'w-66 px-4'} py-6 bg-surface-container-low border-r border-outline-variant transition-[width] duration-200 ease-in-out [@media(min-width:48rem)_and_(min-height:34rem)]:flex [@media(min-width:48rem)_and_(min-height:34rem)]:flex-col`,
      ),
      h.AriaLabel(translate(locale, 'nav.primary')),
    ],
    [
      h.div(
        [
          h.Class(
            collapsed
              ? 'flex min-h-10 items-center justify-center pt-2 pb-8'
              : 'flex min-h-10 items-center gap-3 pt-2 px-3 pb-8 text-lg font-bold tracking-[-0.02em]',
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
        /**
         * The sidebar keeps Appearance beside the language control at the
         * bottom, where the other preferences live, so it is not repeated in
         * the destination list. The bottom bar has no such footer and carries
         * it as its fifth destination.
         */
        [...items]
          .filter((item) => item.id !== 'appearance')
          .sort((left, right) => left.priority - right.priority)
          .map((item) => desktopItem<Message>(locale, item, collapsed)),
      ),
      h.div(
        [h.Class(`mt-auto grid gap-4 pt-4 ${collapsed ? '' : 'mx-3'}`)],
        [
          h.a(
            [
              h.Href(appearanceHref),
              h.Class(
                `flex min-h-11 w-full items-center gap-3 rounded-m3-medium no-underline font-semibold focus-visible:outline-3 focus-visible:outline-tertiary focus-visible:outline-offset-2 ${
                  collapsed ? 'justify-center px-2' : 'px-3'
                } ${
                  route === 'appearance'
                    ? 'bg-secondary-container text-on-secondary-container'
                    : 'text-on-surface hover:bg-surface-container-high'
                }`,
              ),
              ...(route === 'appearance' ? [h.AriaCurrent('page')] : []),
              // No aria-label: the accessible name is the visible word, so the
              // two cannot disagree once the sidebar collapses it to an icon.
              h.Title(translate(locale, 'appearance.navLabel')),
            ],
            [
              icon<Message>('appearance', 'block size-5 [&_svg]:block [&_svg]:size-full'),
              h.span(
                [h.Class(collapsed ? 'sr-only' : '')],
                [translate(locale, 'appearance.navLabel')],
              ),
            ],
          ),
          languageControl ?? h.empty,
          collapsed
            ? h.empty
            : h.p(
                [
                  h.Class(
                    'm-0 border-t border-outline-variant pt-4 text-on-surface-variant text-sm leading-[1.5]',
                  ),
                ],
                [translate(locale, 'nav.claim')],
              ),
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
  appearanceHref = '/appearance',
): Html => {
  const h = html<Message>();
  return h.nav(
    [
      h.Class(
        'fixed z-10 inset-x-0 bottom-0 grid grid-cols-5 min-h-[calc(4rem_+_env(safe-area-inset-bottom))] pt-1 pr-[max(0.25rem,env(safe-area-inset-right))] pb-[max(0.375rem,env(safe-area-inset-bottom))] pl-[max(0.25rem,env(safe-area-inset-left))] border-t border-outline-variant bg-surface-container shadow-m3-2 [@media(min-width:48rem)_and_(min-height:34rem)]:hidden',
      ),
      h.AriaLabel(translate(locale, 'nav.primary')),
    ],
    bottomBarSeating(primaryNavigation(locale, route, exploreHref, listHref, appearanceHref)).map(
      (item) => mobileItem<Message>(locale, item),
    ),
  );
};
