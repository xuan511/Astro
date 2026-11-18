export type ReactionName =
  'bounce' | 'sway' | 'twirl' | 'shy' | 'cheer' | 'bow' | 'pet' | 'celebrate';
export interface TapMemory {
  count: number;
  at: number;
}
export interface ReactionPlan {
  name: ReactionName;
  duration: number;
  frames: Keyframe[];
  symbols: readonly string[];
  particles: number;
  tone: 'mint' | 'rose' | 'gold';
  line?: string;
}
interface Personality {
  sequence: readonly ReactionName[];
  symbols: readonly string[];
  tone: ReactionPlan['tone'];
  pet: string;
  celebrate: string;
}
const personalities: Record<string, Personality> = {
  atri: {
    sequence: ['bounce', 'cheer', 'twirl', 'sway', 'bow'],
    symbols: ['✦', '✧'],
    tone: 'mint',
    pet: '充电完成！再摸一下也可以哦。',
    celebrate: '收到好多喜欢！元气满满地出发～',
  },
  tsumugi: {
    sequence: ['sway', 'bow', 'twirl', 'bounce', 'shy'],
    symbols: ['❀', '♡'],
    tone: 'rose',
    pet: '姆啾～今天也被温柔地接住啦。',
    celebrate: '姆啾姆啾～把这些快乐都收藏起来！',
  },
  shiki: {
    sequence: ['twirl', 'sway', 'cheer', 'bow', 'bounce'],
    symbols: ['✿', '✧'],
    tone: 'rose',
    pet: '诶嘿，今天的好运分你一半。',
    celebrate: '发现一份小幸运！这次要一起开心呀。',
  },
  kud: {
    sequence: ['bounce', 'cheer', 'sway', 'twirl', 'bow'],
    symbols: ['✧', '♡'],
    tone: 'gold',
    pet: '哇呼～摸摸头，元气加满！',
    celebrate: '哇呼～收到超级多的喜欢啦！',
  },
  hitori: {
    sequence: ['shy', 'bow', 'sway', 'bounce', 'cheer'],
    symbols: ['♪', '♡'],
    tone: 'rose',
    pet: '我、我会努力不紧张的…谢谢你。',
    celebrate: '被、被发现了！今天也谢谢你的陪伴…',
  },
  nijika: {
    sequence: ['cheer', 'bounce', 'sway', 'bow', 'twirl'],
    symbols: ['♫', '✦'],
    tone: 'gold',
    pet: '补充元气成功！下一拍也一起吧。',
    celebrate: '这个节奏不错！再一起开心一点吧！',
  },
  kita: {
    sequence: ['twirl', 'cheer', 'sway', 'bounce', 'bow'],
    symbols: ['♪', '✦'],
    tone: 'rose',
    pet: '收到你的喜欢啦，闪闪发光～',
    celebrate: '今天的快乐加倍！你也闪闪发光呀！',
  },
};
const motions: Record<ReactionName, { duration: number; frames: Keyframe[] }> = {
  bounce: {
    duration: 850,
    frames: [
      { transform: 'translateY(0) scale(1)' },
      { transform: 'translateY(3px) scale(1.06, .93)', offset: 0.18 },
      { transform: 'translateY(-19px) scale(.97, 1.04)', offset: 0.42 },
      { transform: 'translateY(0) scale(1.05, .95)', offset: 0.65 },
      { transform: 'translateY(-7px) scale(1)', offset: 0.82 },
      { transform: 'translateY(0) scale(1)' },
    ],
  },
  sway: {
    duration: 900,
    frames: [
      { transform: 'rotate(0deg)' },
      { transform: 'translateX(-5px) rotate(-10deg)', offset: 0.23 },
      { transform: 'translateX(5px) rotate(9deg)', offset: 0.5 },
      { transform: 'translateX(-2px) rotate(-4deg)', offset: 0.76 },
      { transform: 'rotate(0deg)' },
    ],
  },
  twirl: {
    duration: 1050,
    frames: [
      { transform: 'translateY(0) rotate(0deg)' },
      { transform: 'translateY(-4px) rotate(-12deg)', offset: 0.15 },
      { transform: 'translateY(-13px) rotate(180deg)', offset: 0.52 },
      { transform: 'translateY(-3px) rotate(367deg)', offset: 0.86 },
      { transform: 'translateY(0) rotate(360deg)' },
    ],
  },
  shy: {
    duration: 1000,
    frames: [
      { transform: 'translate(0, 0) scale(1)' },
      { transform: 'translate(-6px, 7px) rotate(-7deg) scale(.92)', offset: 0.28 },
      { transform: 'translate(-2px, 6px) rotate(-3deg) scale(.94)', offset: 0.48 },
      { transform: 'translate(-6px, 7px) rotate(-6deg) scale(.94)', offset: 0.66 },
      { transform: 'translate(0, 0) scale(1)' },
    ],
  },
  cheer: {
    duration: 1000,
    frames: [
      { transform: 'translate(0, 0) rotate(0deg)' },
      { transform: 'translate(-5px, -13px) rotate(-9deg)', offset: 0.24 },
      { transform: 'translate(0, 0) rotate(0deg)', offset: 0.43 },
      { transform: 'translate(5px, -15px) rotate(9deg)', offset: 0.68 },
      { transform: 'translate(0, 0) rotate(0deg)' },
    ],
  },
  bow: {
    duration: 850,
    frames: [
      { transform: 'scale(1) rotate(0deg)' },
      { transform: 'translateY(6px) scale(1.03, .9) rotate(-4deg)', offset: 0.42 },
      { transform: 'translateY(6px) scale(1.03, .9) rotate(-4deg)', offset: 0.62 },
      { transform: 'scale(1) rotate(0deg)' },
    ],
  },
  pet: {
    duration: 1100,
    frames: [
      { transform: 'scale(1) rotate(0deg)' },
      { transform: 'translateY(4px) scale(1.03, .95) rotate(-5deg)', offset: 0.22 },
      { transform: 'translateY(3px) scale(1.02, .96) rotate(5deg)', offset: 0.45 },
      { transform: 'translateY(4px) scale(1.03, .95) rotate(-4deg)', offset: 0.68 },
      { transform: 'scale(1) rotate(0deg)' },
    ],
  },
  celebrate: {
    duration: 1150,
    frames: [
      { transform: 'translateY(0) scale(1)' },
      { transform: 'translateY(3px) scale(1.08, .92)', offset: 0.12 },
      { transform: 'translate(-4px, -22px) rotate(-10deg) scale(1.04)', offset: 0.34 },
      { transform: 'translateY(0) scale(1.05, .95)', offset: 0.54 },
      { transform: 'translate(4px, -14px) rotate(9deg)', offset: 0.75 },
      { transform: 'translateY(0) scale(1)' },
    ],
  },
};

export function advanceTap(previous: TapMemory | null, now: number): TapMemory {
  return {
    count: previous && now >= previous.at && now - previous.at <= 900 ? previous.count + 1 : 1,
    at: now,
  };
}

export function reactionFor(
  id: string,
  step: number,
  kind: 'tap' | 'pet' = 'tap',
  taps = 1,
): ReactionPlan {
  const profile = Object.hasOwn(personalities, id) ? personalities[id] : personalities.atri;
  const celebration = kind === 'tap' && taps >= 3 && taps % 3 === 0;
  const index = Number.isFinite(step) ? Math.max(0, Math.trunc(step)) : 0;
  const name =
    kind === 'pet'
      ? 'pet'
      : celebration
        ? 'celebrate'
        : profile.sequence[index % profile.sequence.length];
  return {
    name,
    ...motions[name],
    symbols: kind === 'pet' ? ['♡', '♥'] : celebration ? ['♡', '✦', '✧'] : profile.symbols,
    particles: celebration ? 12 : kind === 'pet' ? 9 : 6,
    tone: kind === 'pet' ? 'rose' : profile.tone,
    line: kind === 'pet' ? profile.pet : celebration ? profile.celebrate : undefined,
  };
}
