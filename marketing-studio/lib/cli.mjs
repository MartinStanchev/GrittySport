import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Shared CLI arg parsing for the capture scripts. Handles the common flags
// (--theme, --out, --url) + a positional sceneId; `extraFlags` adds per-script
// options, e.g. { '--duration': { key: 'durationSec', type: Number } }.
export function parseSceneArgs(argv, extraFlags = {}) {
  const args = { theme: 'light' };
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--theme') args.theme = argv[++i];
    else if (a === '--out') args.outPath = argv[++i];
    else if (a === '--url') args.baseUrl = argv[++i];
    else if (extraFlags[a]) {
      const f = extraFlags[a];
      args[f.key] = f.type ? f.type(argv[++i]) : argv[++i];
    } else positional.push(a);
  }
  args.sceneId = positional[0];
  return args;
}

// True when the given module URL is the script Node was invoked with.
export function isMain(importMetaUrl) {
  return Boolean(process.argv[1]) && fileURLToPath(importMetaUrl) === path.resolve(process.argv[1]);
}
