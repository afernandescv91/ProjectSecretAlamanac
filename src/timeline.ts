// Floating timeline bar. Uses a native range input for touch, keyboard and
// screen-reader support, with a piecewise scale so the crowded modern
// centuries get more room than the sparse ancient ones.

import { formatYear, yearParts, type Snapshot } from './data';

export const START_YEAR = -3300;
export const END_YEAR = 2010;

// [yearFrom, yearTo, posFrom, posTo] with pos in 0..1
const SEGMENTS: [number, number, number, number][] = [
  [START_YEAR, -500, 0, 0.28],
  [-500, 1500, 0.28, 0.6],
  [1500, END_YEAR, 0.6, 1],
];
const STEPS = 2000;

const MARKS = [-3000, -2000, -1000, 1, 500, 1000, 1500, 1800, 2000];

export function yearToPos(year: number): number {
  for (const [y0, y1, p0, p1] of SEGMENTS) {
    if (year <= y1) return p0 + ((Math.max(year, y0) - y0) / (y1 - y0)) * (p1 - p0);
  }
  return 1;
}

export function posToYear(pos: number): number {
  for (const [y0, y1, p0, p1] of SEGMENTS) {
    if (pos <= p1) {
      const y = Math.round(y0 + ((pos - p0) / (p1 - p0)) * (y1 - y0));
      return y === 0 ? 1 : y; // there is no year 0
    }
  }
  return END_YEAR;
}

export interface TimelineOptions {
  root: HTMLElement;
  snapshots: Snapshot[];
  initialYear: number;
  onChange: (year: number) => void;
}

export class Timeline {
  private year: number;
  private range: HTMLInputElement;
  private numEl: HTMLElement;
  private eraEl: HTMLElement;
  private noteEl: HTMLElement;
  private playBtn: HTMLButtonElement;
  private timer: number | null = null;
  private snaps: Snapshot[];
  private onChange: (year: number) => void;

  constructor({ root, snapshots, initialYear, onChange }: TimelineOptions) {
    this.snaps = snapshots.filter((s) => s.year <= END_YEAR);
    this.onChange = onChange;
    this.year = initialYear;

    root.innerHTML = `
      <div class="tl-head">
        <div class="tl-controls">
          <button class="tl-btn" data-act="prev" aria-label="Previous map">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5 8 12l7 7"/></svg>
          </button>
          <button class="tl-btn tl-play" data-act="play" aria-label="Play through history">
            <svg class="i-play" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>
            <svg class="i-pause" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5h3v14H8zM13 5h3v14h-3z"/></svg>
          </button>
          <button class="tl-btn" data-act="next" aria-label="Next map">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 5 7 7-7 7"/></svg>
          </button>
        </div>
        <output class="tl-year" aria-live="polite">
          <span class="tl-num"></span><span class="tl-era"></span>
        </output>
        <p class="tl-note"></p>
      </div>
      <div class="tl-track">
        <div class="tl-ticks" aria-hidden="true"></div>
        <input class="tl-range" type="range" min="0" max="${STEPS}" step="1" aria-label="Year" />
        <div class="tl-marks" aria-hidden="true"></div>
      </div>`;

    this.range = root.querySelector('.tl-range')!;
    this.numEl = root.querySelector('.tl-num')!;
    this.eraEl = root.querySelector('.tl-era')!;
    this.noteEl = root.querySelector('.tl-note')!;
    this.playBtn = root.querySelector('.tl-play')!;

    const ticks = root.querySelector('.tl-ticks')!;
    for (const s of this.snaps) {
      const t = document.createElement('i');
      t.style.left = `${yearToPos(Math.max(s.year, START_YEAR)) * 100}%`;
      ticks.append(t);
    }
    const marks = root.querySelector('.tl-marks')!;
    for (const y of MARKS) {
      const m = document.createElement('span');
      m.style.left = `${yearToPos(y) * 100}%`;
      m.textContent = y < 0 ? `${-y} BC` : y === 1 ? 'AD 1' : String(y);
      marks.append(m);
    }

    this.range.addEventListener('input', () => {
      this.stop();
      this.set(posToYear(Number(this.range.value) / STEPS), false);
    });
    root.querySelector('[data-act="prev"]')!.addEventListener('click', () => { this.stop(); this.step(-1); });
    root.querySelector('[data-act="next"]')!.addEventListener('click', () => { this.stop(); this.step(1); });
    this.playBtn.addEventListener('click', () => (this.timer ? this.stop() : this.play()));

    this.set(initialYear, true, false);
  }

  /** Text describing which map is on screen, so in-between years stay honest. */
  setNote(text: string) {
    this.noteEl.textContent = text;
  }

  set(year: number, moveSlider = true, notify = true) {
    this.year = Math.min(END_YEAR, Math.max(START_YEAR, year));
    const { num, era } = yearParts(this.year);
    this.numEl.textContent = num;
    this.eraEl.textContent = era;
    if (moveSlider) this.range.value = String(Math.round(yearToPos(this.year) * STEPS));
    this.range.setAttribute('aria-valuetext', formatYear(this.year));
    if (notify) this.onChange(this.year);
  }

  /** Jump to the previous/next map in the dataset. */
  step(dir: 1 | -1): boolean {
    const years = this.snaps.map((s) => Math.max(s.year, START_YEAR));
    const target = dir > 0 ? years.find((y) => y > this.year) : [...years].reverse().find((y) => y < this.year);
    if (target === undefined) return false;
    this.set(target);
    return true;
  }

  play() {
    if (this.year >= this.snaps[this.snaps.length - 1].year) this.set(START_YEAR);
    this.playBtn.classList.add('is-playing');
    this.playBtn.setAttribute('aria-label', 'Pause');
    this.timer = window.setInterval(() => { if (!this.step(1)) this.stop(); }, 1800);
  }

  stop() {
    if (this.timer) window.clearInterval(this.timer);
    this.timer = null;
    this.playBtn.classList.remove('is-playing');
    this.playBtn.setAttribute('aria-label', 'Play through history');
  }
}
