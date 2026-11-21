# Secret Almanac

A floating globe that redraws the world's borders as you move through time, from 3300 BC to AD 2010. It runs as a web app and as an Android app from one TypeScript codebase.

- **Globe:** [globe.gl](https://github.com/vasturiano/globe.gl) (Three.js / WebGL). Drag to turn it, pinch or scroll to zoom, and tap a region to see its name and ruler.
- **Timeline:** a floating bar above the globe. Drag the slider, step from map to map with ‹ ›, or press play. The scale gives more room to recent centuries, where the maps are denser.
- **Android:** [Capacitor](https://capacitorjs.com) wraps the same web build in a native app.

## Getting started

```bash
npm install
npm run dev          # http://localhost:5173
npm run build        # production web build in dist/
```

Live web version: https://afernandescv91.github.io/ProjectSecretAlamanac/. Each push to `main` or a `globe-*` branch rebuilds it and publishes it to the `gh-pages` branch.

### Android

You need Android Studio (which brings the Android SDK) and JDK 21.

```bash
npm run android:sync   # build the web app and copy it into android/
npm run android:open   # open in Android Studio, then Run ▶
```

Every push to `main` or a `globe-*` branch also builds a debug APK on GitHub Actions. You can download it from the workflow run's **Artifacts** section (`secret-almanac-debug-apk`).

## Border data

The app reads pre-built snapshots from `public/data/borders/` (50 maps, 4000 BC to 2010). To rebuild them:

```bash
git clone --depth 1 https://github.com/aourednik/historical-basemaps.git ../historical-basemaps
npm run data:borders -- ../historical-basemaps/geojson --interval=15000
```

The script:

- keeps snapshots from 4000 BC onward;
- simplifies each one to roughly one point per 15 km;
- drops unnamed "no recorded polity" areas, because the land base already covers them;
- fixes ring winding for the globe renderer.

The dataset has no map for every year. The globe shows the most recent map at or before the selected year, and the timeline says so. For example, it reads "Showing the 4000 BC map" for 3300 BC.

The land base under the borders is Natural Earth (public domain), via [world-atlas](https://github.com/topojson/world-atlas).

### Licensing: read before monetizing

- **historical-basemaps** is **GPL-3.0**. If you distribute an app that bundles this data, the GPL's copyleft terms are likely to apply to that distribution. Get proper advice before selling the app or closing its source.
- All dataset access goes through the `BorderSource` interface in `src/data.ts`. To switch datasets, write a new source; the globe and timeline code stay as they are. Two candidates:
  - **OpenHistoricalMap:** CC0, but coverage varies by region.
  - **CShapes 2.0:** precise borders for 1886–2019, but licensed CC BY-NC-SA, so non-commercial use only.
- The author of historical-basemaps describes it as work in progress, and its borders for ancient periods are approximate.

## Project layout

```
src/
  main.ts          globe setup, loading snapshots, region card
  timeline.ts      floating timeline (piecewise year scale, play/step)
  data.ts          BorderSource interface + static-file implementation
  landTexture.ts   paints the ocean/land/graticule texture
  style.css
scripts/
  build-borders.mjs  data pipeline
public/data/borders/ generated snapshots + manifest.json
android/             Capacitor Android project
```
