import { mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { deployment } from './deployment.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const argument = process.argv[2];
if (process.argv.length > 3 || (argument && !argument.startsWith('--repo='))) {
  throw new Error('用法：npm run verify:pages -- --repo=用户名/仓库名');
}
const repository = argument?.slice('--repo='.length) || 'pages-check/blog';
deployment({ GITHUB_ACTIONS: 'true', GITHUB_REPOSITORY: repository });
const [owner, name] = repository.split('/');
const scenarios = [
  {
    label: 'root',
    environment: { GITHUB_ACTIONS: 'true', GITHUB_REPOSITORY: `${owner}/${owner}.github.io` },
  },
  {
    label: 'project',
    environment: {
      GITHUB_ACTIONS: 'true',
      GITHUB_REPOSITORY:
        name.toLowerCase() === `${owner}.github.io`.toLowerCase() ? `${owner}/blog` : repository,
    },
  },
  {
    label: 'custom-domain',
    environment: { SITE_URL: 'https://journal.example.com', BASE_PATH: '/' },
  },
];
const packagePath = resolve(root, 'node_modules/astro/package.json');
const astro = JSON.parse(await readFile(packagePath, 'utf8'));
const binary = resolve(dirname(packagePath), astro.bin.astro);
// Astro 移动预渲染资源时使用 rename；同卷输出避免 Windows 跨盘 EXDEV。
// .astro 已忽略，每次只清理本次创建的 pages-* 目录，保留现有 dist。
const temporaryParent = join(root, '.astro');
await mkdir(temporaryParent, { recursive: true });
const temporary = await mkdtemp(join(temporaryParent, 'pages-'));
function run(args, env) {
  const result = spawnSync(process.execPath, args, { cwd: root, env, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`Pages 预检失败（退出码 ${result.status}）。`);
}
try {
  for (const { label, environment } of scenarios) {
    const { site, base } = deployment(environment);
    const output = join(temporary, label);
    const env = { ...process.env, SITE_URL: site, BASE_PATH: base, VERIFY_DIST: output };
    console.log(`\n检查 ${label}: ${site}${base}`);
    run([binary, 'build', '--outDir', output], env);
    run(['scripts/verify-build.mjs'], env);
  }
  console.log('\nGitHub Pages 根路径、项目子路径和自定义域名均通过，现有 dist/ 保持不变。');
} finally {
  await rm(temporary, { recursive: true, force: true });
}
