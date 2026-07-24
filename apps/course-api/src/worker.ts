import { makeLiveCourseDecisionService } from '@course-data/course-service/live';
import { CloudflareAdapter } from 'elysia/adapter/cloudflare-worker';
import { Elysia } from 'elysia';

import { createCourseApi } from './app';

const sha256Hex = async (input: string): Promise<string> => {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
};

const service = makeLiveCourseDecisionService(
  {
    fetch: (url, init) => fetch(url, init),
    now: () => new Date(),
    sha256Hex,
  },
  {
    academicYear: 2026,
    season: 'autumn',
    gradeFromYear: 2022,
    gradeToYear: 2025,
  },
);

export default new Elysia({ adapter: CloudflareAdapter }).use(createCourseApi(service)).compile();
