#!/usr/bin/env node
// Builds the border snapshots the app loads at runtime.
//
// Usage: node scripts/build-borders.mjs <path-to-historical-basemaps/geojson> [--from=-4000] [--interval=6000]
//
// Source: https://github.com/aourednik/historical-basemaps (GPL-3.0).
// Output: public/data/borders/<year>.json + public/data/borders/manifest.json
// Years are astronomical-free "historical" years: -4000 = 4000 BC, -1 = 1 BC, 1 = AD 1 (no year 0).

import { readdirSync, mkdirSync, writeFileSync, readFileSync, rmSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';

const args = process.argv.slice(2);
const srcDir = args.find((a) => !a.startsWith('--'));
if (!srcDir) {
  console.error('Usage: node scripts/build-borders.mjs <historical-basemaps/geojson dir> [--from=-4000] [--interval=6000]');
  process.exit(1);
}
const opt = (name, def) => (args.find((a) => a.startsWith(`--${name}=`)) ?? `=${def}`).split('=')[1];
const fromYear = Number(opt('from', -4000));
const interval = opt('interval', '6000'); // metres between kept vertices

const outDir = resolve('public/data/borders');
rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

const parseYear = (file) => {
  const m = file.match(/^world_(bc)?(\d+)\.geojson$/);
  if (!m) return null;
  return m[1] ? -Number(m[2]) : Number(m[2]);
};

const snapshots = readdirSync(srcDir)
  .map((f) => ({ file: f, year: parseYear(f) }))
  .filter((s) => s.year !== null && s.year >= fromYear)
  .sort((a, b) => a.year - b.year);

// three-globe (via d3-geo) treats rings spherically: an outer ring must run
// clockwise or it is read as "the whole globe except this area". Normalise
// outer rings to clockwise and holes to counter-clockwise (planar lon/lat).
const signedArea = (r) => {
  let a = 0;
  for (let i = 0; i < r.length - 1; i++) a += (r[i + 1][0] - r[i][0]) * (r[i + 1][1] + r[i][1]);
  return a; // > 0 means clockwise
};
const orient = (r, clockwise) => ((signedArea(r) > 0) === clockwise ? r : [...r].reverse());
const fixPolygon = (rings) => rings.map((r, i) => orient(r, i === 0));
function toSphericalWinding(g) {
  if (g.type === 'Polygon') return { type: 'Polygon', coordinates: fixPolygon(g.coordinates) };
  return { type: 'MultiPolygon', coordinates: g.coordinates.map(fixPolygon) };
}

const mapshaper = resolve('node_modules/.bin/mapshaper');
const manifest = [];

for (const s of snapshots) {
  const out = join(outDir, `${s.year}.json`);
  execFileSync(mapshaper, [
    join(srcDir, s.file),
    '-filter-fields', 'NAME,SUBJECTO,PARTOF',
    '-simplify', `interval=${interval}`, 'keep-shapes',
    '-clean',
    '-o', out, 'format=geojson', 'precision=0.001', 'force',
  ], { stdio: ['ignore', 'ignore', 'inherit'] });

  // Normalise property names to what the app expects.
  const fc = JSON.parse(readFileSync(out, 'utf8'));
  // Unnamed features mark land with no recorded polity; the app's land base
  // already covers those, and some (e.g. Antarctica's 360° band) render badly as caps.
  fc.features = fc.features
    .filter((f) => f.geometry && f.properties.NAME)
    .map((f) => ({
      type: 'Feature',
      properties: {
        name: f.properties.NAME ?? null,
        subjectOf: f.properties.SUBJECTO ?? null,
        partOf: f.properties.PARTOF ?? null,
      },
      geometry: toSphericalWinding(f.geometry),
    }));
  writeFileSync(out, JSON.stringify(fc));
  const kb = Math.round(statSync(out).size / 1024);
  manifest.push({ year: s.year, file: `${s.year}.json`, features: fc.features.length, kb });
  console.log(`${String(s.year).padStart(6)}  ${String(fc.features.length).padStart(4)} features  ${kb} KB`);
}

writeFileSync(
  join(outDir, 'manifest.json'),
  JSON.stringify({
    source: 'historical-basemaps by André Ourednik et al.',
    sourceUrl: 'https://github.com/aourednik/historical-basemaps',
    license: 'GPL-3.0',
    snapshots: manifest,
  }, null, 2),
);
console.log(`Wrote ${manifest.length} snapshots to ${outDir}`);
