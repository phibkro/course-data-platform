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

const desktopItem = <Message>(item: NavigationItem): Html => {
  const h = html<Message>();
  const children = [
    icon<Message>(item.icon, 'navigation-item__icon'),
    h.span([h.Class('navigation-item__label')], [item.label]),
  ];

  return item.href === null
    ? h.span(
        [
          h.Class('navigation-item navigation-item--disabled'),
          h.AriaDisabled(true),
          h.AriaLabel(`${item.accessibleLabel}, planned`),
          h.Title(`${item.accessibleLabel} is planned`),
        ],
        children,
      )
    : h.a(
        [
          h.Href(item.href),
          h.Class('navigation-item navigation-item--active'),
          h.AriaCurrent('page'),
          h.AriaLabel(item.accessibleLabel),
        ],
        children,
      );
};

const mobileItem = <Message>(item: NavigationItem): Html => {
  const h = html<Message>();
  const primaryClass = item.isPrimary ? ' bottom-navigation__item--primary' : '';
  const children = [
    icon<Message>(item.icon, 'bottom-navigation__icon'),
    h.span([h.Class('bottom-navigation__label')], [item.label]),
  ];

  return item.href === null
    ? h.span(
        [
          h.Class(`bottom-navigation__item bottom-navigation__item--disabled${primaryClass}`),
          h.AriaDisabled(true),
          h.AriaLabel(`${item.accessibleLabel}, planned`),
          h.Title(`${item.accessibleLabel} is planned`),
        ],
        children,
      )
    : h.a(
        [
          h.Href(item.href),
          h.Class(`bottom-navigation__item bottom-navigation__item--active${primaryClass}`),
          h.AriaCurrent('page'),
          h.AriaLabel(item.accessibleLabel),
        ],
        children,
      );
};

export const desktopNavigation = <Message>(): Html => {
  const h = html<Message>();
  return h.aside(
    [h.Class('sidebar'), h.AriaLabel('Primary navigation')],
    [
      h.div(
        [h.Class('brand')],
        [h.span([h.Class('brand__mark'), h.AriaHidden(true)], ['C']), h.span([], ['Course lens'])],
      ),
      h.nav([h.Class('primary-navigation')], primaryNavigation.map(desktopItem<Message>)),
      h.p([h.Class('sidebar__note')], ['Facts stay traceable. Missing information stays visible.']),
    ],
  );
};

export const mobileNavigation = <Message>(): Html => {
  const h = html<Message>();
  return h.nav(
    [h.Class('bottom-navigation'), h.AriaLabel('Primary navigation')],
    primaryNavigation.map(mobileItem<Message>),
  );
};
