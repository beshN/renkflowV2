/**
 * The office floor plan in metres, shared by the simulation (where people walk) and the 3D scene
 * (what is drawn). The floor is x -12..12, z -8..8 with the windows along z = -8; facing is the
 * yaw a person sitting there turns to (0 looks towards +z).
 */

export type Point = { x: number; z: number };
export type Seat = Point & { facing: number };
export type Desk = { id: string; x: number; z: number; chair: Seat; aisleZ: number };

export const FLOOR = { minX: -12, maxX: 12, minZ: -8, maxZ: 8 };

const DESK_ROWS = [-4.5, -1, 2.5];
const DESK_COLUMNS = [-1.5, 2, 5.5, 9];

/** Work desks; a person sits on the aisle side and faces the windows. */
export const DESKS: Desk[] = DESK_ROWS.flatMap((z, row) => DESK_COLUMNS.map((x, column) => ({
  id: `desk-${row + 1}-${column + 1}`, x, z, chair: { x, z: z + 0.85, facing: Math.PI }, aisleZ: z + 1.7,
})));

/** Close to the lounge, so the manager's walk to hand over a task stays short. */
export const MANAGER_DESK: Desk = { id: 'desk-manager', x: -8, z: 1.6, chair: { x: -8, z: 2.45, facing: Math.PI }, aisleZ: 3.3 };

export const LOUNGE = { minX: -10.8, maxX: -5.2, minZ: -6.6, maxZ: -1, table: { x: -8, z: -3.8 } };

/** Sofa and armchair seats in the lounge, one per member of staff. */
export const LOUNGE_SEATS: Seat[] = [
  ...[-9.2, -8, -6.8].map(x => ({ x, z: -5.55, facing: 0 })),
  ...[-9.2, -8, -6.8].map(x => ({ x, z: -2.05, facing: Math.PI })),
  { x: -10.25, z: -3.8, facing: Math.PI / 2 },
  { x: -5.75, z: -3.8, facing: -Math.PI / 2 },
];

/** Where people leave the lounge for the desks; nothing stands on x = -4.5 between the two. */
const LOUNGE_EXIT_X = -4.5;

/** The point just in front of a seat, where a person stands up or sits down. */
export function standingSpot(seat: Seat, distance = 0.6): Point {
  return { x: seat.x + Math.sin(seat.facing) * distance, z: seat.z + Math.cos(seat.facing) * distance };
}

/** Lounge seat → the walkway at the lounge exit (x = -4.5), stepping round the coffee table. */
function toWalkway(seat: Seat): Point[] {
  const up = standingSpot(seat);
  // Armchairs face the coffee table; step out of its row before heading for the exit.
  const lane = Math.abs(up.z - LOUNGE.table.z) < 0.8 ? [{ x: up.x, z: LOUNGE.table.z - 1.15 }] : [];
  const laneZ = lane[0]?.z ?? up.z;
  return [up, ...lane, { x: LOUNGE_EXIT_X, z: laneZ }];
}

/** Lounge seat → desk chair, along the lounge exit and the desk's aisle so no desk is crossed. */
export function pathToDesk(seat: Seat, desk: Desk): Point[] {
  return [...toWalkway(seat), { x: LOUNGE_EXIT_X, z: desk.aisleZ }, { x: desk.x, z: desk.aisleZ }, { x: desk.chair.x, z: desk.chair.z }];
}

export function pathToLounge(desk: Desk, seat: Seat): Point[] {
  return [...pathToDesk(seat, desk)].reverse().slice(1).concat({ x: seat.x, z: seat.z });
}

/** Where the manager stands to hand someone a task: just past the spot they stand up on. */
export const briefingSpot = (seat: Seat) => standingSpot(seat, 0.85);

/** Manager's chair → beside a lounge seat, the way the person on it will walk to the desks. */
export function pathToBrief(seat: Seat): Point[] {
  return [...pathToDesk(seat, MANAGER_DESK)].reverse().slice(1, -1).concat(briefingSpot(seat));
}

/** Back from beside a lounge seat to the manager's chair. */
export function pathFromBrief(seat: Seat): Point[] {
  return pathToDesk(seat, MANAGER_DESK).slice(1);
}

/*
 * Break spots: where people go when they are not working. Walkways that cross no furniture: the
 * lounge exit (x = -4.5), the first desk aisle (z = -2.8) with the gaps between desk columns
 * leading to the windows, and the front walkway (z = 5) past the kitchen, printer, the games
 * console and the TV corner.
 */

export type BreakKind = 'coffee' | 'snack' | 'cafe' | 'water' | 'tv' | 'game' | 'board' | 'window' | 'plant' | 'printer' | 'books';

export type BreakSpot = Seat & {
  id: string;
  /** What can be done here (the TV sofa: watch or play). */
  kinds: BreakKind[];
  /** From the lounge exit walkway to just before the spot. */
  route: Point[];
  /** Sits down here (sofa, stool) rather than standing. */
  seated?: boolean;
  /** The seat beside it, for a friend to join (the console). */
  partner?: string;
};

const FRONT_Z = 5;
const AISLE_Z = -2.8;

export const KITCHEN = { x: -11.65, minZ: 3.9, maxZ: 7.6, fridgeZ: 7.0, coffeeZ: 4.7 };
export const CAFE_TABLE = { x: -8, z: 6.6 };
/** The games corner: a big screen on a low stand facing the room, two bean bags behind it. */
export const GAMING = { x: 4.5, screenZ: 5.6, seatZ: 7.0, standWidth: 1.8 };
export const TV = { x: 11.6, z: 6.4, sofaX: 9.7 };
export const BOOKSHELF = { x: -11.75, z: 0.4 };
export const BOARD_X = 3.75;

export const BREAK_SPOTS: BreakSpot[] = [
  { id: 'coffee', kinds: ['coffee'], x: -10.9, z: KITCHEN.coffeeZ, facing: -Math.PI / 2, route: [{ x: LOUNGE_EXIT_X, z: FRONT_Z }, { x: -10.2, z: FRONT_Z }] },
  { id: 'fridge', kinds: ['snack'], x: -10.9, z: KITCHEN.fridgeZ, facing: -Math.PI / 2, route: [{ x: LOUNGE_EXIT_X, z: FRONT_Z }, { x: -10.2, z: FRONT_Z }, { x: -10.2, z: KITCHEN.fridgeZ }] },
  { id: 'cafe-1', kinds: ['cafe'], x: CAFE_TABLE.x - 0.6, z: CAFE_TABLE.z, facing: Math.PI / 2, seated: true, route: [{ x: LOUNGE_EXIT_X, z: FRONT_Z }, { x: CAFE_TABLE.x - 0.6, z: FRONT_Z }] },
  { id: 'cafe-2', kinds: ['cafe'], x: CAFE_TABLE.x + 0.6, z: CAFE_TABLE.z, facing: -Math.PI / 2, seated: true, route: [{ x: LOUNGE_EXIT_X, z: FRONT_Z }, { x: CAFE_TABLE.x + 0.6, z: FRONT_Z }] },
  { id: 'printer', kinds: ['printer'], x: -2.6, z: 6.3, facing: 0, route: [{ x: LOUNGE_EXIT_X, z: FRONT_Z }, { x: -2.6, z: FRONT_Z }] },
  // Round the screen's stand on the outside, then onto the bean bag.
  ...[-1, 1].map(side => ({
    id: `game-${side < 0 ? 1 : 2}`, kinds: ['game'] as BreakKind[], x: GAMING.x + side * 0.6, z: GAMING.seatZ, facing: Math.PI, seated: true, partner: `game-${side < 0 ? 2 : 1}`,
    route: [{ x: LOUNGE_EXIT_X, z: FRONT_Z }, { x: GAMING.x + side * 1.5, z: FRONT_Z }, { x: GAMING.x + side * 1.5, z: GAMING.seatZ }],
  })),
  ...[5.9, 6.9].map((z, i) => ({ id: `tv-${i + 1}`, kinds: ['tv'] as BreakKind[], x: TV.sofaX, z, facing: Math.PI / 2, seated: true, route: [{ x: LOUNGE_EXIT_X, z: FRONT_Z }, { x: 10.3, z: FRONT_Z }, { x: 10.3, z }] })),
  { id: 'water-1', kinds: ['water'], x: -5.0, z: -6.9, facing: Math.atan2(0.7, -0.5), route: [{ x: LOUNGE_EXIT_X, z: -6.2 }] },
  { id: 'water-2', kinds: ['water'], x: -5.6, z: -6.5, facing: Math.atan2(0.6, -0.4), route: [{ x: LOUNGE_EXIT_X, z: -6.2 }, { x: -5.6, z: -6.2 }] },
  { id: 'board', kinds: ['board'], x: BOARD_X, z: -6.9, facing: Math.PI, route: [{ x: LOUNGE_EXIT_X, z: AISLE_Z }, { x: BOARD_X, z: AISLE_Z }] },
  ...[7.25, 10.3].map((x, i) => ({ id: `window-${i + 1}`, kinds: ['window'] as BreakKind[], x, z: -7.3, facing: Math.PI, route: [{ x: LOUNGE_EXIT_X, z: AISLE_Z }, { x, z: AISLE_Z }] })),
  { id: 'plant', kinds: ['plant'], x: 0.25, z: -6.75, facing: Math.PI, route: [{ x: LOUNGE_EXIT_X, z: AISLE_Z }, { x: 0.25, z: AISLE_Z }] },
  { id: 'books', kinds: ['books'], x: -10.9, z: BOOKSHELF.z, facing: -Math.PI / 2, route: [{ x: LOUNGE_EXIT_X, z: BOOKSHELF.z }] },
];

export const breakSpot = (id: string | null) => BREAK_SPOTS.find(s => s.id === id);

/** Lounge seat → break spot. */
export function pathToSpot(seat: Seat, spot: BreakSpot): Point[] {
  return [...toWalkway(seat), ...spot.route, { x: spot.x, z: spot.z }];
}

/** Break spot → lounge seat, the same way back. */
export function pathFromSpot(spot: BreakSpot, seat: Seat): Point[] {
  return [...pathToSpot(seat, spot)].reverse().slice(1).concat({ x: seat.x, z: seat.z });
}

/** One spot to the next along the same walkway (coffee machine → café table); null when they share none. */
export function pathBetweenSpots(from: BreakSpot, to: BreakSpot): Point[] | null {
  const a = from.route.at(-1)!, b = to.route.at(-1)!;
  if (from.route[0].z !== to.route[0].z) return null;
  return [{ x: a.x, z: a.z }, ...(a.z === b.z ? [] : [{ x: a.x, z: to.route[0].z }]), { x: b.x, z: b.z }, { x: to.x, z: to.z }].filter((p, i, all) => i === 0 || p.x !== all[i - 1].x || p.z !== all[i - 1].z);
}

/** The manager's own coffee run: up from the desk and along the front walkway to the machine. */
export function managerCoffeePath(): Point[] {
  const coffee = breakSpot('coffee')!;
  return [{ x: MANAGER_DESK.x, z: MANAGER_DESK.aisleZ }, { x: MANAGER_DESK.x, z: FRONT_Z }, { x: -10.2, z: FRONT_Z }, { x: coffee.x, z: coffee.z }];
}
