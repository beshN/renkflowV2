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

/** Lounge seat → desk chair, along the lounge exit and the desk's aisle so no desk is crossed. */
export function pathToDesk(seat: Seat, desk: Desk): Point[] {
  const up = standingSpot(seat);
  // Armchairs face the coffee table; step out of its row before heading for the exit.
  const lane = Math.abs(up.z - LOUNGE.table.z) < 0.8 ? [{ x: up.x, z: LOUNGE.table.z - 1.15 }] : [];
  const laneZ = lane[0]?.z ?? up.z;
  return [up, ...lane, { x: LOUNGE_EXIT_X, z: laneZ }, { x: LOUNGE_EXIT_X, z: desk.aisleZ }, { x: desk.x, z: desk.aisleZ }, { x: desk.chair.x, z: desk.chair.z }];
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

/** Where the manager stands to look over someone's screen: beside their chair, on the aisle side. */
export const checkingSpot = (desk: Desk): Point => ({ x: desk.x + 0.6, z: desk.z + 1.3 });

/** Manager's chair → beside a work desk, down the lounge exit lane and along the desk's aisle. */
export function pathToCheck(desk: Desk): Point[] {
  return [
    { x: MANAGER_DESK.chair.x, z: MANAGER_DESK.aisleZ }, { x: LOUNGE_EXIT_X, z: MANAGER_DESK.aisleZ },
    { x: LOUNGE_EXIT_X, z: desk.aisleZ }, { x: checkingSpot(desk).x, z: desk.aisleZ }, checkingSpot(desk),
  ];
}

export function pathFromCheck(desk: Desk): Point[] {
  return [...pathToCheck(desk)].reverse().slice(1).concat({ x: MANAGER_DESK.chair.x, z: MANAGER_DESK.chair.z });
}
