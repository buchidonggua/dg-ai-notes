// astro.config.mjs
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import react from '@astrojs/react';

export default defineConfig({
  integrations: [
    mdx({
      gfm: true,
    }),
    react(),
  ],
  site: 'https://dg-ai-notes.pages.dev',
  markdown: {
    shikiConfig: {
      theme: 'one-dark-pro',
      wrap: true,
    },
  },
  experimental: { clientPrerender: true },
});
