import { defineConfig, loadEnv, type Plugin } from 'vite';

/** Writes robots.txt and sitemap.xml for the configured VITE_SITE_URL at build time. */
function seoFiles(siteUrl: string): Plugin {
  const site = siteUrl.replace(/\/+$/, '');
  return {
    name: 'seo-files',
    apply: 'build',
    generateBundle() {
      const today = new Date().toISOString().slice(0, 10);
      this.emitFile({
        type: 'asset',
        fileName: 'robots.txt',
        source: `User-agent: *\nAllow: /\n\nSitemap: ${site}/sitemap.xml\n`,
      });
      this.emitFile({
        type: 'asset',
        fileName: 'sitemap.xml',
        source:
          `<?xml version="1.0" encoding="UTF-8"?>\n` +
          `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
          `  <url><loc>${site}/</loc><lastmod>${today}</lastmod><changefreq>weekly</changefreq><priority>1.0</priority></url>\n` +
          `</urlset>\n`,
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', 'VITE_');
  return {
    base: './',
    // Leaderboard API: run `npm run dev:api` alongside `npm run dev` to use it locally
    server: { host: true, proxy: { '/api': 'http://localhost:8787' } },
    plugins: [seoFiles(env.VITE_SITE_URL ?? 'https://chanda-truck.rasel.me')],
    build: {
      target: 'es2020',
      chunkSizeWarningLimit: 1200,
    },
  };
});
