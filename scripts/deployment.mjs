import configured from '../config/deployment.json' with { type: 'json' };
import { readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';

// Astro loads .env after its configuration. Read deployment values explicitly,
// keeping shell/Actions variables authoritative without mutating process.env.
export function deploymentEnvironment(env = process.env, file = '.env') {
  try {
    return { ...parseEnv(readFileSync(file, 'utf8')), ...env };
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    return { ...env };
  }
}

export function deployment(env = deploymentEnvironment()) {
  const [owner, repo, extra] = (env.GITHUB_REPOSITORY || '').split('/');
  const github = env.GITHUB_ACTIONS === 'true';
  if (github && (!owner || !repo || extra || !/^[\w.-]+\/[\w.-]+$/.test(`${owner}/${repo}`))) {
    throw new Error('GITHUB_REPOSITORY 必须是 owner/repository。');
  }
  const site = env.SITE_URL || (github ? `https://${owner}.github.io` : configured.site);
  const inferredBase =
    github && repo.toLowerCase() !== `${owner}.github.io`.toLowerCase() ? `/${repo}/` : '/';
  const rawBase = env.BASE_PATH ?? (github ? inferredBase : configured.base);
  const parsed = new URL(site);
  if (
    !['http:', 'https:'].includes(parsed.protocol) ||
    parsed.username ||
    parsed.password ||
    parsed.pathname !== '/' ||
    parsed.search ||
    parsed.hash
  ) {
    throw new Error('SITE_URL 必须是 HTTP(S) 网站源地址，子目录请通过 BASE_PATH 配置。');
  }
  let decodedBase;
  try {
    decodedBase = decodeURIComponent(rawBase);
  } catch {
    throw new Error('BASE_PATH 包含无效的 URL 编码。');
  }
  if (
    !/^\/[a-z\d._~%/-]*$/i.test(rawBase) ||
    /%2f|%5c/i.test(rawBase) ||
    decodedBase.split('/').some((part) => part === '.' || part === '..')
  ) {
    throw new Error('BASE_PATH 必须是以 / 开头的站点路径。');
  }
  const baseSegments = rawBase.split('/').filter(Boolean);
  return {
    site: parsed.origin,
    base: baseSegments.length ? `/${baseSegments.join('/')}/` : '/',
  };
}
