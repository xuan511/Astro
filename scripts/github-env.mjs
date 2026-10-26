import { appendFile } from 'node:fs/promises';
import { deployment } from './deployment.mjs';

const env = { ...process.env };
if (env.REQUESTED_SITE?.trim()) env.SITE_URL = env.REQUESTED_SITE.trim();
if (env.REQUESTED_BASE?.trim()) env.BASE_PATH = env.REQUESTED_BASE.trim();
const resolved = deployment(env);
if (!process.env.GITHUB_ENV) throw new Error('此脚本由 GitHub Actions 调用。');
await appendFile(process.env.GITHUB_ENV, `SITE_URL=${resolved.site}\nBASE_PATH=${resolved.base}\n`);
console.log(`Building ${resolved.site}${resolved.base}`);
