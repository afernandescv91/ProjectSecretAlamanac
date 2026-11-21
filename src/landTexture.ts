// Paints a vellum-coloured land base (Natural Earth via world-atlas, public domain)
// onto an equirectangular canvas used as the globe's surface texture.
// It keeps land visible where the historical dataset records no polity.

import { feature } from 'topojson-client';
import type { Topology } from 'topojson-specification';
import type { MultiPolygon, Polygon, Position } from 'geojson';
import land from 'world-atlas/land-50m.json';

export function makeLandTexture(colors: { ocean: string; land: string; grid: string }, width = 4096): string {
  const height = width / 2;
  const c = document.createElement('canvas');
  c.width = width;
  c.height = height;
  const ctx = c.getContext('2d')!;

  ctx.fillStyle = colors.ocean;
  ctx.fillRect(0, 0, width, height);

  // Graticule every 15°, like an engraved globe.
  ctx.strokeStyle = colors.grid;
  ctx.lineWidth = width / 4096;
  for (let lng = -180; lng <= 180; lng += 15) {
    const x = ((lng + 180) / 360) * width;
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke();
  }
  for (let lat = -75; lat <= 75; lat += 15) {
    const y = ((90 - lat) / 180) * height;
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke();
  }

  const topo = land as unknown as Topology;
  const geo = feature(topo, topo.objects.land) as unknown as { features: { geometry: Polygon | MultiPolygon }[] };
  // Unwrap longitudes so rings crossing the 180° meridian stay continuous,
  // then paint each ring at -360/0/+360 so the overflow wraps around the texture.
  let shift = 0;
  const ring = (r: Position[]) => {
    let prev = r[0][0];
    let off = 0;
    r.forEach(([lng, lat], i) => {
      if (i > 0) {
        const d = lng - prev;
        if (d > 180) off -= 360; else if (d < -180) off += 360;
      }
      prev = lng;
      const x = ((lng + off + shift + 180) / 360) * width;
      const y = ((90 - lat) / 180) * height;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.closePath();
  };

  ctx.fillStyle = colors.land;
  for (const f of geo.features) {
    const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
    for (const p of polys) {
      for (shift = -360; shift <= 360; shift += 360) {
        ctx.beginPath();
        p.forEach(ring);
        ctx.fill('evenodd');
      }
    }
  }
  // The source Antarctica ring stops short of the pole; cap it so the pole isn't a hole.
  ctx.fillRect(0, ((90 - -85) / 180) * height, width, height);
  return c.toDataURL('image/jpeg', 0.9);
}
