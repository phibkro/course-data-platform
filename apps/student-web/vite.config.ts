import { defineConfig } from 'vite';
import { foldkit } from '@foldkit/vite-plugin';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ mode }) => ({
  plugins: [foldkit(), tailwindcss()],
  ...(mode === 'a11y'
    ? { define: { 'import.meta.env.VITE_USE_FIXTURE': JSON.stringify('true') } }
    : {}),
}));
