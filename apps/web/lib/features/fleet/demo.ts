/**
 * Demo tracking (pure): four made-up vehicles driving fixed Istanbul routes, so the live map can be
 * shown before a real device is connected. Nothing here is stored or sent anywhere; the screen labels
 * it "Demo" and real positions never mix with it.
 */
import { haversineKm } from './engine';

type Point = { lat: number; lng: number };

export type DemoVehicle = {
  id: string;
  plate: string;
  label: string;
  driver: string;
  /** What the vehicle is doing on its route, shown in the list. */
  job: string;
  /** Average speed while driving. */
  speedKmh: number;
  /** Time spent at the far end (delivery, installation) before driving back. */
  dwellSeconds: number;
  /** Seconds into the loop at which this vehicle starts, so they are not all at the depot together. */
  offsetSeconds: number;
  route: Point[];
};

const DEPOT = { lat: 41.0642, lng: 28.8147 }; // İkitelli

export const DEMO_VEHICLES: DemoVehicle[] = [
  {
    id: 'demo-1', plate: '34DMO101', label: 'Kamyonet 1', driver: 'Murat K.', job: 'Kadıköy · pergola montajı', speedKmh: 46, dwellSeconds: 90, offsetSeconds: 0,
    route: [DEPOT, { lat: 41.0587, lng: 28.8452 }, { lat: 41.0504, lng: 28.9139 }, { lat: 41.0206, lng: 28.9441 }, { lat: 41.0062, lng: 29.0035 }, { lat: 40.9903, lng: 29.0292 }],
  },
  {
    id: 'demo-2', plate: '34DMO102', label: 'Panelvan', driver: 'Ahmet Y.', job: 'Beylikdüzü · tente teslimi', speedKmh: 52, dwellSeconds: 75, offsetSeconds: 70,
    route: [DEPOT, { lat: 41.0383, lng: 28.7874 }, { lat: 41.0147, lng: 28.7335 }, { lat: 40.9985, lng: 28.6571 }, { lat: 40.9906, lng: 28.6272 }],
  },
  {
    id: 'demo-3', plate: '34DMO103', label: 'Kamyon', driver: 'Selim D.', job: 'Tuzla · profil sevkiyatı', speedKmh: 58, dwellSeconds: 120, offsetSeconds: 150,
    route: [DEPOT, { lat: 41.0699, lng: 28.8807 }, { lat: 41.0773, lng: 28.9992 }, { lat: 41.0431, lng: 29.0768 }, { lat: 40.9706, lng: 29.2005 }, { lat: 40.8156, lng: 29.3066 }],
  },
  {
    id: 'demo-4', plate: '34DMO104', label: 'Kamyonet 2', driver: 'Emre T.', job: 'Sarıyer · servis ziyareti', speedKmh: 40, dwellSeconds: 60, offsetSeconds: 40,
    route: [DEPOT, { lat: 41.0918, lng: 28.8793 }, { lat: 41.1009, lng: 28.9906 }, { lat: 41.1166, lng: 29.0227 }, { lat: 41.1706, lng: 29.0575 }],
  },
];

export type DemoState = {
  vehicle: DemoVehicle;
  lat: number;
  lng: number;
  /** Direction of travel in degrees (0 = north); the last one held while stopped. */
  heading: number;
  speedKmh: number;
  status: 'driving' | 'stopped';
  /** Kilometres driven since the demo loop started. */
  distanceKm: number;
};

const bearing = (a: Point, b: Point) => {
  const rad = Math.PI / 180;
  const y = Math.sin((b.lng - a.lng) * rad) * Math.cos(b.lat * rad);
  const x = Math.cos(a.lat * rad) * Math.sin(b.lat * rad) - Math.sin(a.lat * rad) * Math.cos(b.lat * rad) * Math.cos((b.lng - a.lng) * rad);
  return Math.round(((Math.atan2(y, x) / rad) + 360) % 360);
};

/** Cumulative distance of each route point from the start, in km. */
function legs(route: Point[]) {
  const cumulative = [0];
  for (let i = 1; i < route.length; i++) cumulative.push(cumulative[i - 1] + haversineKm(route[i - 1], route[i]));
  return cumulative;
}

/** The point `km` along the route and the direction it is heading there. */
function along(route: Point[], cumulative: number[], km: number, reverse: boolean) {
  const total = cumulative[cumulative.length - 1];
  const d = Math.min(Math.max(reverse ? total - km : km, 0), total);
  let i = 1;
  while (i < cumulative.length - 1 && cumulative[i] < d) i++;
  const span = cumulative[i] - cumulative[i - 1] || 1;
  const f = (d - cumulative[i - 1]) / span;
  const a = route[i - 1], b = route[i];
  const heading = bearing(reverse ? b : a, reverse ? a : b);
  return { lat: a.lat + (b.lat - a.lat) * f, lng: a.lng + (b.lng - a.lng) * f, heading };
}

/**
 * Where a demo vehicle is `seconds` after the demo started: out along its route, a stop at the far
 * end, back to the depot, a short stop there, and round again. Speed varies a little along the way
 * so the numbers move like a real vehicle's.
 */
export function demoState(vehicle: DemoVehicle, seconds: number): DemoState {
  const cumulative = legs(vehicle.route);
  const totalKm = cumulative[cumulative.length - 1];
  const driveSeconds = (totalKm / vehicle.speedKmh) * 3600;
  const depotDwell = 30;
  const loop = driveSeconds * 2 + vehicle.dwellSeconds + depotDwell;
  const t = ((seconds + vehicle.offsetSeconds) % loop + loop) % loop;
  const laps = Math.floor((seconds + vehicle.offsetSeconds) / loop);
  const wobble = (k: number) => Math.round(vehicle.speedKmh * (1 + 0.18 * Math.sin(k / 9 + vehicle.offsetSeconds)));
  const base = Math.max(laps, 0) * totalKm * 2;

  let km: number, reverse: boolean, driving: boolean;
  if (t < driveSeconds) { km = (t / 3600) * vehicle.speedKmh; reverse = false; driving = true; }
  else if (t < driveSeconds + vehicle.dwellSeconds) { km = totalKm; reverse = false; driving = false; }
  else if (t < driveSeconds * 2 + vehicle.dwellSeconds) { km = ((t - driveSeconds - vehicle.dwellSeconds) / 3600) * vehicle.speedKmh; reverse = true; driving = true; }
  else { km = totalKm; reverse = true; driving = false; }

  const p = along(vehicle.route, cumulative, km, reverse);
  const covered = driving ? (reverse ? totalKm + km : km) : (reverse ? totalKm * 2 : totalKm);
  return { vehicle, lat: p.lat, lng: p.lng, heading: p.heading, speedKmh: driving ? wobble(seconds) : 0, status: driving ? 'driving' : 'stopped', distanceKm: Math.round((base + covered) * 10) / 10 };
}

export const demoFleetAt = (seconds: number) => DEMO_VEHICLES.map((v) => demoState(v, seconds));
