import { fixtureCourseDecisionService } from '@course-data/course-service/fixture';
import { CloudflareAdapter } from 'elysia/adapter/cloudflare-worker';
import { Elysia } from 'elysia';

import { createCourseApi } from './app';

export default new Elysia({ adapter: CloudflareAdapter })
  .use(createCourseApi(fixtureCourseDecisionService))
  .compile();
