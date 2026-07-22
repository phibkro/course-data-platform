import { ArrowSquareOutIcon } from '@phosphor-icons/react/dist/csr/ArrowSquareOut';
import { BookmarkSimpleIcon } from '@phosphor-icons/react/dist/csr/BookmarkSimple';
import { BooksIcon } from '@phosphor-icons/react/dist/csr/Books';
import { BuildingsIcon } from '@phosphor-icons/react/dist/csr/Buildings';
import { DatabaseIcon } from '@phosphor-icons/react/dist/csr/Database';
import { DotsThreeIcon } from '@phosphor-icons/react/dist/csr/DotsThree';
import { GraduationCapIcon } from '@phosphor-icons/react/dist/csr/GraduationCap';
import { MagnifyingGlassIcon } from '@phosphor-icons/react/dist/csr/MagnifyingGlass';
import { MapTrifoldIcon } from '@phosphor-icons/react/dist/csr/MapTrifold';
import { ScalesIcon } from '@phosphor-icons/react/dist/csr/Scales';
import { SlidersHorizontalIcon } from '@phosphor-icons/react/dist/csr/SlidersHorizontal';
import { WrenchIcon } from '@phosphor-icons/react/dist/csr/Wrench';
import { XIcon as PhosphorXIcon } from '@phosphor-icons/react/dist/csr/X';
import type { IconProps } from '@phosphor-icons/react';
import { useEffect, type ComponentProps } from 'react';

const iconDefaults = {
  'aria-hidden': true,
  focusable: false,
  size: 20,
} as const;

type AppIconProps = Omit<IconProps, 'ref'> & {
  readonly active?: boolean;
};

const iconWeight = (active: boolean | undefined): NonNullable<IconProps['weight']> =>
  active ? 'fill' : 'regular';

export function ExploreIcon({ active, ...props }: AppIconProps) {
  return (
    <MagnifyingGlassIcon {...iconDefaults} {...props} weight={props.weight ?? iconWeight(active)} />
  );
}

export function PlanIcon({ active, ...props }: AppIconProps) {
  return (
    <MapTrifoldIcon {...iconDefaults} {...props} weight={props.weight ?? iconWeight(active)} />
  );
}

export function SavedIcon({ active, ...props }: AppIconProps) {
  return (
    <BookmarkSimpleIcon {...iconDefaults} {...props} weight={props.weight ?? iconWeight(active)} />
  );
}

export function WorkbenchIcon({ active, ...props }: AppIconProps) {
  return <WrenchIcon {...iconDefaults} {...props} weight={props.weight ?? iconWeight(active)} />;
}

export function DataStatusIcon({ active, ...props }: AppIconProps) {
  return <DatabaseIcon {...iconDefaults} {...props} weight={props.weight ?? iconWeight(active)} />;
}

export function CompareIcon({ active, ...props }: AppIconProps) {
  return <ScalesIcon {...iconDefaults} {...props} weight={props.weight ?? iconWeight(active)} />;
}

export function ProgrammeIcon(props: AppIconProps) {
  return <GraduationCapIcon {...iconDefaults} {...props} weight={props.weight ?? 'duotone'} />;
}

export function CourseIcon(props: AppIconProps) {
  return <BooksIcon {...iconDefaults} {...props} weight={props.weight ?? 'duotone'} />;
}

export function InstitutionIcon(props: AppIconProps) {
  return <BuildingsIcon {...iconDefaults} {...props} weight={props.weight ?? 'duotone'} />;
}

export function MoreIcon(props: AppIconProps) {
  return <DotsThreeIcon {...iconDefaults} {...props} weight={props.weight ?? 'bold'} />;
}

export function FilterIcon(props: AppIconProps) {
  return <SlidersHorizontalIcon {...iconDefaults} {...props} weight={props.weight ?? 'regular'} />;
}

export function ThemeIcon(props: AppIconProps) {
  return <SlidersHorizontalIcon {...iconDefaults} {...props} weight={props.weight ?? 'duotone'} />;
}

export function ExternalLinkIcon(props: AppIconProps) {
  return <ArrowSquareOutIcon {...iconDefaults} {...props} weight={props.weight ?? 'regular'} />;
}

export function XIcon(props: AppIconProps) {
  return <PhosphorXIcon {...iconDefaults} {...props} weight={props.weight ?? 'bold'} />;
}

const materialSymbolsStylesheetId = 'course-data-material-symbols';

export function MaterialSymbol({
  name,
  className,
  ...props
}: {
  readonly name: string;
} & Omit<ComponentProps<'span'>, 'children'>) {
  useEffect(() => {
    if (document.getElementById(materialSymbolsStylesheetId)) return;

    const stylesheet = document.createElement('link');
    stylesheet.id = materialSymbolsStylesheetId;
    stylesheet.rel = 'stylesheet';
    stylesheet.href =
      'https://fonts.googleapis.com/css2?family=Material+Symbols+Rounded:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200';
    document.head.append(stylesheet);
  }, []);

  return (
    <span aria-hidden="true" className={`material-symbols-rounded ${className ?? ''}`} {...props}>
      {name}
    </span>
  );
}
