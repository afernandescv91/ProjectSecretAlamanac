// Border data layer. The rest of the app only talks to `BorderSource`,
// so the dataset can be swapped (e.g. for a commercially licensed one)
// without touching the globe or the timeline.

import type { FeatureCollection, MultiPolygon, Polygon } from 'geojson';

export interface NationProps {
  name: string | null;
  subjectOf: string | null;
  partOf: string | null;
}

export type Borders = FeatureCollection<Polygon | MultiPolygon, NationProps>;

export interface Snapshot {
  /** Historical year: negative = BC, positive = AD, no year 0. */
  year: number;
  file: string;
}

export interface BorderSource {
  readonly attribution: { text: string; url: string; license: string };
  snapshots(): Promise<Snapshot[]>;
  load(snapshot: Snapshot): Promise<Borders>;
}

/** Reads the files produced by scripts/build-borders.mjs from public/data/borders. */
export class StaticBorderSource implements BorderSource {
  attribution = {
    text: 'Borders: historical-basemaps (A. Ourednik et al.)',
    url: 'https://github.com/aourednik/historical-basemaps',
    license: 'GPL-3.0',
  };
  private base: string;
  private cache = new Map<number, Promise<Borders>>();
  private manifest?: Promise<Snapshot[]>;

  constructor(base = `${import.meta.env.BASE_URL}data/borders/`) {
    this.base = base;
  }

  snapshots(): Promise<Snapshot[]> {
    this.manifest ??= fetch(`${this.base}manifest.json`)
      .then((r) => {
        if (!r.ok) throw new Error(`Border index missing (${r.status}). Run npm run data:borders.`);
        return r.json();
      })
      .then((m: { snapshots: Snapshot[] }) => [...m.snapshots].sort((a, b) => a.year - b.year));
    return this.manifest;
  }

  load(s: Snapshot): Promise<Borders> {
    let p = this.cache.get(s.year);
    if (!p) {
      p = fetch(`${this.base}${s.file}`).then((r) => {
        if (!r.ok) throw new Error(`Couldn't load borders for ${formatYear(s.year)} (${r.status}).`);
        return r.json() as Promise<Borders>;
      });
      p.catch(() => this.cache.delete(s.year));
      this.cache.set(s.year, p);
    }
    return p;
  }
}

/** The snapshot in force for `year`: the latest one at or before it (or the earliest). */
export function snapshotFor(year: number, list: Snapshot[]): Snapshot {
  let pick = list[0];
  for (const s of list) {
    if (s.year <= year) pick = s;
    else break;
  }
  return pick;
}

export function formatYear(year: number): string {
  return year < 0 ? `${-year} BC` : `AD ${year}`;
}

export function yearParts(year: number): { num: string; era: 'BC' | 'AD' } {
  return year < 0 ? { num: String(-year), era: 'BC' } : { num: String(year), era: 'AD' };
}
