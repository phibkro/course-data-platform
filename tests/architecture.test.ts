import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, test } from 'vitest';

/**
 * Executable architecture boundaries.
 *
 * These were previously prose in `AGENTS.md` and `.claude/rules/`, which meant
 * they could only be violated silently. Each rule here fails when the boundary
 * it names is crossed, so the prose can shrink to a pointer.
 *
 * Rules expressible as lint live in `.oxlintrc.json` instead — domain purity is
 * enforced there through `no-restricted-globals` / `no-restricted-properties` /
 * `no-restricted-imports`. oxlint 1.74 has no `no-restricted-syntax`, so the
 * AST-shaped and cross-file checks land here.
 */

const repoRoot = join(import.meta.dirname, '..');

const walk = (dir: string, predicate: (path: string) => boolean): readonly string[] => {
  const entries: string[] = [];
  const absolute = join(repoRoot, dir);
  const visit = (current: string): void => {
    for (const entry of readdirSync(current)) {
      if (entry === 'node_modules' || entry === 'dist' || entry === '.git') continue;
      const path = join(current, entry);
      if (statSync(path).isDirectory()) visit(path);
      else if (predicate(path)) entries.push(path);
    }
  };
  try {
    visit(absolute);
  } catch {
    return [];
  }
  return entries;
};

const relative = (path: string): string => path.slice(repoRoot.length + 1);

/**
 * Comments are documentation, not behaviour. Stripping them keeps a rule from
 * firing on an example or a rationale that mentions the thing it forbids.
 */
const withoutComments = (source: string): string =>
  source.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');

const isProductSource = (path: string): boolean =>
  path.endsWith('.ts') && !path.endsWith('.test.ts') && !path.endsWith('.d.ts');

describe('domain purity', () => {
  /**
   * `no-restricted-properties` catches `Date.now`, but `new Date()` is a
   * constructor call that oxlint 1.74 cannot express a rule for. Domain code
   * takes a clock as an explicit dependency (`now: () => Date`) instead.
   */
  const pureDomainDirectories = ['apps/course-api/src/course-decision/model'];

  test('domain code uses explicit clocks', () => {
    const files = pureDomainDirectories.flatMap((dir) => walk(dir, isProductSource));
    expect(files.length).toBeGreaterThan(0);

    const offenders = files
      .filter((path) => /\bnew\s+Date\s*\(/.test(withoutComments(readFileSync(path, 'utf8'))))
      .map(relative);

    expect(offenders).toEqual([]);
  });
});

describe('transport boundary', () => {
  /**
   * Elysia modules are transport adapters. SQL belongs behind a repository
   * capability, so a handler that reaches for the database directly has skipped
   * a layer. Scoped to modules that actually import Elysia, which keeps the
   * SQL patterns from having to be clever.
   */
  const statementPatterns: readonly (readonly [string, RegExp])[] = [
    ['SELECT ... FROM', /\bselect\b[\s\S]{0,200}?\bfrom\b/i],
    ['INSERT INTO', /\binsert\s+into\b/i],
    ['UPDATE ... SET', /\bupdate\b[\s\S]{0,120}?\bset\b/i],
    ['DELETE FROM', /\bdelete\s+from\b/i],
    ['prepared statement', /\.prepare\s*\(/],
  ];

  const elysiaModules = ['apps', 'packages']
    .flatMap((dir) => walk(dir, isProductSource))
    .filter((path) => /from\s+['"]elysia['"]/.test(readFileSync(path, 'utf8')));

  test('Elysia handlers delegate persistence', () => {
    expect(elysiaModules.length).toBeGreaterThan(0);

    const offenders = elysiaModules.flatMap((path) => {
      const source = withoutComments(readFileSync(path, 'utf8'));
      return statementPatterns
        .filter(([, pattern]) => pattern.test(source))
        .map(([label]) => `${relative(path)}: ${label}`);
    });

    expect(offenders).toEqual([]);
  });
});

describe('appearance tokens', () => {
  /**
   * `apps/student-web/src/styles.css` is the token source: it maps Tailwind
   * `--color-*` onto `--md-sys-color-*`. Product components consume the
   * semantic tokens; a raw colour in a component is a second source of truth
   * for the same fact.
   */
  const colourLiteral = /#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?|oklch|oklab|lab|lch)\s*\(/;
  const palettePrefix =
    '(?:bg|text|border|ring|fill|stroke|from|via|to|outline|decoration|shadow|accent|caret|divide|placeholder)';
  const paletteName =
    '(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|white|black)';
  const paletteUtility = new RegExp(
    `\\b${palettePrefix}-${paletteName}(?:-(?:50|100|200|300|400|500|600|700|800|900|950))?\\b`,
  );

  /**
   * Pre-existing violations, recorded rather than hidden so the rule can be
   * green today and still fail on anything new. Both duplicate values that
   * `styles.css` already owns; clearing them is product work, not agent-context
   * work, so they are named here instead of quietly excluded.
   */
  const knownViolations: readonly string[] = [
    'apps/student-web/src/theme.ts',
    'apps/student-web/src/app.ts',
  ];

  const productComponents = walk('apps/student-web/src', isProductSource).filter(
    (path) => !knownViolations.includes(relative(path)),
  );

  test('product components consume semantic palette roles', () => {
    expect(productComponents.length).toBeGreaterThan(0);
    for (const path of knownViolations) {
      expect(() => statSync(join(repoRoot, path))).not.toThrow();
    }

    const offenders = productComponents
      .filter((path) => {
        const source = withoutComments(readFileSync(path, 'utf8'));
        return colourLiteral.test(source) || paletteUtility.test(source);
      })
      .map(relative);

    expect(offenders).toEqual([]);
  });
});

describe('colour contrast', () => {
  /**
   * Material's roles come in pairs: every `on-x` is the foreground that `x`
   * was chosen to carry (https://m3.material.io/styles/color/roles). That
   * pairing is the whole reason the token layer exists, and it is only worth
   * anything if the pair actually meets WCAG 2.2 AA — 4.5:1 for body text
   * (https://www.w3.org/TR/WCAG22/#contrast-minimum).
   *
   * axe checks contrast on rendered pages, which means it only sees the theme
   * a test happened to select. Contrast is a pure function of two colours, so
   * it can be checked exhaustively here instead: every pair, every preset,
   * both modes. Picking a colour that cannot carry its own foreground stops
   * being a thing anyone has to notice.
   */
  const stylesheet = readFileSync(join(repoRoot, 'apps/student-web/src/styles.css'), 'utf8');

  const blocks = new Map<string, Map<string, string>>();
  for (const [, selector, body] of stylesheet.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const declarations = new Map<string, string>();
    for (const declaration of (body ?? '').split(';')) {
      const separator = declaration.indexOf(':');
      if (separator === -1) continue;
      const name = declaration.slice(0, separator).trim();
      if (name.startsWith('--')) declarations.set(name, declaration.slice(separator + 1).trim());
    }
    if (declarations.size > 0) blocks.set((selector ?? '').trim(), declarations);
  }

  /** Later selectors override earlier ones, exactly as the cascade resolves them. */
  const resolve = (selectors: readonly string[]): ReadonlyMap<string, string> => {
    const merged = new Map<string, string>();
    for (const selector of selectors) {
      for (const [name, value] of blocks.get(selector) ?? []) merged.set(name, value);
    }
    return merged;
  };

  const luminanceOf = (linear: readonly number[]): number =>
    0.2126 * linear[0]! + 0.7152 * linear[1]! + 0.0722 * linear[2]!;

  /**
   * Both notations resolve to the same linear-light channels, so the rule does
   * not care which one a token is authored in and keeps holding while they are
   * migrated.
   */
  const relativeLuminance = (colour: string): number | null => {
    const hex = /^#([0-9a-fA-F]{6})$/.exec(colour);
    if (hex?.[1] !== undefined) {
      const digits = hex[1];
      return luminanceOf(
        [0, 2, 4].map((offset) => {
          const value = Number.parseInt(digits.slice(offset, offset + 2), 16) / 255;
          return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
        }),
      );
    }

    const oklch = /^oklch\(\s*([0-9.]+)%?\s+([0-9.]+)\s+([0-9.]+)\s*\)$/.exec(colour);
    if (oklch?.[1] === undefined || oklch[2] === undefined || oklch[3] === undefined) return null;
    const raw = Number.parseFloat(oklch[1]);
    const lightness = colour.includes('%') ? raw / 100 : raw;
    const chroma = Number.parseFloat(oklch[2]);
    const radians = (Number.parseFloat(oklch[3]) * Math.PI) / 180;
    const a = chroma * Math.cos(radians);
    const b = chroma * Math.sin(radians);

    const long = (lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3;
    const medium = (lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3;
    const short = (lightness - 0.0894841775 * a - 1.291485548 * b) ** 3;

    return luminanceOf(
      [
        4.0767416621 * long - 3.3077115913 * medium + 0.2309699292 * short,
        -1.2684380046 * long + 2.6097574011 * medium - 0.3413193965 * short,
        -0.0041960863 * long - 0.7034186147 * medium + 1.707614701 * short,
      ].map((value) => Math.min(1, Math.max(0, value))),
    );
  };

  const contrast = (foreground: string, background: string): number | null => {
    const first = relativeLuminance(foreground);
    const second = relativeLuminance(background);
    if (first === null || second === null) return null;
    return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
  };

  const presetContexts = [
    { id: 'fjord', base: 'mist', theme: 'blue' },
    { id: 'aurora', base: 'zinc', theme: 'violet' },
    { id: 'birch', base: 'stone', theme: 'amber' },
    { id: 'heather', base: 'mauve', theme: 'rose' },
    { id: 'pine', base: 'olive', theme: 'emerald' },
    { id: 'polar-night', base: 'neutral', theme: 'sky' },
  ].flatMap((preset) => {
    const light = [
      ':root',
      `:root[data-base-color='${preset.base}']`,
      `:root[data-theme-color='${preset.theme}']`,
    ];
    return [
      { label: `${preset.id}/light`, selectors: light },
      {
        label: `${preset.id}/dark`,
        selectors: [
          ...light,
          ':root.dark',
          `:root.dark[data-base-color='${preset.base}']`,
          `:root.dark[data-theme-color='${preset.theme}']`,
        ],
      },
    ];
  });

  const pairs = presetContexts.flatMap(({ label, selectors }) => {
    const tokens = resolve(selectors);
    return [...tokens].flatMap(([name, foreground]) => {
      if (!name.startsWith('--md-sys-color-on-')) return [];
      const role = `--md-sys-color-${name.slice('--md-sys-color-on-'.length)}`;
      const background = tokens.get(role);
      if (background === undefined) return [];
      const ratio = contrast(foreground, background);
      return ratio === null ? [] : [{ label, name, role, ratio }];
    });
  });

  test('every semantic role carries a WCAG AA foreground', () => {
    expect(pairs.length).toBeGreaterThan(100);

    const offenders = pairs
      .filter((pair) => pair.ratio < 4.5)
      .map(
        (pair) =>
          `${pair.label} ${pair.name.replace('--md-sys-color-', '')} on ${pair.role.replace('--md-sys-color-', '')}: ${pair.ratio.toFixed(2)}:1`,
      );

    expect(offenders).toEqual([]);
  });
});

describe('dependency direction', () => {
  const activeWorkspaceNames = [
    '@course-data/course-api',
    '@course-data/course-contracts',
    '@course-data/student-web',
    '@course-data/infrastructure',
  ];

  type WorkspaceManifest = {
    readonly name: string;
    readonly dependencies?: Readonly<Record<string, string>>;
    readonly devDependencies?: Readonly<Record<string, string>>;
  };
  const readWorkspace = (path: string): WorkspaceManifest =>
    JSON.parse(readFileSync(path, 'utf8')) as WorkspaceManifest;
  const workspaces = [
    ...['apps', 'packages'].flatMap((group) =>
      readdirSync(join(repoRoot, group))
        .map((entry) => join(repoRoot, group, entry, 'package.json'))
        .filter((path) => {
          try {
            return statSync(path).isFile();
          } catch {
            return false;
          }
        })
        .map(readWorkspace),
    ),
    readWorkspace(join(repoRoot, 'infra/package.json')),
  ];

  const productSources = [
    ...walk('apps/course-api/src', isProductSource),
    ...walk('apps/student-web/src', isProductSource),
    ...walk('packages/course-contracts/src', isProductSource),
  ];
  const workspaceImports = productSources.flatMap((path) => {
    const importer = relative(path).split('/').slice(0, 2).join('/');
    const source = withoutComments(readFileSync(path, 'utf8'));
    return [...source.matchAll(/from\s+['"](@course-data\/[^'"]+)['"]/g)].flatMap(
      ([, dependency]) => (dependency === undefined ? [] : [`${importer} -> ${dependency}`]),
    );
  });

  test('only active workspaces remain', () => {
    expect(workspaces.map(({ name }) => name).sort()).toEqual([...activeWorkspaceNames].sort());
  });

  test('the import scan covers both runtime-to-contract edges', () => {
    expect([...new Set(workspaceImports)].sort()).toEqual([
      'apps/course-api -> @course-data/course-contracts',
      'apps/student-web -> @course-data/course-contracts',
    ]);
  });

  test('the neutral contract has no runtime dependency', () => {
    const contract = workspaces.find(({ name }) => name === '@course-data/course-contracts');
    expect(contract).toBeDefined();
    expect(
      Object.keys({
        ...(contract?.dependencies ?? {}),
        ...(contract?.devDependencies ?? {}),
      }).filter(
        (dependency) =>
          dependency === 'elysia' ||
          dependency === 'effect' ||
          dependency.startsWith('@course-data/'),
      ),
    ).toEqual([]);
  });

  test('the browser does not import server runtimes', () => {
    const offenders = walk('apps/student-web/src', isProductSource)
      .filter((path) =>
        /from\s+['"](?:elysia(?:\/[^'"]*)?|@cloudflare\/[^'"]+|apps\/course-api)['"]/.test(
          withoutComments(readFileSync(path, 'utf8')),
        ),
      )
      .map(relative);

    expect(offenders).toEqual([]);
  });
});
