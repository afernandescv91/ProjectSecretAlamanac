import '@fontsource/alegreya/500.css';
import '@fontsource/alegreya/700.css';
import '@fontsource/alegreya-sans/400.css';
import '@fontsource/alegreya-sans/500.css';
import './style.css';

import Globe from 'globe.gl';
import type { Feature, MultiPolygon, Polygon } from 'geojson';
import { StaticBorderSource, formatYear, snapshotFor, type NationProps, type Snapshot } from './data';
import { makeLandTexture } from './landTexture';
import { START_YEAR, Timeline } from './timeline';

type Nation = Feature<Polygon | MultiPolygon, NationProps>;

const PALETTE = {
  ocean: '#1C3354',
  land: '#D9CBA3',
  grid: 'rgba(214, 186, 120, 0.16)',
  stroke: 'rgba(40, 30, 20, 0.55)',
  brass: '#C9A24A',
};

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Stable, map-ink colour per polity. Colonies share their ruler's hue.
function inkFor(p: NationProps): string {
  const key = p.subjectOf || p.name || '';
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 16777619);
  const hue = (h >>> 0) % 360;
  const sat = 38 + ((h >>> 9) % 18);
  const light = 58 + ((h >>> 17) % 12);
  return `hsla(${hue}, ${sat}%, ${light}%, 0.92)`;
}

const describe = (p: NationProps) => {
  const name = p.name ?? 'Unnamed region';
  const ruler = p.subjectOf && p.subjectOf !== p.name ? p.subjectOf : null;
  return { name, ruler };
};

async function start() {
  const source = new StaticBorderSource();
  const stage = document.getElementById('globe')!;
  const card = document.getElementById('card')!;
  const status = document.getElementById('status')!;
  const credit = document.getElementById('credit')!;
  credit.innerHTML = `${source.attribution.text}, <a href="${source.attribution.url}" target="_blank" rel="noopener">${source.attribution.license}</a>; land from Natural Earth`;

  const globe = new Globe(stage, { rendererConfig: { antialias: true, alpha: true } })
    .backgroundColor('rgba(0,0,0,0)')
    .globeImageUrl(makeLandTexture(PALETTE, 2048))
    .showAtmosphere(true)
    .atmosphereColor('#8FB3E8')
    .atmosphereAltitude(0.18)
    .polygonsTransitionDuration(reduceMotion ? 0 : 350)
    .polygonAltitude((d) => ((d as Nation) === selected ? 0.03 : 0.006))
    .polygonCapColor((d) => inkFor((d as Nation).properties))
    .polygonSideColor(() => 'rgba(40, 30, 20, 0.35)')
    .polygonStrokeColor(() => PALETTE.stroke)
    .polygonLabel((d) => {
      const { name, ruler } = describe((d as Nation).properties);
      return `<div class="tip"><b>${escapeHtml(name)}</b>${ruler ? `<span>under ${escapeHtml(ruler)}</span>` : ''}</div>`;
    })
    .onPolygonClick((d) => select(d as Nation))
    .onGlobeClick(() => select(null));

  const controls = globe.controls();
  controls.autoRotate = !reduceMotion;
  controls.autoRotateSpeed = 0.35;
  controls.enableDamping = true;
  controls.minDistance = 140;
  controls.maxDistance = 700;
  stage.addEventListener('pointerdown', () => (controls.autoRotate = false), { once: true });
  // Pull the camera back on tall, narrow screens so the whole globe fits.
  const aspect = stage.clientWidth / Math.max(1, stage.clientHeight);
  globe.pointOfView({ lat: 30, lng: 25, altitude: aspect < 0.9 ? 2.4 / Math.sqrt(Math.max(aspect, 0.45)) : 2.4 });

  const resize = () => {
    globe.width(stage.clientWidth).height(stage.clientHeight);
  };
  new ResizeObserver(resize).observe(stage);
  resize();

  let selected: Nation | null = null;
  function select(n: Nation | null) {
    selected = n;
    globe.polygonAltitude(globe.polygonAltitude()); // re-evaluate altitudes
    if (!n) {
      card.hidden = true;
      return;
    }
    const { name, ruler } = describe(n.properties);
    card.querySelector('.card-name')!.textContent = name;
    card.querySelector('.card-ruler')!.textContent = ruler ? `Under ${ruler}` : '';
    card.querySelector('.card-map')!.textContent = `As drawn on the ${formatYear(current!.year)} map`;
    card.hidden = false;
  }
  card.querySelector('.card-close')!.addEventListener('click', () => select(null));

  let snapshots: Snapshot[];
  try {
    snapshots = await source.snapshots();
  } catch (e) {
    status.textContent = (e as Error).message;
    status.hidden = false;
    return;
  }

  let current: Snapshot | null = null;
  let token = 0;
  async function show(year: number) {
    const snap = snapshotFor(year, snapshots);
    timeline.setNote(
      snap.year === year ? 'Borders as mapped for this year' : `Showing the ${formatYear(snap.year)} map`,
    );
    if (current?.year === snap.year) return;
    current = snap;
    const mine = ++token;
    status.textContent = `Loading ${formatYear(snap.year)}…`;
    const slow = window.setTimeout(() => (status.hidden = false), 250);
    try {
      const data = await source.load(snap);
      if (mine !== token) return;
      const keep = selected?.properties.name;
      globe.polygonsData(data.features);
      const match = keep ? data.features.find((f) => f.properties.name === keep) : undefined;
      select((match as Nation) ?? null);
      status.hidden = true;
      // Warm the neighbours so scrubbing and playback feel instant.
      const i = snapshots.indexOf(snap);
      [snapshots[i + 1], snapshots[i - 1]].forEach((s) => s && source.load(s).catch(() => {}));
    } catch (e) {
      if (mine !== token) return;
      current = null;
      status.textContent = (e as Error).message;
      status.hidden = false;
    } finally {
      window.clearTimeout(slow);
    }
  }

  const timeline = new Timeline({
    root: document.getElementById('timeline')!,
    snapshots,
    initialYear: START_YEAR,
    onChange: (y) => void show(y),
  });
  void show(START_YEAR);
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

start();
