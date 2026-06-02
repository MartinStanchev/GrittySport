import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config.mjs';

// Filesystem-backed post queue. Each post is a folder
// content/posts/<id>/ holding post.json + its asset (asset.png | asset.mp4).
// No DB — the folder structure IS the queue, so it's trivially browsable.

export const POST_STATUSES = ['draft', 'ready', 'posted'];

export function postDir(id) {
  return path.join(config.postsDir, id);
}

export function readPost(id) {
  return JSON.parse(fs.readFileSync(path.join(postDir(id), 'post.json'), 'utf8'));
}

export function writePost(post) {
  const dir = postDir(post.id);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'post.json'), JSON.stringify(post, null, 2) + '\n');
  return post;
}

export function listPosts() {
  if (!fs.existsSync(config.postsDir)) return [];
  return fs
    .readdirSync(config.postsDir)
    .filter((d) => fs.existsSync(path.join(config.postsDir, d, 'post.json')))
    .map((d) => readPost(d))
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

// Only caption / platforms / status / notes are user-editable from the dashboard.
export function updatePost(id, patch) {
  const post = readPost(id);
  const allowed = ['caption', 'platforms', 'status', 'notes'];
  for (const key of allowed) {
    if (key in patch) post[key] = patch[key];
  }
  return writePost(post);
}

export function deletePost(id) {
  fs.rmSync(postDir(id), { recursive: true, force: true });
}

// Stable, sortable, human-readable id: YYYYMMDDHHMM-<scene>-<format> (+ -N on clash).
export function makePostId(sceneId, format) {
  const ts = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 12);
  const base = `${ts}-${sceneId}-${format}`;
  let id = base;
  let n = 2;
  while (fs.existsSync(postDir(id))) id = `${base}-${n++}`;
  return id;
}
