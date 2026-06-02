import path from 'node:path';
import { captureStill } from './capture/still.mjs';
import { captureScroll } from './video/scroll.mjs';
import { captureChatReplay } from './video/chat-replay.mjs';
import { readPngSize } from './lib/ffmpeg.mjs';
import { makePostId, postDir, writePost } from './lib/queue.mjs';
import { isMain, parseSceneArgs } from './lib/cli.mjs';

// Format → capture fn + asset metadata.
const FORMATS = {
  still: { fn: captureStill, ext: 'png', mediaType: 'image' },
  'chat-replay': { fn: captureChatReplay, ext: 'mp4', mediaType: 'video' },
  scroll: { fn: captureScroll, ext: 'mp4', mediaType: 'video' },
};

export const FORMAT_NAMES = Object.keys(FORMATS);

// Render an asset for a scene and create a reviewable post in the queue.
export async function generatePost({ sceneId, format = 'still', theme = 'light', caption = '', platforms = [], baseUrl } = {}) {
  if (!sceneId) throw new Error('sceneId is required');
  const spec = FORMATS[format];
  if (!spec) throw new Error(`Unknown format "${format}" (${FORMAT_NAMES.join(' | ')})`);

  const id = makePostId(sceneId, format);
  const assetName = `asset.${spec.ext}`;
  const outPath = path.join(postDir(id), assetName);

  const { out } = await spec.fn({ sceneId, theme, baseUrl, outPath });

  const post = {
    id,
    createdAt: new Date().toISOString(),
    sceneId,
    format,
    theme,
    asset: assetName,
    mediaType: spec.mediaType,
    caption,
    platforms,
    status: 'draft',
    notes: '',
  };
  if (spec.mediaType === 'image') {
    const { width, height } = readPngSize(out);
    post.width = width;
    post.height = height;
  }
  return writePost(post);
}

if (isMain(import.meta.url)) {
  const args = parseSceneArgs(process.argv.slice(2), {
    '--format': { key: 'format' },
    '--caption': { key: 'caption' },
    '--platforms': { key: 'platforms', type: (s) => s.split(',').map((p) => p.trim()).filter(Boolean) },
  });
  if (!args.sceneId) {
    console.error('Usage: node generate.mjs <sceneId> --format still|chat-replay|scroll [--theme light|dark] [--caption "..."] [--platforms instagram,tiktok] [--url http://localhost:8081]');
    process.exit(1);
  }
  generatePost(args)
    .then((post) => console.log(`✅ created post "${post.id}" (${post.format}, ${post.status}) → ${postDir(post.id)}`))
    .catch((err) => {
      console.error('❌', err.message);
      process.exit(1);
    });
}
