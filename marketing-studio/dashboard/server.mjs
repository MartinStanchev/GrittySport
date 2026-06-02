import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from '../config.mjs';
import { listPosts, readPost, updatePost, deletePost, postDir, POST_STATUSES } from '../lib/queue.mjs';
import { generatePost, FORMAT_NAMES } from '../generate.mjs';
import { buildReel, REEL_TEMPLATES } from '../reel.mjs';
import { fetchSceneList } from '../lib/scenes.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const CONTENT_TYPES = { '.png': 'image/png', '.mp4': 'video/mp4', '.html': 'text/html; charset=utf-8' };

let sceneCache = null; // lazily fetched scene registry

function sendJson(res, status, body) {
  const data = JSON.stringify(body);
  res.writeHead(status, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) });
  res.end(data);
}

async function readBody(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString());
}

// Serve a file with content-type + HTTP range support (so video seeks work).
function serveFile(req, res, filePath) {
  if (!fs.existsSync(filePath)) return sendJson(res, 404, { error: 'not found' });
  const stat = fs.statSync(filePath);
  const type = CONTENT_TYPES[path.extname(filePath)] || 'application/octet-stream';
  const range = req.headers.range;
  if (range) {
    const [s, e] = range.replace(/bytes=/, '').split('-');
    const start = Number(s);
    const end = e ? Number(e) : stat.size - 1;
    res.writeHead(206, {
      'Content-Range': `bytes ${start}-${end}/${stat.size}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': end - start + 1,
      'Content-Type': type,
    });
    fs.createReadStream(filePath, { start, end }).pipe(res);
  } else {
    res.writeHead(200, { 'Content-Length': stat.size, 'Content-Type': type, 'Accept-Ranges': 'bytes' });
    fs.createReadStream(filePath).pipe(res);
  }
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const { pathname } = url;

    if (req.method === 'GET' && pathname === '/') {
      return serveFile(req, res, path.join(here, 'index.html'));
    }

    if (req.method === 'GET' && pathname === '/api/posts') {
      return sendJson(res, 200, {
        posts: listPosts(),
        statuses: POST_STATUSES,
        formats: FORMAT_NAMES,
        reelTemplates: Object.keys(REEL_TEMPLATES),
      });
    }

    if (req.method === 'GET' && pathname === '/api/scenes') {
      if (!sceneCache) sceneCache = await fetchSceneList();
      return sendJson(res, 200, { scenes: sceneCache });
    }

    if (req.method === 'POST' && pathname === '/api/generate') {
      const body = await readBody(req);
      const post = await generatePost(body);
      return sendJson(res, 201, { post });
    }

    if (req.method === 'POST' && pathname === '/api/reel') {
      const body = await readBody(req);
      const post = await buildReel(body);
      return sendJson(res, 201, { post });
    }

    const assetMatch = pathname.match(/^\/api\/posts\/([^/]+)\/asset$/);
    if (req.method === 'GET' && assetMatch) {
      const id = decodeURIComponent(assetMatch[1]);
      let post;
      try {
        post = readPost(id);
      } catch {
        return sendJson(res, 404, { error: 'unknown post' });
      }
      return serveFile(req, res, path.join(postDir(id), post.asset));
    }

    const postMatch = pathname.match(/^\/api\/posts\/([^/]+)$/);
    if (postMatch) {
      const id = decodeURIComponent(postMatch[1]);
      if (req.method === 'PATCH') {
        const body = await readBody(req);
        return sendJson(res, 200, { post: updatePost(id, body) });
      }
      if (req.method === 'DELETE') {
        deletePost(id);
        return sendJson(res, 200, { ok: true });
      }
    }

    sendJson(res, 404, { error: 'not found' });
  } catch (err) {
    sendJson(res, 500, { error: err.message });
  }
});

server.listen(config.dashboardPort, () => {
  console.log(`🎬 Marketing studio dashboard → http://localhost:${config.dashboardPort}`);
  console.log(`   (scene picker + generation need the Expo web server at ${config.baseUrl})`);
});
