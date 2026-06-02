import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { probeDurationSec } from './lib/ffmpeg.mjs';
import { makePostId, postDir, readPost, writePost } from './lib/queue.mjs';
import { renderReel } from './reels/render.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const FPS = 30;
const TRANSITION_FRAMES = 16;
const DEFAULT_IMAGE_SECONDS = { hero: 8, story: 4.5 };

export const REEL_TEMPLATES = { hero: 'SingleHero', story: 'StoryReel' };

function mediaTypeFor(file, explicit) {
  if (explicit) return explicit;
  return path.extname(file).toLowerCase() === '.mp4' ? 'video' : 'image';
}

// Resolve a beat to a concrete asset path + media type, from a queued post id or
// a direct file path.
function resolveBeatSource(beat) {
  if (beat.postId) {
    const post = readPost(beat.postId);
    // A reel is a finished, already-framed output — framing it again gives a
    // phone-in-phone. Beats must be raw scene assets.
    if (post.format?.endsWith('-reel')) {
      throw new Error(`"${beat.postId}" is already a reel; reels can't be used as beats (would nest phone frames)`);
    }
    return { srcPath: path.join(postDir(beat.postId), post.asset), mediaType: post.mediaType };
  }
  if (beat.src) return { srcPath: beat.src, mediaType: mediaTypeFor(beat.src, beat.mediaType) };
  throw new Error('each beat needs a postId or src');
}

// Build a reel (hero or story) from queued posts/assets and add it to the queue.
export async function buildReel({ template = 'story', beats = [], headline = '', theme = 'dark', transition = 'slide', motion = 'float' } = {}) {
  const compositionId = REEL_TEMPLATES[template];
  if (!compositionId) throw new Error(`Unknown template "${template}" (${Object.keys(REEL_TEMPLATES).join(' | ')})`);
  if (!beats.length) throw new Error('a reel needs at least one beat');

  const id = makePostId(template, 'reel');
  const stagedDir = path.join(here, 'reels', 'public', 'staged', id);
  fs.mkdirSync(stagedDir, { recursive: true });

  try {
    // Stage each beat's asset into the Remotion public dir + compute its timing.
    const staged = [];
    for (let i = 0; i < beats.length; i++) {
      const { srcPath, mediaType } = resolveBeatSource(beats[i]);
      const ext = path.extname(srcPath) || (mediaType === 'video' ? '.mp4' : '.png');
      const fileName = `beat-${i}${ext}`;
      fs.copyFileSync(srcPath, path.join(stagedDir, fileName));

      const speed = mediaType === 'video' ? Number(beats[i].speed) || 1 : 1;
      // Video beats default to playing the full clip at the chosen speed; stills
      // get a readable default. An explicit `seconds` overrides either.
      const seconds =
        beats[i].seconds != null
          ? Number(beats[i].seconds)
          : mediaType === 'video'
            ? (await probeDurationSec(srcPath)) / speed
            : DEFAULT_IMAGE_SECONDS[template] ?? 4;

      staged.push({
        media: { src: `staged/${id}/${fileName}`, mediaType, ...(mediaType === 'video' ? { playbackRate: speed } : {}) },
        caption: beats[i].caption ?? '',
        durationInFrames: Math.max(1, Math.round(seconds * FPS)),
      });
    }

    const inputProps =
      template === 'hero'
        ? { media: staged[0].media, headline, theme, durationInFrames: staged[0].durationInFrames, motion }
        : { theme, transitionFrames: TRANSITION_FRAMES, transition, motion, beats: staged };

    const outPath = path.join(postDir(id), 'asset.mp4');
    fs.mkdirSync(postDir(id), { recursive: true });
    await renderReel({ compositionId, inputProps, outPath });

    return writePost({
      id,
      createdAt: new Date().toISOString(),
      format: `${template}-reel`,
      mediaType: 'video',
      asset: 'asset.mp4',
      caption: headline || beats[0].caption || '',
      platforms: [],
      status: 'draft',
      notes: '',
      theme,
      sourcePosts: beats.map((b) => b.postId).filter(Boolean),
    });
  } finally {
    fs.rmSync(stagedDir, { recursive: true, force: true });
  }
}

// CLI: node reel.mjs --template story --theme dark --headline "..." \
//        --beat <postId>:<caption> --beat <postId>:<caption> ...
function parseArgs(argv) {
  const args = { template: 'story', theme: 'dark', headline: '', transition: 'slide', motion: 'float', beats: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--template') args.template = argv[++i];
    else if (a === '--theme') args.theme = argv[++i];
    else if (a === '--headline') args.headline = argv[++i];
    else if (a === '--transition') args.transition = argv[++i];
    else if (a === '--motion') args.motion = argv[++i];
    else if (a === '--beat') {
      const raw = argv[++i];
      const idx = raw.indexOf(':');
      args.beats.push(idx === -1 ? { postId: raw } : { postId: raw.slice(0, idx), caption: raw.slice(idx + 1) });
    }
  }
  return args;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const args = parseArgs(process.argv.slice(2));
  if (!args.beats.length) {
    console.error('Usage: node reel.mjs --template story|hero [--theme light|dark] [--headline "..."] --beat <postId>[:caption] [--beat ...]');
    process.exit(1);
  }
  buildReel(args)
    .then((post) => console.log(`✅ built ${post.format} "${post.id}" → ${postDir(post.id)}/asset.mp4`))
    .catch((err) => {
      console.error('❌', err.message);
      process.exit(1);
    });
}
