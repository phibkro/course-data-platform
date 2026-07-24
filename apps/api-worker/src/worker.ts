import {
  createD1CourseRepository,
  createD1ProgrammeCurriculumRepository,
} from '@course-data/database';
import { CloudflareAdapter } from 'elysia/adapter/cloudflare-worker';
import { env } from 'cloudflare:workers';
import { Elysia } from 'elysia';

import { createApi } from './app';
import { createCourseRuntime } from './runtime';

const runtime = createCourseRuntime(
  createD1CourseRepository(env.DB),
  createD1ProgrammeCurriculumRepository(env.DB),
);

export default new Elysia({ adapter: CloudflareAdapter }).use(createApi(runtime)).compile();
