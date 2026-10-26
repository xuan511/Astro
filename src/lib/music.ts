import { z } from 'astro/zod';
import data from '../data/music.json';
import type { Track } from './player-state';

const asset = z
  .string()
  .refine(
    (src) =>
      /^https?:\/\//.test(src) ||
      (/^(?:music|media|images)\/[a-z\d_./-]+$/i.test(src) && !src.includes('..')),
    '资源必须是站内路径或 HTTP(S) 地址',
  );
const schema = z.array(
  z.object({
    id: z.string().regex(/^[a-z\d-]+$/),
    title: z.string().min(1),
    artist: z.string().min(1),
    src: asset,
    cover: asset.optional(),
    demo: z.boolean().default(false),
  }),
);
export const tracks: Track[] = schema.parse(data);
if (new Set(tracks.map((track) => track.id)).size !== tracks.length)
  throw new Error('歌单中的歌曲 id 不能重复');
