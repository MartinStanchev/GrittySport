import ffmpegPath from 'ffmpeg-static';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { config } from '../config.mjs';

export function runFfmpeg(args) {
  return new Promise((resolve, reject) => {
    const proc = spawn(ffmpegPath, ['-y', '-hide_banner', '-loglevel', 'error', ...args]);
    let stderr = '';
    proc.stderr.on('data', (d) => {
      stderr += d;
    });
    proc.on('error', reject);
    proc.on('close', (code) =>
      code === 0 ? resolve() : reject(new Error(`ffmpeg exited ${code}:\n${stderr.slice(-2000)}`)),
    );
  });
}

export function readPngSize(file) {
  const b = fs.readFileSync(file);
  return { width: b.readUInt32BE(16), height: b.readUInt32BE(20) };
}

// Probe a media file's duration in seconds (parses ffmpeg's stderr banner).
export function probeDurationSec(file) {
  return new Promise((resolve, reject) => {
    const proc = spawn(ffmpegPath, ['-hide_banner', '-i', file]);
    let stderr = '';
    proc.stderr.on('data', (d) => {
      stderr += d;
    });
    proc.on('error', reject);
    proc.on('close', () => {
      const m = stderr.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/);
      if (!m) return reject(new Error(`could not read duration of ${file}`));
      resolve(Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]));
    });
  });
}

// Pan a tall still image down through a window → MP4. The image is scaled to the
// target width first; it must end up taller than the frame. The window defaults
// to the social 9:16 target, but `width`/`height` can override it (e.g. a
// device-aspect window so the clip fills a phone frame in a reel at real size).
export async function encodeScroll({ input, outPath, durationSec = 8, width: outWidth, height: outHeight }) {
  const { fps } = config.video;
  const width = outWidth ?? config.video.width;
  const height = outHeight ?? config.video.height;
  const src = readPngSize(input);
  const scaledHeight = Math.round((src.height * width) / src.width);
  if (scaledHeight <= height) {
    throw new Error(
      `Scene content is too short to scroll (${width}x${scaledHeight} after scaling; need height > ${height}). Use a still instead.`,
    );
  }
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  const vf = `scale=${width}:-2,crop=${width}:${height}:0:(ih-oh)*t/${durationSec},format=yuv420p`;
  await runFfmpeg([
    '-loop', '1',
    '-i', input,
    '-t', String(durationSec),
    '-vf', vf,
    '-r', String(fps),
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '20',
    '-movflags', '+faststart',
    outPath,
  ]);
}

// Assemble a sequence of still frames, each held for a given duration, into a
// constant-fps MP4. Frames are scaled to `targetWidth` keeping aspect (no pad),
// so a phone screenshot stays its natural tall shape. Used by chat-replay.
export async function encodeFrameSequence({ frames, outPath, fps = config.video.fps, targetWidth = config.video.width }) {
  if (!frames.length) throw new Error('no frames to encode');
  fs.mkdirSync(path.dirname(outPath), { recursive: true });

  const lines = [];
  for (const f of frames) {
    lines.push(`file '${f.path}'`);
    lines.push(`duration ${f.durationSec.toFixed(3)}`);
  }
  // The concat demuxer ignores the final entry's duration unless the last file
  // is repeated, so append it once more.
  lines.push(`file '${frames[frames.length - 1].path}'`);

  const listPath = path.join(os.tmpdir(), `marketing-replay-${Date.now()}.txt`);
  fs.writeFileSync(listPath, lines.join('\n') + '\n');
  try {
    await runFfmpeg([
      '-f', 'concat', '-safe', '0', '-i', listPath,
      '-vf', `scale=${targetWidth}:-2,format=yuv420p`,
      '-r', String(fps),
      '-c:v', 'libx264', '-preset', 'medium', '-crf', '20',
      '-movflags', '+faststart',
      outPath,
    ]);
  } finally {
    if (fs.existsSync(listPath)) fs.unlinkSync(listPath);
  }
}
