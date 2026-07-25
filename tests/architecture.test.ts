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
