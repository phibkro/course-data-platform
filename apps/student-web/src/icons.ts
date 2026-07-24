import bookmarkSimple from '@phosphor-icons/core/regular/bookmark-simple.svg?raw';
import calendarDots from '@phosphor-icons/core/regular/calendar-dots.svg?raw';
import compass from '@phosphor-icons/core/regular/compass.svg?raw';
import dotsThree from '@phosphor-icons/core/regular/dots-three.svg?raw';
import graduationCap from '@phosphor-icons/core/regular/graduation-cap.svg?raw';
import slidersHorizontal from '@phosphor-icons/core/regular/sliders-horizontal.svg?raw';
import x from '@phosphor-icons/core/regular/x.svg?raw';
import type { Html } from 'foldkit/html';
import { html } from 'foldkit/html';

export type AppIcon = 'close' | 'degree' | 'explore' | 'list' | 'more' | 'refine' | 'schedule';

const icons: Readonly<Record<AppIcon, string>> = {
  close: x,
  degree: graduationCap,
  explore: compass,
  list: bookmarkSimple,
  more: dotsThree,
  refine: slidersHorizontal,
  schedule: calendarDots,
};

/**
 * The SVG strings are static, build-time assets from Phosphor. Keeping this
 * boundary here means product views consume semantic icons without importing
 * the icon package or handling arbitrary HTML.
 */
export const icon = <Message>(name: AppIcon, className = 'app-icon'): Html => {
  const h = html<Message>();
  return h.span([h.Class(className), h.AriaHidden(true), h.InnerHTML(icons[name])], []);
};
