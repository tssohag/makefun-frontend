// Packages this make.fun frontend entry for grading.
//
//   node main.ts                                    writes to /output
//   MAKEFUN_OUTPUT_DIR=out node main.ts             writes to ./out
//
// Steps: (1) inspect app/ and screenshots/ beside this file and refuse anything the scorer would refuse, naming every
// problem at once; (2) mirror both folders into the output directory in sorted order; (3) write dossier.json with the
// vendored make.fun library (the gate rebuilds it with the same options and compares bytes); (4) print a summary.
// Node 22, standard library only, no build step.

import { lstatSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, extname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-frontend.ts';

const KiB = 1024;
const MiB = 1024 * KiB;

const LIMITS = {
  indexHtmlBytes: 1 * MiB,
  appEntries: 993,
  appBytes: 16 * MiB,
  shotCount: 3,
  shotBytes: 256 * KiB,
  shotLongSideMax: 1280,
  shotShortSideMin: 360,
} as const;

const DOSSIER_OPTIONS = {
  text_max_bytes: 163840,
  screenshots: { max: LIMITS.shotCount, max_bytes: LIMITS.shotBytes },
  app_max_files: LIMITS.appEntries,
  app_max_bytes: LIMITS.appBytes,
};

const SHOT_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png']);

type ImageKind = 'png' | 'jpeg';
interface Dimensions { width: number; height: number }
interface Entry { rel: string; abs: string; kind: 'dir' | 'file'; size: number }

const root = dirname(fileURLToPath(import.meta.url));
const appDir = join(root, 'app');
const shotsDir = join(root, 'screenshots');
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// ---------------------------------------------------------------------------------------------------------------
// Filesystem helpers

function statOrNull(path: string) {
  try {
    return lstatSync(path);
  } catch {
    return null;
  }
}

/** Every entry under `dir`, depth first, names sorted by code point so the walk never depends on the filesystem. */
function walk(dir: string, label: string, problems: string[], base = dir): Entry[] {
  const found: Entry[] = [];
  const names = readdirSync(dir).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  for (const name of names) {
    const abs = join(dir, name);
    const rel = relative(base, abs).split(sep).join('/');
    const st = lstatSync(abs);
    if (st.isSymbolicLink()) {
      problems.push(`${label}/${rel}: symlinks are not allowed`);
    } else if (st.isDirectory()) {
      found.push({ rel, abs, kind: 'dir', size: 0 });
      found.push(...walk(abs, label, problems, base));
    } else if (st.isFile()) {
      found.push({ rel, abs, kind: 'file', size: st.size });
    } else {
      problems.push(`${label}/${rel}: not a regular file or directory`);
    }
  }
  return found;
}

function formatBytes(n: number): string {
  if (n >= MiB) return `${(n / MiB).toFixed(2)} MiB`;
  if (n >= KiB) return `${(n / KiB).toFixed(1)} KiB`;
  return `${n} B`;
}

// ---------------------------------------------------------------------------------------------------------------
// Image header parsing

function sniffImage(bytes: Uint8Array): ImageKind | null {
  const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (bytes.length >= png.length && png.every((b, i) => bytes[i] === b)) return 'png';
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'jpeg';
  return null;
}

/** PNG: the first chunk must be IHDR, whose data opens with big-endian width then height. */
function pngDimensions(bytes: Uint8Array): Dimensions {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes.length < 24) throw new Error('PNG is truncated before its IHDR chunk');
  const type = String.fromCharCode(bytes[12], bytes[13], bytes[14], bytes[15]);
  if (type !== 'IHDR') throw new Error(`PNG's first chunk is ${JSON.stringify(type)}, expected IHDR`);
  return { width: view.getUint32(16), height: view.getUint32(20) };
}

/** JPEG: walk the marker segments from SOI until a start-of-frame (SOF0..SOF15 minus DHT, JPG, DAC). */
function jpegDimensions(bytes: Uint8Array): Dimensions {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let pos = 2; // past SOI
  while (pos < bytes.length) {
    if (bytes[pos] !== 0xff) throw new Error(`JPEG marker expected at offset ${pos}`);
    while (pos < bytes.length && bytes[pos] === 0xff) pos++; // fill bytes
    if (pos >= bytes.length) break;
    const marker = bytes[pos++];
    // Standalone markers carry no length field.
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    if (marker === 0xd9) break; // EOI
    if (marker === 0xda) throw new Error('JPEG reaches its scan data (SOS) before any SOF marker');
    if (pos + 2 > bytes.length) break;
    const length = view.getUint16(pos);
    if (length < 2) throw new Error(`JPEG segment at offset ${pos} has an invalid length ${length}`);
    const isSof = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    if (isSof) {
      if (pos + 7 > bytes.length) break;
      return { height: view.getUint16(pos + 3), width: view.getUint16(pos + 5) };
    }
    pos += length;
  }
  throw new Error('JPEG has no SOF marker');
}

// ---------------------------------------------------------------------------------------------------------------
// Pre-flight checks: each returns its findings instead of throwing, so one run reports every problem.

function checkApp(problems: string[]): Entry[] {
  const st = statOrNull(appDir);
  if (!st || !st.isDirectory() || st.isSymbolicLink()) {
    problems.push(`app/: missing or not a directory at ${appDir}`);
    return [];
  }
  const entries = walk(appDir, 'app', problems);

  const index = entries.find((e) => e.rel === 'index.html');
  if (!index || index.kind !== 'file') problems.push('app/index.html: missing (the frontend needs an entry page)');
  else if (index.size > LIMITS.indexHtmlBytes)
    problems.push(`app/index.html: ${formatBytes(index.size)} exceeds the ${formatBytes(LIMITS.indexHtmlBytes)} cap`);

  if (entries.length > LIMITS.appEntries)
    problems.push(`app/: ${entries.length} files and directories exceeds the cap of ${LIMITS.appEntries}`);

  const bytes = entries.reduce((sum, e) => sum + e.size, 0);
  if (bytes > LIMITS.appBytes) problems.push(`app/: ${formatBytes(bytes)} of files exceeds the ${formatBytes(LIMITS.appBytes)} cap`);
  return entries;
}

function checkScreenshots(problems: string[]): Entry[] {
  const st = statOrNull(shotsDir);
  if (!st || !st.isDirectory() || st.isSymbolicLink()) {
    problems.push(`screenshots/: missing or not a directory at ${shotsDir}`);
    return [];
  }
  const entries = walk(shotsDir, 'screenshots', problems);
  const images = entries.filter((e) => e.kind === 'file' && SHOT_EXTENSIONS.has(extname(e.rel).toLowerCase()));
  for (const e of entries) {
    if (!images.includes(e)) problems.push(`screenshots/${e.rel}: only .png, .jpg and .jpeg files belong here`);
  }
  if (images.length !== LIMITS.shotCount)
    problems.push(`screenshots/: found ${images.length} images, exactly ${LIMITS.shotCount} are required`);

  for (const img of images) {
    const label = `screenshots/${img.rel}`;
    if (img.size > LIMITS.shotBytes) problems.push(`${label}: ${formatBytes(img.size)} exceeds the ${formatBytes(LIMITS.shotBytes)} cap`);

    const bytes = readFileSync(img.abs);
    const kind = sniffImage(bytes);
    if (!kind) {
      problems.push(`${label}: not a PNG or JPEG (magic bytes do not match)`);
      continue;
    }
    const ext = extname(img.rel).toLowerCase();
    if ((kind === 'png') !== (ext === '.png')) problems.push(`${label}: contents are ${kind.toUpperCase()} but the extension is ${ext}`);

    let dims: Dimensions;
    try {
      dims = kind === 'png' ? pngDimensions(bytes) : jpegDimensions(bytes);
    } catch (err) {
      problems.push(`${label}: cannot read pixel size: ${(err as Error).message}`);
      continue;
    }
    const long = Math.max(dims.width, dims.height);
    const short = Math.min(dims.width, dims.height);
    if (long > LIMITS.shotLongSideMax)
      problems.push(`${label}: ${dims.width}x${dims.height}, long side ${long}px exceeds ${LIMITS.shotLongSideMax}px`);
    if (short < LIMITS.shotShortSideMin)
      problems.push(`${label}: ${dims.width}x${dims.height}, short side ${short}px is under ${LIMITS.shotShortSideMin}px`);
  }
  return images;
}

// ---------------------------------------------------------------------------------------------------------------
// Copying: byte-for-byte, in walk order, creating directories explicitly so empty ones survive too.

function mirror(entries: Entry[], target: string): { files: number; bytes: number } {
  mkdirSync(target, { recursive: true });
  let files = 0;
  let bytes = 0;
  for (const e of entries) {
    const dest = join(target, ...e.rel.split('/'));
    if (e.kind === 'dir') {
      mkdirSync(dest, { recursive: true });
      continue;
    }
    mkdirSync(dirname(dest), { recursive: true });
    const data = readFileSync(e.abs);
    writeFileSync(dest, data);
    files++;
    bytes += data.length;
  }
  return { files, bytes };
}

// ---------------------------------------------------------------------------------------------------------------

function main(): number {
  const problems: string[] = [];
  const appEntries = checkApp(problems);
  const shotEntries = checkScreenshots(problems);

  if (problems.length > 0) {
    console.error(`main.ts: pre-flight failed with ${problems.length} problem${problems.length === 1 ? '' : 's'}:`);
    for (const p of problems) console.error(`  - ${p}`);
    console.error('Nothing was written.');
    return 1;
  }

  const app = mirror(appEntries, join(outDir, 'app'));
  const shots = mirror(shotEntries, join(outDir, 'screenshots'));

  let dossier: Uint8Array;
  try {
    dossier = buildDossier(outDir, DOSSIER_OPTIONS);
  } catch (err) {
    console.error(`main.ts: building dossier.json failed: ${(err as Error).message}`);
    return 1;
  }
  writeFileSync(join(outDir, 'dossier.json'), dossier);

  const files = app.files + shots.files;
  const bytes = app.bytes + shots.bytes;
  console.log(`Wrote ${outDir}`);
  console.log(`  app/          ${app.files} files, ${formatBytes(app.bytes)}`);
  console.log(`  screenshots/  ${shots.files} files, ${formatBytes(shots.bytes)}`);
  console.log(`  total copied  ${files} files, ${bytes} bytes (${formatBytes(bytes)})`);
  console.log(`  dossier.json  ${dossier.length} bytes (${formatBytes(dossier.length)})`);
  return 0;
}

process.exitCode = main();
