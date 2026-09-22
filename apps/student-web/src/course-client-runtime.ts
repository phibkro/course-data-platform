import { makeCourseClient } from './course-client';
import { makeFixtureCourseClient } from './course-client.fixture';

const apiBaseUrl = import.meta.env.VITE_API_URL as string | undefined;

export const courseClient =
  import.meta.env.VITE_USE_FIXTURE === 'true'
    ? makeFixtureCourseClient()
    : makeCourseClient(apiBaseUrl);
