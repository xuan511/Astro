const { readFileSync } = require('node:fs');
// Choose real published content so removing the bundled examples remains safe.
const article = JSON.parse(readFileSync('./dist/search.json', 'utf8')).find(
  (entry) => entry.kind === 'tech' || entry.kind === 'life',
);
module.exports = {
  ci: {
    collect: {
      staticDistDir: './dist',
      url: [
        'http://localhost/',
        ...(article ? [new URL(article.url, 'http://localhost').href] : []),
        'http://localhost/music/',
      ],
      numberOfRuns: 3,
      settings: {
        formFactor: 'mobile',
        screenEmulation: {
          mobile: true,
          width: 390,
          height: 844,
          deviceScaleFactor: 1,
          disabled: false,
        },
      },
    },
    assert: {
      assertions: {
        'categories:performance': ['warn', { minScore: 0.9 }],
        'categories:accessibility': ['warn', { minScore: 0.95 }],
        'categories:best-practices': ['warn', { minScore: 0.95 }],
        'categories:seo': ['warn', { minScore: 0.95 }],
      },
    },
    upload: { target: 'filesystem', outputDir: './reports/lighthouse' },
  },
};
