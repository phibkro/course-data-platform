import type { Api } from '@course-data/api-worker/app';
import { treaty } from '@elysiajs/eden';

const apiUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:8787';

export const api = treaty<Api>(apiUrl);
