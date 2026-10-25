import JSZip from 'jszip';
import type { WorkoutFileParseResult } from '../workoutFileTypes';
import { getExtension } from '../workoutFileTypes';
import { parseGPXFile } from '../gpxParser';
import { parseTCXFile } from './tcxParser';
import { parseFITFile } from './fitParser';
import { parseCSVFile } from './csvParser';

export interface ZipParseResult {
  workouts: WorkoutFileParseResult[];
  errors: { filename: string; error: string }[];
}

const SUPPORTED_EXTENSIONS = new Set(['.gpx', '.tcx', '.fit', '.csv']);

/** Parse a ZIP archive from its raw bytes, extracting all supported workout files */
export async function parseZIPFile(data: Uint8Array): Promise<ZipParseResult> {
  const zip = await JSZip.loadAsync(data);

  // Collect all supported files at any depth
  const entries: { name: string; ext: string; file: JSZip.JSZipObject }[] = [];
  zip.forEach((relativePath, file) => {
    if (file.dir) return;
    const ext = getExtension(relativePath);
    if (SUPPORTED_EXTENSIONS.has(ext)) {
      entries.push({ name: relativePath, ext, file });
    }
  });

  // Parse all files in parallel
  const results = await Promise.allSettled(
    entries.map(async (entry) => {
      const basename = entry.name.split('/').pop() ?? entry.name;

      if (entry.ext === '.fit') {
        const result = await parseFITFile(await entry.file.async('uint8array'));
        result.name = basename.replace(/\.[^.]+$/, '');
        return result;
      }

      const text = await entry.file.async('string');
      let result: WorkoutFileParseResult;

      switch (entry.ext) {
        case '.gpx':
          result = parseGPXFile(text);
          break;
        case '.tcx':
          result = parseTCXFile(text);
          break;
        case '.csv':
          result = parseCSVFile(text, basename);
          break;
        default:
          throw new Error(`Unsupported format: ${entry.ext}`);
      }

      return result;
    }),
  );

  const workouts: WorkoutFileParseResult[] = [];
  const errors: { filename: string; error: string }[] = [];

  results.forEach((result, i) => {
    if (result.status === 'fulfilled') {
      workouts.push(result.value);
    } else {
      errors.push({ filename: entries[i].name, error: result.reason?.message ?? 'Parse error' });
    }
  });

  return { workouts, errors };
}
