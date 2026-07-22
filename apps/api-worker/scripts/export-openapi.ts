import {
  createMemoryCourseRepository,
  createMemoryProgrammeCurriculumRepository,
} from '@course-data/application';
import { fixtureCourses } from '@course-data/application/fixtures';
import { demoProgrammeVersions } from '@course-data/application/planner-fixtures';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createApi } from '../src/app';
import { createCourseRuntime } from '../src/runtime';

const app = createApi(
  createCourseRuntime(
    createMemoryCourseRepository(fixtureCourses),
    createMemoryProgrammeCurriculumRepository(demoProgrammeVersions),
  ),
);
const response = await app.handle(new Request('http://localhost/openapi/json'));
if (!response.ok) throw new Error(`OpenAPI export failed: ${response.status}`);

const repositoryRoot = fileURLToPath(new URL('../../../', import.meta.url));
const output = resolve(repositoryRoot, 'docs/generated/openapi.json');
await mkdir(resolve(output, '..'), { recursive: true });
await writeFile(output, `${JSON.stringify(await response.json(), null, 2)}\n`, 'utf8');
console.error(`Wrote ${output}`);
