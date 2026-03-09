import JSZip from 'jszip';
import { Buffer } from 'buffer';
import type { WorkoutFileParseResult } from '../workoutFileParser';
import { getExtension } from '../workoutFileParser';
import { parseGPXFile } from '../gpxParser';
import { parseTCXFile } from './tcxParser';
import { parseFITFile } from './fitParser';
import { parseCSVFile } from './csvParser';

export interface ZipParseResult {
  workouts: WorkoutFileParseResult[];
  errors: { filename: string; error: string }[];
}

const SUPPORTED_EXTENSIONS = new Set(['.gpx', '.tcx', '.fit', '.csv']);

/** Parse a ZIP archive from base64 data, extracting all supported workout files */
export async function parseZIPFile(base64Data: string): Promise<ZipParseResult> {
  const buffer = Buffer.from(base64Data, 'base64');
  const zip = await JSZip.loadAsync(buffer);

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
        const data = await entry.file.async('base64');
        const result = await parseFITFile(data);
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
