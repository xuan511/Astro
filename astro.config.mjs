import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { unified } from '@astrojs/markdown-remark';
import contentAssets from './scripts/rehype-content.mjs';
import { deployment } from './scripts/deployment.mjs';

const { site, base } = deployment();
export default defineConfig({
  site,
  base,
  output: 'static',
  trailingSlash: 'always',
  server: { host: '0.0.0.0', port: 4173 },
  integrations: [
    mdx(),
    sitemap({
      filter: (page) => {
        const path = new URL(page).pathname;
        return (
          ![`${base}404/`, `${base}404.html`].includes(path) && !path.startsWith(`${base}legacy/`)
        );
      },
    }),
  ],
  markdown: {
    processor: unified({
      remarkPlugins: [remarkMath],
      rehypePlugins: [rehypeKatex, contentAssets],
    }),
    shikiConfig: { themes: { light: 'github-light', dark: 'github-dark' }, wrap: false },
  },
  devToolbar: { enabled: false },
  // Keep Vite's native tsconfig discovery inside this project, even when a
  // parent download folder contains another unpacked site's tsconfig.json.
  vite: { tsconfig: 'tsconfig.json', server: { allowedHosts: ['terminal.local'] } },
});
