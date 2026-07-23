import { fixtureCourseDecisionService } from '@course-data/course-service/fixture';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createCourseApi } from '../src/app';

const app = createCourseApi(fixtureCourseDecisionService, () => 'openapi-export');
const response = await app.handle(new Request('http://localhost/openapi/json'));
if (!response.ok) throw new Error(`OpenAPI export failed: ${response.status}`);

const repositoryRoot = fileURLToPath(new URL('../../../', import.meta.url));
const output = resolve(repositoryRoot, 'docs/generated/course-decision-openapi.json');
await mkdir(resolve(output, '..'), { recursive: true });
await writeFile(output, `${JSON.stringify(await response.json(), null, 2)}\n`, 'utf8');
console.error(`Wrote ${output}`);
