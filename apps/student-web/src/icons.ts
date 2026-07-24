import bookmarkSimple from '@phosphor-icons/core/regular/bookmark-simple.svg?raw';
import briefcase from '@phosphor-icons/core/regular/briefcase.svg?raw';
import calendarDots from '@phosphor-icons/core/regular/calendar-dots.svg?raw';
import caretDown from '@phosphor-icons/core/regular/caret-down.svg?raw';
import check from '@phosphor-icons/core/regular/check.svg?raw';
import checkSquare from '@phosphor-icons/core/regular/check-square.svg?raw';
import compass from '@phosphor-icons/core/regular/compass.svg?raw';
import dotsThree from '@phosphor-icons/core/regular/dots-three.svg?raw';
import fileText from '@phosphor-icons/core/regular/file-text.svg?raw';
import flower from '@phosphor-icons/core/regular/flower.svg?raw';
import folderOpen from '@phosphor-icons/core/regular/folder-open.svg?raw';
import graduationCap from '@phosphor-icons/core/regular/graduation-cap.svg?raw';
import houseLine from '@phosphor-icons/core/regular/house-line.svg?raw';
import microphone from '@phosphor-icons/core/regular/microphone.svg?raw';
import palette from '@phosphor-icons/core/regular/palette.svg?raw';
import pencilLine from '@phosphor-icons/core/regular/pencil-line.svg?raw';
import question from '@phosphor-icons/core/regular/question.svg?raw';
import sidebarSimple from '@phosphor-icons/core/regular/sidebar-simple.svg?raw';
import slidersHorizontal from '@phosphor-icons/core/regular/sliders-horizontal.svg?raw';
import snowflake from '@phosphor-icons/core/regular/snowflake.svg?raw';
import sun from '@phosphor-icons/core/regular/sun.svg?raw';
import user from '@phosphor-icons/core/regular/user.svg?raw';
import usersFour from '@phosphor-icons/core/regular/users-four.svg?raw';
import usersThree from '@phosphor-icons/core/regular/users-three.svg?raw';
import leaf from '@phosphor-icons/core/regular/leaf.svg?raw';
import wrench from '@phosphor-icons/core/regular/wrench.svg?raw';
import x from '@phosphor-icons/core/regular/x.svg?raw';
import type { Html } from 'foldkit/html';
import { html } from 'foldkit/html';

export type AppIcon =
  | 'assessment-assignment'
  | 'assessment-home-exam'
  | 'assessment-oral'
  | 'assessment-other'
  | 'assessment-portfolio'
  | 'assessment-practical'
  | 'assessment-project'
  | 'assessment-written'
  | 'appearance'
  | 'caret-down'
  | 'check'
  | 'close'
  | 'collaboration-group'
  | 'collaboration-individual'
  | 'collaboration-mixed'
  | 'degree'
  | 'explore'
  | 'list'
  | 'more'
  | 'obligatory-work'
  | 'refine'
  | 'schedule'
  | 'sidebar'
  | 'term-autumn'
  | 'term-full-year'
  | 'term-spring'
  | 'term-summer'
  | 'term-winter';

const icons: Readonly<Record<AppIcon, string>> = {
  'assessment-assignment': fileText,
  'assessment-home-exam': houseLine,
  'assessment-oral': microphone,
  'assessment-other': question,
  'assessment-portfolio': folderOpen,
  'assessment-practical': wrench,
  'assessment-project': briefcase,
  'assessment-written': pencilLine,
  'caret-down': caretDown,
  check,
  close: x,
  'collaboration-group': usersThree,
  'collaboration-individual': user,
  'collaboration-mixed': usersFour,
  degree: graduationCap,
  explore: compass,
  list: bookmarkSimple,
  more: dotsThree,
  'obligatory-work': checkSquare,
  appearance: palette,
  refine: slidersHorizontal,
  schedule: calendarDots,
  sidebar: sidebarSimple,
  'term-autumn': leaf,
  'term-full-year': calendarDots,
  'term-spring': flower,
  'term-summer': sun,
  'term-winter': snowflake,
};

export const collaborationIconName = (collaboration: 'individual' | 'group' | 'mixed'): AppIcon => {
  switch (collaboration) {
    case 'individual':
      return 'collaboration-individual';
    case 'group':
      return 'collaboration-group';
    case 'mixed':
      return 'collaboration-mixed';
  }
};

export const termSeasonIconName = (season: string): AppIcon => {
  switch (season) {
    case 'autumn':
      return 'term-autumn';
    case 'winter':
      return 'term-winter';
    case 'spring':
      return 'term-spring';
    case 'summer':
      return 'term-summer';
    default:
      return 'term-full-year';
  }
};

/**
 * The SVG strings are static, build-time assets from Phosphor. Keeping this
 * boundary here means product views consume semantic icons without importing
 * the icon package or handling arbitrary HTML.
 */
export const icon = <Message>(
  name: AppIcon,
  className = '[&_svg]:block [&_svg]:w-full [&_svg]:h-full',
): Html => {
  const h = html<Message>();
  return h.span([h.Class(className), h.AriaHidden(true), h.InnerHTML(icons[name])], []);
};
