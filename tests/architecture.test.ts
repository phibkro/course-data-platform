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
  const pureDomainDirectories = [
    'packages/course-model/src',
    'packages/domain/src',
    'packages/study-kernel/src',
    'packages/application/src',
  ];

  test('every declared domain directory actually exists', () => {
    // `walk` returns [] for a missing directory, so a rename would otherwise
    // turn this suite green by scanning nothing.
    const empty = pureDomainDirectories.filter((dir) => walk(dir, isProductSource).length === 0);
    expect(empty).toEqual([]);
  });

  test('domain code does not construct an ambient clock reading', () => {
    const offenders = pureDomainDirectories
      .flatMap((dir) => walk(dir, isProductSource))
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

  test('the scan actually covers the Elysia modules', () => {
    // A pattern-based rule that silently matches nothing is a green stub.
    expect(elysiaModules.length).toBeGreaterThan(0);
  });

  test('Elysia handlers contain no SQL', () => {
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
    'apps/student-web/src/main.ts',
  ];

  const productComponents = walk('apps/student-web/src', isProductSource).filter(
    (path) => !knownViolations.includes(relative(path)),
  );

  test('the scan actually covers the student-web components', () => {
    expect(productComponents.length).toBeGreaterThan(0);
  });

  test('product components introduce no direct palette values', () => {
    const offenders = productComponents
      .filter((path) => {
        const source = withoutComments(readFileSync(path, 'utf8'));
        return colourLiteral.test(source) || paletteUtility.test(source);
      })
      .map(relative);

    expect(offenders).toEqual([]);
  });

  test('every recorded exception is still a real file', () => {
    // Keeps the allowlist from outliving the violation it excuses.
    for (const path of knownViolations) {
      expect(() => statSync(join(repoRoot, path))).not.toThrow();
    }
  });
});

describe('styling belongs to Tailwind', () => {
  /**
   * Tailwind's scale is the type system for appearance: `text-sm` names a step
   * every other call site shares, while `text-[0.82rem]` names a number only
   * this call site knows. Nineteen hand-written sizes once sat within a
   * 2.6-pixel band, which is not a hierarchy — it is drift with no way to
   * disagree loudly. Arbitrary values stay available for genuinely one-off
   * geometry (`rounded-[1.5rem]`); only the type axes are constrained, because
   * those are the ones that must agree across surfaces.
   */
  const arbitraryTypeUtility = /\b(?:text-\[[0-9.]+rem\]|font-\[[0-9]+\])/;

  /**
   * A style object is CSS smuggled past the scale. The exceptions are real but
   * narrow: a value computed from data at render time (a bar's height, a
   * gradient's sweep) cannot be a static class, because Tailwind's scanner
   * only sees source text. Those sites declare themselves, so the rule stays
   * total and every remaining escape is a deliberate, readable one.
   */
  const exemption = 'tailwind-exempt:';

  const styledComponents = walk('apps/student-web/src', isProductSource);

  test('the scan actually covers the student-web components', () => {
    expect(styledComponents.length).toBeGreaterThan(0);
  });

  test('components size type from the Tailwind scale', () => {
    const offenders = styledComponents
      .filter((path) => arbitraryTypeUtility.test(withoutComments(readFileSync(path, 'utf8'))))
      .map(relative);

    expect(offenders).toEqual([]);
  });

  test('every inline style declares why Tailwind cannot express it', () => {
    const offenders = styledComponents.flatMap((path) => {
      const lines = readFileSync(path, 'utf8').split('\n');
      return lines.flatMap((line, index) => {
        if (!line.includes('h.Style(')) return [];
        // The marker sits in the comment immediately above the call, so the
        // reason travels with the exception instead of living in a registry.
        const preceding = lines.slice(Math.max(0, index - 3), index).join('\n');
        return preceding.includes(exemption) ? [] : [`${relative(path)}:${index + 1}`];
      });
    });

    expect(offenders).toEqual([]);
  });
});

describe('theme preset swatches', () => {
  /**
   * A preset swatch exists to show what selecting the preset will do. Its
   * colours were painted by hand into `--preset-*`, which makes them a second
   * copy of values the token blocks already own: change a token and the
   * preview keeps advertising the old theme, with nothing failing.
   *
   * The top rung would be deriving the swatch from the tokens themselves, so
   * disagreement could not be written down. That needs the theme selectors to
   * apply below `:root`, and a browser to confirm the cascade still resolves —
   * which no check in this repository can currently do. This is the rung below
   * it: the copy stays, and drift fails here instead of shipping silently.
   */
  const stylesheet = readFileSync(join(repoRoot, 'apps/student-web/src/styles.css'), 'utf8');
  const themeSource = readFileSync(join(repoRoot, 'apps/student-web/src/theme.ts'), 'utf8');

  const presets = [
    ...themeSource.matchAll(
      /\{ id: '([^']+)', baseColor: '([^']+)', themeColor: '([^']+)', chartColor: '([^']+)' \}/g,
    ),
  ].flatMap(([, id, baseColor, themeColor, chartColor]) =>
    // A capture group that matched is a string; narrowing here keeps the rest
    // of the rule free of assertions.
    id === undefined ||
    baseColor === undefined ||
    themeColor === undefined ||
    chartColor === undefined
      ? []
      : [{ id, baseColor, themeColor, chartColor }],
  );

  const declarations = (selector: string): ReadonlyMap<string, string> => {
    const opening = stylesheet.indexOf(`${selector} {`);
    if (opening === -1) return new Map();
    const body = stylesheet.slice(opening, stylesheet.indexOf('}', opening));
    return new Map(
      body
        .slice(body.indexOf('{') + 1)
        .split(';')
        .flatMap((declaration) => {
          const separator = declaration.indexOf(':');
          if (separator === -1) return [];
          const name = declaration.slice(0, separator).trim();
          return name.startsWith('--')
            ? ([[name, declaration.slice(separator + 1).trim()]] as const)
            : [];
        }),
    );
  };

  /** A variant block only overrides what it names; the rest stays `:root`. */
  const token = (selector: string, name: string): string | undefined =>
    declarations(selector).get(name) ?? declarations(':root').get(name);

  /**
   * Polar Night's swatch is painted from the *dark* neutral surface, but
   * `ThemePreset` carries no mode, so choosing it in light mode applies the
   * light neutral surface instead. The preview promises a theme the preset
   * does not apply. Recorded rather than silently excluded: whether Polar
   * Night should set dark mode, or show its light surface, is a product
   * decision.
   */
  const knownDisagreements: readonly string[] = ['polar-night'];

  test('the scan actually found the presets', () => {
    expect(presets.map((preset) => preset.id)).toContain('fjord');
    expect(presets.length).toBeGreaterThan(1);
  });

  test('every swatch shows the tokens its preset actually applies', () => {
    const offenders = presets
      .filter((preset) => !knownDisagreements.includes(preset.id))
      .flatMap((preset) => {
        const swatch = declarations(`.theme-preset-card--${preset.id}`);
        const accent = token(
          `:root[data-theme-color='${preset.themeColor}']`,
          '--md-sys-color-primary',
        );
        /**
         * The swatch shows four distinguishable bands, so its chart stripe
         * takes the palette's first chart colour unless that repeats the
         * accent it sits beside — three of the six presets pair a theme and a
         * chart palette that share a first colour, and each reaches for the
         * second instead.
         */
        const chartSelector = `:root[data-chart-color='${preset.chartColor}']`;
        const firstChart = token(chartSelector, '--chart-1');
        const expected = {
          '--preset-surface': token(
            `:root[data-base-color='${preset.baseColor}']`,
            '--md-sys-color-surface',
          ),
          '--preset-accent': accent,
          '--preset-accent-container': token(
            `:root[data-theme-color='${preset.themeColor}']`,
            '--md-sys-color-primary-container',
          ),
          '--preset-chart': firstChart === accent ? token(chartSelector, '--chart-2') : firstChart,
        };

        return Object.entries(expected).flatMap(([name, value]) =>
          swatch.get(name) === value
            ? []
            : [`${preset.id} ${name}: swatch ${swatch.get(name)} vs token ${value}`],
        );
      });

    expect(offenders).toEqual([]);
  });

  test('every recorded disagreement is still a real preset', () => {
    for (const id of knownDisagreements) {
      expect(presets.map((preset) => preset.id)).toContain(id);
    }
  });
});

describe('dependency direction', () => {
  /**
   * `apps -> infrastructure packages -> application -> domain`. Encoded as a
   * strict layer index per workspace: every workspace dependency must sit
   * strictly further in than its dependent.
   *
   * The repository holds two stacks that layer the same way but do not mix.
   * Adding a workspace requires adding it here, which is the point — an
   * unplaced package fails loudly rather than defaulting into a safe layer.
   */
  const layerOf: Readonly<Record<string, number>> = {
    // 0 — domain models. No workspace dependencies at all.
    '@course-data/course-model': 0,
    '@course-data/domain': 0,

    // 1 — provider adapters and the planning model over a domain.
    '@course-data/source-grades': 1,
    '@course-data/source-ntnu-course': 1,
    '@course-data/source-dbh': 1,
    '@course-data/source-ntnu': 1,
    '@course-data/study-kernel': 1,

    // 2 — coordination: partial success, ports, orchestration.
    '@course-data/course-service': 2,
    '@course-data/application': 2,

    // 3 — outward-facing packages: public DTOs, persistence.
    '@course-data/contracts': 3,
    '@course-data/database': 3,

    // 4 — applications and composition roots.
    '@course-data/course-api': 4,
    '@course-data/student-web': 4,
    '@course-data/api-worker': 4,
    '@course-data/ingest-worker': 4,
    '@course-data/web': 4,
  };

  /**
   * Legacy planner stack only: the React workspace imports the worker app
   * rather than a shared package. Recorded so a *new* app-on-app edge fails.
   */
  const knownLegacyEdges: readonly string[] = ['@course-data/web -> @course-data/api-worker'];

  const workspaces = ['apps', 'packages'].flatMap((group) =>
    readdirSync(join(repoRoot, group))
      .map((entry) => join(repoRoot, group, entry, 'package.json'))
      .filter((path) => {
        try {
          return statSync(path).isFile();
        } catch {
          return false;
        }
      })
      .map(
        (path) =>
          JSON.parse(readFileSync(path, 'utf8')) as {
            name: string;
            dependencies?: Record<string, string>;
            devDependencies?: Record<string, string>;
          },
      ),
  );

  test('every workspace has a declared layer', () => {
    const unplaced = workspaces.map((pkg) => pkg.name).filter((name) => !(name in layerOf));
    expect(unplaced).toEqual([]);
  });

  test('dependencies flow inward', () => {
    const offenders = workspaces.flatMap((pkg) => {
      const deps = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };
      return Object.keys(deps)
        .filter((dep) => dep in layerOf)
        .filter((dep) => layerOf[dep]! >= layerOf[pkg.name]!)
        .map((dep) => `${pkg.name} -> ${dep}`)
        .filter((edge) => !knownLegacyEdges.includes(edge));
    });

    expect(offenders).toEqual([]);
  });
});
