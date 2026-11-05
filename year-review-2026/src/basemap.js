import { geoEquirectangular, geoPath, geoGraticule10 } from 'd3-geo';
import { feature, mesh } from 'topojson-client';
import * as THREE from 'three/webgpu';
import { ll2v } from './geo.js';
import land50 from 'world-atlas/countries-50m.json';

export function paintBasemap(width) {
  const height = width / 2;
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext('2d');
  const proj = geoEquirectangular().scale(width / (2 * Math.PI)).translate([width / 2, height / 2]).precision(0.1);
  const path = geoPath(proj, ctx);
  const s = width / 4096;

  ctx.fillStyle = '#07101e'; ctx.fillRect(0, 0, width, height);

  ctx.beginPath(); path(geoGraticule10()); ctx.strokeStyle = 'rgba(100,150,210,0.14)'; ctx.lineWidth = 1 * s; ctx.stroke();

  const land = feature(land50, land50.objects.land);
  ctx.beginPath(); path(land); ctx.fillStyle = '#15233a'; ctx.fill();

  const borders = mesh(land50, land50.objects.countries, (a, b) => a !== b);
  ctx.beginPath(); path(borders); ctx.strokeStyle = 'rgba(130,180,235,0.5)'; ctx.lineWidth = 1.1 * s; ctx.stroke();

  ctx.beginPath(); path(land); ctx.strokeStyle = 'rgba(150,205,255,0.7)'; ctx.lineWidth = 1.3 * s; ctx.stroke();
  return canvas;
}

export function borderLines(topology, r = 1.0007, color = 0x7fb2ee, opacity = 0.35) {
  const m = mesh(topology, topology.objects.countries, (a, b) => a !== b);
  const pos = []; const v = new THREE.Vector3();
  for (const line of m.coordinates) {
    for (let i = 1; i < line.length; i++) {
      const [lo0, la0] = line[i - 1], [lo1, la1] = line[i];
      if (Math.abs(lo1 - lo0) > 180) continue;
      ll2v(la0, lo0, r, v); pos.push(v.x, v.y, v.z);
      ll2v(la1, lo1, r, v); pos.push(v.x, v.y, v.z);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  return new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color, transparent: true, opacity, depthWrite: false }));
}

export { land50 };
