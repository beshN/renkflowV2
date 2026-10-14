/**
 * Demo tracking: four vehicles stay on their routes, move, stop at the far end and come back.
 */
import { DEMO_VEHICLES, demoFleetAt, demoState } from '@/lib/features/fleet/demo';
import { haversineKm, normalizePlate } from '@/lib/features/fleet/engine';

describe('fleet demo', () => {
  it('has four vehicles with valid, distinct plates', () => {
    expect(DEMO_VEHICLES).toHaveLength(4);
    expect(new Set(DEMO_VEHICLES.map((v) => v.plate)).size).toBe(4);
    for (const v of DEMO_VEHICLES) expect(normalizePlate(v.plate)).toBe(v.plate);
  });

  it('starts every vehicle on its route and keeps it within the route area', () => {
    for (const v of DEMO_VEHICLES) {
      const lats = v.route.map((p) => p.lat), lngs = v.route.map((p) => p.lng);
      for (let s = 0; s < 4000; s += 37) {
        const p = demoState(v, s);
        expect(p.lat).toBeGreaterThanOrEqual(Math.min(...lats) - 1e-9);
        expect(p.lat).toBeLessThanOrEqual(Math.max(...lats) + 1e-9);
        expect(p.lng).toBeGreaterThanOrEqual(Math.min(...lngs) - 1e-9);
        expect(p.lng).toBeLessThanOrEqual(Math.max(...lngs) + 1e-9);
      }
    }
  });

  it('moves at about the vehicle speed and never teleports', () => {
    for (const v of DEMO_VEHICLES) {
      let prev = demoState(v, 0);
      for (let s = 5; s < 3000; s += 5) {
        const cur = demoState(v, s);
        // 5 s at the top speed (+18 %) is well under 150 m.
        expect(haversineKm(prev, cur)).toBeLessThan(0.15);
        prev = cur;
      }
    }
  });

  it('stops at the far end, then drives back', () => {
    const v = DEMO_VEHICLES[1];
    const end = v.route[v.route.length - 1];
    let stoppedAtEnd = false, backAtDepot = false;
    for (let s = 0; s < 4000; s++) {
      const p = demoState(v, s);
      if (p.status === 'stopped' && haversineKm(p, end) < 0.01) stoppedAtEnd = true;
      if (stoppedAtEnd && p.status === 'stopped' && haversineKm(p, v.route[0]) < 0.01) backAtDepot = true;
      if (p.status === 'stopped') expect(p.speedKmh).toBe(0);
      else expect(p.speedKmh).toBeGreaterThan(0);
    }
    expect(stoppedAtEnd).toBe(true);
    expect(backAtDepot).toBe(true);
  });

  it('counts kilometres up and is deterministic', () => {
    const a = demoFleetAt(600), b = demoFleetAt(600), later = demoFleetAt(1200);
    expect(a).toEqual(b);
    a.forEach((p, i) => expect(later[i].distanceKm).toBeGreaterThanOrEqual(p.distanceKm));
    expect(a.some((p) => p.status === 'driving')).toBe(true);
  });
});
