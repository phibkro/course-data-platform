import bookmarkSimple from '@phosphor-icons/core/regular/bookmark-simple.svg?raw';
import briefcase from '@phosphor-icons/core/regular/briefcase.svg?raw';
import calendarDots from '@phosphor-icons/core/regular/calendar-dots.svg?raw';
import checkSquare from '@phosphor-icons/core/regular/check-square.svg?raw';
import compass from '@phosphor-icons/core/regular/compass.svg?raw';
import dotsThree from '@phosphor-icons/core/regular/dots-three.svg?raw';
import fileText from '@phosphor-icons/core/regular/file-text.svg?raw';
import folderOpen from '@phosphor-icons/core/regular/folder-open.svg?raw';
import graduationCap from '@phosphor-icons/core/regular/graduation-cap.svg?raw';
import houseLine from '@phosphor-icons/core/regular/house-line.svg?raw';
import microphone from '@phosphor-icons/core/regular/microphone.svg?raw';
import pencilLine from '@phosphor-icons/core/regular/pencil-line.svg?raw';
import question from '@phosphor-icons/core/regular/question.svg?raw';
import sidebarSimple from '@phosphor-icons/core/regular/sidebar-simple.svg?raw';
import slidersHorizontal from '@phosphor-icons/core/regular/sliders-horizontal.svg?raw';
import usersThree from '@phosphor-icons/core/regular/users-three.svg?raw';
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
  | 'close'
  | 'collaboration'
  | 'degree'
  | 'explore'
  | 'list'
  | 'more'
  | 'obligatory-work'
  | 'refine'
  | 'schedule'
  | 'sidebar';

const icons: Readonly<Record<AppIcon, string>> = {
  'assessment-assignment': fileText,
  'assessment-home-exam': houseLine,
  'assessment-oral': microphone,
  'assessment-other': question,
  'assessment-portfolio': folderOpen,
  'assessment-practical': wrench,
  'assessment-project': briefcase,
  'assessment-written': pencilLine,
  close: x,
  collaboration: usersThree,
  degree: graduationCap,
  explore: compass,
  list: bookmarkSimple,
  more: dotsThree,
  'obligatory-work': checkSquare,
  refine: slidersHorizontal,
  schedule: calendarDots,
  sidebar: sidebarSimple,
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
