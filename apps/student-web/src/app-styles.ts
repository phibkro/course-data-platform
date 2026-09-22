export const eyebrowClass = 'mb-2 text-primary text-xs font-extrabold tracking-[0.1em] uppercase';

export const fieldLabelClass =
  'block mt-0 mr-0 mb-[0.4rem] ml-1 text-on-surface-variant text-sm font-semibold';

/**
 * The column reserves room below its content for the bottom bar *and* for the
 * notice stack that hovers above it. Reserving it unconditionally is what lets
 * the stack appear without reflowing anything: nothing moves when a notice
 * arrives, and the last row can still be scrolled clear of one that stays.
 *
 * The sidebar is fixed, so the main column is offset to clear it. That offset
 * has to be a margin, and an explicit `margin-left` beats `margin-left: auto`
 * — so capping the width here left every spare pixel on the right instead of
 * splitting it. The offset stays, and the cap moves inside.
 */
export const mainContentClass = (sidebarCollapsed: boolean): string =>
  `w-full pt-4 px-4 pb-[calc(12rem+env(safe-area-inset-bottom))] [@media(min-width:48rem)_and_(min-height:34rem)]:pt-4 [@media(min-width:48rem)_and_(min-height:34rem)]:px-6 [@media(min-width:48rem)_and_(min-height:34rem)]:pb-40 [@media(min-width:64rem)]:px-10 ${
    sidebarCollapsed
      ? '[@media(min-width:48rem)_and_(min-height:34rem)]:w-[calc(100%-5rem)] [@media(min-width:48rem)_and_(min-height:34rem)]:ml-20'
      : '[@media(min-width:48rem)_and_(min-height:34rem)]:w-[calc(100%-16.5rem)] [@media(min-width:48rem)_and_(min-height:34rem)]:ml-66'
  }`;

/**
 * One reading column, centred in whatever space the sidebar leaves. 76rem is
 * about 100 characters at the body size — wide enough for the three-column
 * course card, short enough that a heading does not run away from the text
 * under it.
 */
export const mainColumnClass = 'mx-auto w-full max-w-[76rem]';

export const buttonBase =
  'cursor-pointer transition-[box-shadow,transform] duration-150 ease-in-out focus-visible:outline-3 focus-visible:outline-tertiary focus-visible:outline-offset-[3px] data-[disabled]:cursor-wait data-[disabled]:opacity-[0.65] [@media(max-width:37rem)]:w-full';

export const compactButtonBase =
  'cursor-pointer transition-[box-shadow,background-color] duration-150 ease-in-out focus-visible:outline-3 focus-visible:outline-tertiary focus-visible:outline-offset-[3px] data-[disabled]:cursor-not-allowed data-[disabled]:opacity-[0.65]';

export const buttonPrimary = `${buttonBase} min-h-14 px-5 border-0 rounded-[1.75rem] font-bold bg-primary text-on-primary shadow-m3-1 not-data-[disabled]:hover:shadow-m3-2 not-data-[disabled]:hover:-translate-y-px`;

export const buttonSecondary = `${buttonBase} min-h-12 px-[1.15rem] border border-outline rounded-[1.5rem] bg-surface-container text-primary font-bold`;

/**
 * Actions that sit together in a row are peers and share one treatment.
 *
 * The page-level button stretches to fill a narrow screen, which is right for
 * a form's single commit and wrong inside a group: two buttons filling the row
 * while two hug their text reads as two different kinds of control, and the
 * eye groups by similarity before it reads any label. Tone carries meaning
 * here; width does not.
 */
export type GroupedActionTone = 'primary' | 'neutral' | 'destructive';

export const groupedAction = (tone: GroupedActionTone): string =>
  `${compactButtonBase} inline-flex min-h-11 flex-none items-center gap-2 rounded-[1.5rem] border px-3 text-sm font-bold ${
    tone === 'primary'
      ? 'border-primary bg-primary text-on-primary'
      : tone === 'destructive'
        ? 'border-error bg-error-container text-on-error-container'
        : 'border-outline bg-surface-container text-primary'
  }`;

export const backButtonClass =
  'min-h-12 px-[1.15rem] border border-outline rounded-[1.5rem] bg-surface-container text-primary font-bold cursor-pointer justify-self-start';

export const stateCardBase =
  'grid min-h-68 place-items-center content-center p-[clamp(2rem,6vw,4rem)] border border-outline-variant rounded-m3-extra-large bg-surface-container-low text-center';

export const stateCardFailure = `${stateCardBase} border-error bg-error-container text-on-error-container`;

export const stateCardH2Class = 'mt-3 mb-2 text-[clamp(1.4rem,3vw,2rem)]';

export const stateCardPClass = 'max-w-144 mx-auto my-1 text-on-surface-variant leading-[1.6]';

export const stateCardFailurePClass = 'max-w-144 mx-auto my-1 leading-[1.6] text-inherit';

export const statusLabelErrorClass =
  'mb-2 text-xs font-extrabold tracking-[0.1em] uppercase text-error';

export const loadingIndicatorClass =
  'size-12 border-[0.3rem] border-primary-container border-t-primary rounded-full animate-[spin_850ms_linear_infinite] motion-reduce:[animation-duration:1.8s]';

export const controlGroupClass =
  'grid gap-2 [&>*]:w-full [&>*]:justify-center @min-[28rem]:flex @min-[28rem]:flex-wrap @min-[28rem]:items-center @min-[28rem]:[&>*]:w-auto';
