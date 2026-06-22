import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import QRCode from 'qrcode';
import { probeDurationSec } from './lib/ffmpeg.mjs';
import { makePostId, postDir, readPost, writePost } from './lib/queue.mjs';
import { renderReel } from './reels/render.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const FPS = 30;
const TRANSITION_FRAMES = 16;
const DEFAULT_IMAGE_SECONDS = { hero: 8, story: 4.5 };
// Card beats (no underlying clip) get a readable default hold.
const DEFAULT_CARD_SECONDS = { hook: 2.6, stat: 3, cta: 4.5, split: 4 };

// `story` first so it's the dashboard's default — the reel builder is mainly used
// to stitch multiple beats, and `hero` is a deliberately single-scene template.
export const REEL_TEMPLATES = { story: 'StoryReel', hero: 'SingleHero' };

function mediaTypeFor(file, explicit) {
  if (explicit) return explicit;
  return path.extname(file).toLowerCase() === '.mp4' ? 'video' : 'image';
}

const framesFor = (seconds) => Math.max(1, Math.round(seconds * FPS));
const omitUndefined = (obj) => Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined));

// Resolve a media source (queued post id or direct file path) to its on-disk
// asset (for probing) + identity (for building a preview URL).
function resolveSource({ postId, src, mediaType }) {
  if (postId) {
    const post = readPost(postId);
    // A reel is a finished, already-framed output — framing it again gives a
    // phone-in-phone. Beats must be raw scene assets.
    if (post.format?.endsWith('-reel')) {
      throw new Error(`"${postId}" is already a reel; reels can't be used as beats (would nest phone frames)`);
    }
    return { srcPath: path.join(postDir(postId), post.asset), mediaType: post.mediaType, postId, version: post.updatedAt || post.createdAt || '' };
  }
  if (src) return { srcPath: src, mediaType: mediaTypeFor(src, mediaType) };
  throw new Error('a media beat needs a postId or src');
}

// Media resolvers decide how a beat's asset becomes a `media.src`:
//  • stage  — copy into the Remotion public/staged dir (for an actual render)
//  • url    — point at the dashboard's asset endpoint (for the live Player preview)
// playbackRate is NOT set here — buildBeat derives it from the final on-screen
// window so the whole clip always plays across the beat (no freeze, no cut-off).
function stageResolver({ stagedDir, id }) {
  return (spec, name) => {
    const { srcPath, mediaType } = resolveSource(spec);
    const ext = path.extname(srcPath) || (mediaType === 'video' ? '.mp4' : '.png');
    const fileName = `${name}${ext}`;
    fs.copyFileSync(srcPath, path.join(stagedDir, fileName));
    return { media: { src: `staged/${id}/${fileName}`, mediaType }, mediaType, srcPath };
  };
}

function urlResolver(spec) {
  const { srcPath, mediaType, postId, version } = resolveSource(spec);
  if (!postId) throw new Error('live preview needs queued posts (postId) for media / before-after beats');
  const url = `/api/posts/${encodeURIComponent(postId)}/asset?v=${encodeURIComponent(version)}`;
  return { media: { src: url, mediaType }, mediaType, srcPath };
}

// Resolve one authoring beat into the concrete beat object the composition renders.
async function buildBeat(beat, i, { template, resolve }) {
  const kind = beat.kind || 'media';

  if (kind === 'media') {
    const { media, mediaType, srcPath } = resolve(beat, `beat-${i}`);
    let seconds;
    if (mediaType === 'video') {
      // Two independent knobs:
      //   • speed    — how fast the clip plays; sets the default on-screen window.
      //   • duration — the on-screen window (how long the beat is shown).
      // The whole clip is always time-scaled to the chosen window, so it never
      // freezes mid-clip (window too long) or gets cut off (window too short).
      const probe = await probeDurationSec(srcPath);
      seconds = beat.seconds != null ? Number(beat.seconds) : probe / (Number(beat.speed) || 1);
      media.playbackRate = probe / seconds;
    } else {
      seconds = beat.seconds != null ? Number(beat.seconds) : DEFAULT_IMAGE_SECONDS[template] ?? 4;
    }
    return omitUndefined({ kind, media, caption: beat.caption || undefined, taps: beat.taps?.length ? beat.taps : undefined, durationInFrames: framesFor(seconds) });
  }

  const durationInFrames = framesFor(beat.seconds != null ? Number(beat.seconds) : DEFAULT_CARD_SECONDS[kind] ?? 3);

  switch (kind) {
    case 'hook':
      return omitUndefined({ kind, text: beat.text || '', kicker: beat.kicker || undefined, instant: beat.instant || undefined, durationInFrames });
    case 'stat':
      return omitUndefined({ kind, value: Number(beat.value) || 0, label: beat.label || '', prefix: beat.prefix || undefined, suffix: beat.suffix || undefined, durationInFrames });
    case 'cta': {
      const qrDataUrl = beat.qr ? await QRCode.toDataURL(beat.qr, { margin: 1, width: 420 }) : undefined;
      // badges defaults to both stores when omitted, but an explicit [] (pre-launch
      // wishlist CTA) must be preserved so no store badges render.
      const badges = Array.isArray(beat.badges) ? beat.badges : undefined;
      return omitUndefined({ kind, headline: beat.headline || '', sub: beat.sub || undefined, badges, pill: beat.pill || undefined, qrDataUrl, durationInFrames });
    }
    case 'split': {
      const left = resolve({ postId: beat.leftPostId, src: beat.leftSrc, mediaType: beat.leftMediaType }, `beat-${i}-l`).media;
      const right = resolve({ postId: beat.rightPostId, src: beat.rightSrc, mediaType: beat.rightMediaType }, `beat-${i}-r`).media;
      return omitUndefined({ kind, left, right, leftLabel: beat.leftLabel || undefined, rightLabel: beat.rightLabel || undefined, caption: beat.caption || undefined, durationInFrames });
    }
    default:
      throw new Error(`unknown beat kind "${kind}"`);
  }
}

// Snap each beat to a whole number of musical beats so cuts land on the beat.
function applyBpm(built, bpm) {
  if (!bpm) return built;
  const beatFrames = Math.max(1, Math.round((FPS * 60) / Number(bpm)));
  return built.map((b) => ({ ...b, durationInFrames: Math.max(beatFrames, Math.round(b.durationInFrames / beatFrames) * beatFrames) }));
}

function storyDuration(built, transition) {
  const sum = built.reduce((acc, b) => acc + b.durationInFrames, 0);
  const overlaps = transition === 'none' ? 0 : Math.max(0, built.length - 1) * TRANSITION_FRAMES;
  return Math.max(1, sum - overlaps);
}

// Audio lives in reels/public/audio/<file>; staticFile for render, served by the
// dashboard for preview.
function resolveMusic(music, mode) {
  if (!music?.file) return undefined;
  const src = mode === 'url' ? `/api/audio/${encodeURIComponent(music.file)}` : `audio/${music.file}`;
  return omitUndefined({ src, volume: music.volume != null ? Number(music.volume) : undefined, startFromSec: music.startFromSec != null ? Number(music.startFromSec) : undefined });
}

// Shared core: validate + resolve beats + assemble inputProps. `resolve` is the
// media strategy (stage for render, url for preview); no rendering happens here.
async function prepareReel({ template, beats, headline, theme, transition, motion, captionPreset, safeZone, music, bpm, resolve, mode }) {
  const compositionId = REEL_TEMPLATES[template];
  if (!compositionId) throw new Error(`Unknown template "${template}" (${Object.keys(REEL_TEMPLATES).join(' | ')})`);
  if (!beats.length) throw new Error('a reel needs at least one beat');
  if (template === 'hero' && beats.length > 1) {
    throw new Error(`Single Hero shows one scene, but you added ${beats.length} beats. Use the Story template to stitch them together.`);
  }
  if (template === 'hero' && beats[0].kind && beats[0].kind !== 'media') {
    throw new Error('Single Hero only supports a media (screenshot/clip) beat — use the Story template for card beats.');
  }

  const built = [];
  for (let i = 0; i < beats.length; i++) built.push(await buildBeat(beats[i], i, { template, resolve }));
  const timed = applyBpm(built, bpm);
  const resolvedMusic = resolveMusic(music, mode);

  const inputProps =
    template === 'hero'
      ? { media: timed[0].media, headline, theme, durationInFrames: timed[0].durationInFrames, motion, safeZone, showSafeZones: false, music: resolvedMusic }
      : { theme, transitionFrames: TRANSITION_FRAMES, transition, motion, captionPreset, safeZone, showSafeZones: false, beats: timed, music: resolvedMusic };

  const durationInFrames = template === 'hero' ? timed[0].durationInFrames : storyDuration(timed, transition);
  return { compositionId, inputProps, durationInFrames };
}

// The authoring fields to persist so a reel can be reopened in the builder and
// re-rendered (keeps the source URL for cta QR, postIds for media/split, etc.).
function recipeBeat(beat) {
  return omitUndefined({ ...beat, kind: beat.kind || 'media' });
}

function firstCaption(beats) {
  for (const b of beats) {
    const c = b.caption || b.text || b.headline;
    if (c) return c;
  }
  return '';
}

// PostIds referenced by any beat (media + split sides) — tracked on the post.
function sourcePostIds(beats) {
  return beats.flatMap((b) => [b.postId, b.leftPostId, b.rightPostId]).filter(Boolean);
}

// Resolve a reel into composition + inputProps + duration WITHOUT rendering, with
// asset URLs the dashboard can serve — for the live Player preview.
export async function resolveReelPreview({ template = 'story', beats = [], headline = '', theme = 'dark', transition = 'slide', motion = 'float', captionPreset = 'clean', safeZone = 'none', music, bpm } = {}) {
  const { compositionId, inputProps, durationInFrames } = await prepareReel({
    template, beats, headline, theme, transition, motion, captionPreset, safeZone, music, bpm, resolve: urlResolver, mode: 'url',
  });
  return { compositionId, inputProps, durationInFrames, fps: FPS, width: 1080, height: 1920 };
}

// Build a reel (hero or story) from queued posts/assets and add it to the queue.
// Passing `id` of an existing reel re-renders it in place (edit) — same folder,
// preserving the post's caption / platforms / status / notes — instead of making
// a new post.
export async function buildReel({ id: editId, template = 'story', beats = [], headline = '', theme = 'dark', transition = 'slide', motion = 'float', captionPreset = 'clean', safeZone = 'none', music, bpm } = {}) {
  const existing = editId ? readPost(editId) : null;
  if (existing && !existing.format?.endsWith('-reel')) throw new Error(`"${editId}" is not a reel`);
  const id = editId || makePostId(template, 'reel');
  const stagedDir = path.join(here, 'reels', 'public', 'staged', id);
  fs.mkdirSync(stagedDir, { recursive: true });

  try {
    const { compositionId, inputProps } = await prepareReel({
      template, beats, headline, theme, transition, motion, captionPreset, safeZone, music, bpm, resolve: stageResolver({ stagedDir, id }), mode: 'stage',
    });

    const outPath = path.join(postDir(id), 'asset.mp4');
    fs.mkdirSync(postDir(id), { recursive: true });
    await renderReel({ compositionId, inputProps, outPath });

    const recipe = omitUndefined({ template, theme, transition, motion, captionPreset, safeZone, headline, music, bpm, beats: beats.map(recipeBeat) });

    const now = new Date().toISOString();
    return writePost({
      id,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      format: `${template}-reel`,
      mediaType: 'video',
      asset: 'asset.mp4',
      caption: existing?.caption ?? (headline || firstCaption(beats)),
      platforms: existing?.platforms ?? [],
      status: existing?.status ?? 'draft',
      notes: existing?.notes ?? '',
      theme,
      sourcePosts: sourcePostIds(beats),
      reel: recipe,
    });
  } finally {
    fs.rmSync(stagedDir, { recursive: true, force: true });
  }
}

// A/B test the hook line: build one reel per alternate hook line (everything else
// held constant). Requires a hook beat. Each variant is its own queue post.
export async function buildReelVariants({ hookVariants = [], ...base } = {}) {
  const beats = base.beats || [];
  const idx = beats.findIndex((b) => (b.kind || 'media') === 'hook');
  if (idx < 0) throw new Error('add a hook beat to A/B test its line');
  const lines = hookVariants.map((s) => String(s).trim()).filter(Boolean);
  if (!lines.length) throw new Error('add at least one hook line to test');

  const posts = [];
  for (const text of lines) {
    const variantBeats = beats.map((b, i) => (i === idx ? { ...b, text } : b));
    posts.push(await buildReel({ ...base, id: undefined, beats: variantBeats }));
  }
  return posts;
}

// CLI: node reel.mjs --template story --theme dark --headline "..." \
//        --beat <postId>:<caption> --beat <postId>:<caption> ...
// (CLI only builds media beats; card beats are added from the dashboard.)
function parseArgs(argv) {
  const args = { template: 'story', theme: 'dark', headline: '', transition: 'slide', motion: 'float', captionPreset: 'clean', safeZone: 'none', beats: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--id') args.id = argv[++i];
    else if (a === '--template') args.template = argv[++i];
    else if (a === '--theme') args.theme = argv[++i];
    else if (a === '--headline') args.headline = argv[++i];
    else if (a === '--transition') args.transition = argv[++i];
    else if (a === '--motion') args.motion = argv[++i];
    else if (a === '--caption-preset') args.captionPreset = argv[++i];
    else if (a === '--safe-zone') args.safeZone = argv[++i];
    else if (a === '--bpm') args.bpm = Number(argv[++i]);
    else if (a === '--music') args.music = { file: argv[++i] };
    else if (a === '--beat') {
      const raw = argv[++i];
      const idx = raw.indexOf(':');
      args.beats.push(idx === -1 ? { kind: 'media', postId: raw } : { kind: 'media', postId: raw.slice(0, idx), caption: raw.slice(idx + 1) });
    }
  }
  return args;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const args = parseArgs(process.argv.slice(2));
  if (!args.beats.length) {
    console.error('Usage: node reel.mjs --template story|hero [--theme light|dark] [--headline "..."] [--bpm 120] [--music track.mp3] --beat <postId>[:caption] [--beat ...]');
    process.exit(1);
  }
  buildReel(args)
    .then((post) => console.log(`✅ built ${post.format} "${post.id}" → ${postDir(post.id)}/asset.mp4`))
    .catch((err) => {
      console.error('❌', err.message);
      process.exit(1);
    });
}
