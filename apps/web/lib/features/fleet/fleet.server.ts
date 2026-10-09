import 'server-only';

import { createHash, randomBytes } from 'node:crypto';
import { z } from 'zod';
import { sql, withTransaction } from '@/lib/db';
import { changedFields, recordAudit } from '@/lib/audit/audit-log';
import { tableExists } from '@/lib/db/schema-guard';
import { consumeRateLimit } from '@/lib/security/rate-limit';
import { resolveMemberAccess } from '@/lib/security/member-access.server';
import { can, type Action } from '@/lib/security/access-matrix';
import { WorkOrderApiError, type WorkOrderActor } from '@/lib/features/work-orders/security';
import {
  DOCUMENT_KINDS, VEHICLE_STATUSES, VEHICLE_TYPES, assignmentConflicts, checkPosition, costPerKm, currentDocuments, documentAlerts, documentLevel,
  fuelConsumption, isCalendarDay, monthlyCosts, normalizePlate, retentionCutoff, routeSummary, vehicleHealth, type Position, type RawPosition,
} from './engine';

type Row = Record<string, any>;
const iso = (d: unknown) => (d ? new Date(d as string).toISOString().slice(0, 10) : null);
const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));
const today = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Istanbul' }).format(new Date());
const hashToken = (t: string) => createHash('sha256').update(t).digest('hex');

/**
 * The fleet is the owner's and admins' only: the base role must be owner/admin and the member's
 * role must hold the fleet cell. Anyone else gets 404, as if there were no fleet.
 */
export async function requireFleet(actor: WorkOrderActor, action: Action = 'view') {
  if (!(await tableExists('vehicles'))) throw new WorkOrderApiError('Araç filosu için veritabanı güncellemesi (046) bekleniyor', 409);
  if (actor.role !== 'owner' && actor.role !== 'admin') throw new WorkOrderApiError('Bulunamadı', 404);
  const access = await resolveMemberAccess(actor.userId, actor.tenantId);
  if (!access || access.deactivated) throw new WorkOrderApiError('Unauthorized', 401);
  if (!can(access, 'fleet', 'view')) throw new WorkOrderApiError('Bulunamadı', 404);
  if (!can(access, 'fleet', action)) throw new WorkOrderApiError('Bu işlem için yetkiniz yok', 403);
}

async function loadVehicle(db: any, tenantId: string, id: string, lock = false) {
  const [v] = lock
    ? await db`SELECT * FROM vehicles WHERE tenant_id = ${tenantId} AND id = ${id} FOR UPDATE`
    : await db`SELECT * FROM vehicles WHERE tenant_id = ${tenantId} AND id = ${id}`;
  if (!v) throw new WorkOrderApiError('Araç bulunamadı', 404);
  return v;
}

async function checkMember(db: any, tenantId: string, userId: string | null | undefined) {
  if (!userId) return;
  const [m] = await db`SELECT 1 FROM tenant_members WHERE tenant_id = ${tenantId} AND user_id = ${userId}`;
  if (!m) throw new WorkOrderApiError('Sürücü bu firmanın üyesi değil', 400);
}

const docDto = (d: Row) => ({ id: String(d.id), kind: d.kind as string, number: d.number ?? null, issuedOn: iso(d.issued_on), expiresOn: iso(d.expires_on), amount: num(d.amount), attachmentId: d.attachment_id ? String(d.attachment_id) : null, notes: d.notes ?? null, ...documentLevel(iso(d.expires_on), today()) });

/** Each vehicle's last position: one index lookup per vehicle, not a scan of the whole history. */
function lastPositions(tenantId: string) {
  return sql`SELECT v.id AS vehicle_id, v.plate, p.recorded_at, p.lat, p.lng, p.speed_kmh, p.ignition FROM vehicles v
    CROSS JOIN LATERAL (SELECT recorded_at, lat, lng, speed_kmh, ignition FROM vehicle_positions
      WHERE tenant_id = v.tenant_id AND vehicle_id = v.id ORDER BY recorded_at DESC LIMIT 1) p
    WHERE v.tenant_id = ${tenantId}`;
}

/** Cards: plate, make/model, type, status, driver, document warning, health, last position. */
export async function listVehicles(actor: WorkOrderActor) {
  await requireFleet(actor);
  const [vehicles, docs, services, positions, devices] = await Promise.all([
    sql`SELECT v.*, u.name AS driver_name FROM vehicles v LEFT JOIN users u ON u.id = v.driver_id WHERE v.tenant_id = ${actor.tenantId} ORDER BY (v.status = 'sold'), v.plate`,
    sql`SELECT vehicle_id, kind, expires_on FROM vehicle_documents WHERE tenant_id = ${actor.tenantId}`,
    sql`SELECT DISTINCT ON (vehicle_id) vehicle_id, next_due_on, next_due_km FROM vehicle_maintenance WHERE tenant_id = ${actor.tenantId} ORDER BY vehicle_id, done_on DESC, created_at DESC`,
    lastPositions(actor.tenantId),
    sql`SELECT vehicle_id, count(*)::int AS n FROM vehicle_devices WHERE tenant_id = ${actor.tenantId} AND active GROUP BY vehicle_id`,
  ]);
  const t = today();
  return vehicles.map((v: Row) => {
    const vd = docs.filter((d: Row) => String(d.vehicle_id) === String(v.id)).map((d: Row) => ({ kind: d.kind, expiresOn: iso(d.expires_on) }));
    const s = services.find((x: Row) => String(x.vehicle_id) === String(v.id));
    const p = positions.find((x: Row) => String(x.vehicle_id) === String(v.id));
    return {
      id: String(v.id), plate: v.plate as string, make: v.make ?? null, model: v.model ?? null, modelYear: num(v.model_year), type: v.vehicle_type as string, status: v.status as string,
      driverId: v.driver_id ? String(v.driver_id) : null, driverName: v.driver_name ?? null, odometerKm: num(v.odometer_km),
      alerts: documentAlerts(vd, t).map((a) => ({ kind: a.kind, level: a.level, daysLeft: a.daysLeft })),
      ...vehicleHealth({ docs: vd, odometerKm: num(v.odometer_km), nextService: s ? { dueOn: iso(s.next_due_on), dueKm: num(s.next_due_km) } : null }, t),
      lastPosition: p ? { at: p.recorded_at, lat: Number(p.lat), lng: Number(p.lng), speedKmh: num(p.speed_kmh), ignition: p.ignition } : null,
      devices: Number(devices.find((x: Row) => String(x.vehicle_id) === String(v.id))?.n ?? 0),
    };
  });
}

/** Everything about one vehicle: documents, maintenance, fuel, assignments, devices, costs, health. */
export async function getVehicle(actor: WorkOrderActor, id: string) {
  await requireFleet(actor);
  const v = await loadVehicle(sql, actor.tenantId, id);
  const [[driver], docs, maintenance, fuel, assignments, devices] = await Promise.all([
    v.driver_id ? sql`SELECT name FROM users WHERE id = ${v.driver_id}` : Promise.resolve([null]),
    sql`SELECT * FROM vehicle_documents WHERE tenant_id = ${actor.tenantId} AND vehicle_id = ${id} ORDER BY kind, expires_on DESC NULLS LAST`,
    sql`SELECT * FROM vehicle_maintenance WHERE tenant_id = ${actor.tenantId} AND vehicle_id = ${id} ORDER BY done_on DESC, created_at DESC`,
    sql`SELECT * FROM vehicle_fuel WHERE tenant_id = ${actor.tenantId} AND vehicle_id = ${id} ORDER BY filled_on DESC, created_at DESC`,
    sql`SELECT a.*, u.name AS driver_name FROM vehicle_assignments a LEFT JOIN users u ON u.id = a.driver_id WHERE a.tenant_id = ${actor.tenantId} AND a.vehicle_id = ${id} AND a.ends_at > now() - interval '60 days' ORDER BY a.starts_at`,
    sql`SELECT id, label, active, last_seen_at, created_at FROM vehicle_devices WHERE tenant_id = ${actor.tenantId} AND vehicle_id = ${id} ORDER BY created_at`,
  ]);
  const entries = [
    ...fuel.map((f: Row) => ({ on: iso(f.filled_on)!, amount: Number(f.amount), kind: 'fuel' as const })),
    ...maintenance.map((m: Row) => ({ on: iso(m.done_on)!, amount: Number(m.amount), kind: 'maintenance' as const })),
  ];
  const odometer = [...fuel.map((f: Row) => num(f.km)), ...maintenance.map((m: Row) => num(m.km)), num(v.odometer_km)].filter((k): k is number => k !== null);
  const next = maintenance[0] ? { dueOn: iso(maintenance[0].next_due_on), dueKm: num(maintenance[0].next_due_km) } : null;
  const docList: Array<ReturnType<typeof docDto>> = docs.map(docDto);
  const conflicts = assignmentConflicts(assignments.map((a: Row) => ({ id: String(a.id), vehicleId: id, startsAt: new Date(a.starts_at).toISOString(), endsAt: new Date(a.ends_at).toISOString(), label: a.title ?? '' })));
  return {
    id: String(v.id), plate: v.plate as string, make: v.make ?? null, model: v.model ?? null, modelYear: num(v.model_year), type: v.vehicle_type as string, status: v.status as string,
    driverId: v.driver_id ? String(v.driver_id) : null, driverName: driver?.name ?? null, odometerKm: num(v.odometer_km), notes: v.notes ?? null, version: Number(v.version),
    documents: docList, current: currentDocuments(docList).map((d) => d.id),
    maintenance: maintenance.map((m: Row) => ({ id: String(m.id), doneOn: iso(m.done_on), km: num(m.km), amount: Number(m.amount), description: m.description, vendor: m.vendor ?? null, nextDueOn: iso(m.next_due_on), nextDueKm: num(m.next_due_km) })),
    fuel: fuel.map((f: Row) => ({ id: String(f.id), filledOn: iso(f.filled_on), liters: Number(f.liters), amount: Number(f.amount), km: num(f.km), fullTank: Boolean(f.full_tank) })),
    assignments: assignments.map((a: Row) => ({ id: String(a.id), kind: a.kind as string, installationId: a.installation_id ? String(a.installation_id) : null, shipmentId: a.shipment_id ? String(a.shipment_id) : null, title: a.title ?? null, startsAt: a.starts_at, endsAt: a.ends_at, driverName: a.driver_name ?? null, conflict: conflicts.some((c) => c.a === String(a.id) || c.b === String(a.id)) })),
    devices: devices.map((d: Row) => ({ id: String(d.id), label: d.label as string, active: Boolean(d.active), lastSeenAt: d.last_seen_at, createdAt: d.created_at })),
    costs: { monthly: monthlyCosts(entries), perKm: costPerKm(entries, odometer), consumptionL100: fuelConsumption(fuel.map((f: Row) => ({ on: iso(f.filled_on)!, liters: Number(f.liters), km: num(f.km), fullTank: Boolean(f.full_tank) }))), total: Math.round(entries.reduce((s, e) => s + e.amount, 0) * 100) / 100 },
    ...vehicleHealth({ docs: docList, odometerKm: num(v.odometer_km), nextService: next }, today()),
  };
}

const VehicleInput = z.object({
  plate: z.string().trim().min(1).max(20),
  make: z.string().trim().max(60).nullish(),
  model: z.string().trim().max(60).nullish(),
  modelYear: z.coerce.number().int().min(1950).max(2100).nullish(),
  type: z.enum(VEHICLE_TYPES).optional(),
  status: z.enum(VEHICLE_STATUSES).optional(),
  driverId: z.string().uuid().nullish(),
  odometerKm: z.coerce.number().int().min(0).max(5_000_000).nullish(),
  notes: z.string().trim().max(2000).nullish(),
}).strict();

export async function createVehicle(actor: WorkOrderActor, raw: unknown) {
  await requireFleet(actor, 'create');
  const d = VehicleInput.parse(raw);
  const plate = normalizePlate(d.plate);
  if (!plate) throw new WorkOrderApiError('Plaka geçerli değil (ör. 34 ABC 123)', 400);
  try {
    return await withTransaction(async (tx: any) => {
      await checkMember(tx, actor.tenantId, d.driverId);
      const [v] = await tx`INSERT INTO vehicles (tenant_id, plate, make, model, model_year, vehicle_type, status, driver_id, odometer_km, notes, created_by)
        VALUES (${actor.tenantId}, ${plate}, ${d.make || null}, ${d.model || null}, ${d.modelYear ?? null}, ${d.type ?? 'van'}, ${d.status ?? 'active'}, ${d.driverId ?? null}, ${d.odometerKm ?? null}, ${d.notes || null}, ${actor.userId}) RETURNING id`;
      await recordAudit(tx, { tenantId: actor.tenantId, actorId: actor.userId, entityType: 'vehicle', entityId: v.id, action: 'created', metadata: { plate } });
      return { id: String(v.id), plate };
    });
  } catch (e: any) {
    if (e?.code === '23505') throw new WorkOrderApiError('Bu plaka zaten kayıtlı', 409);
    throw e;
  }
}

export async function updateVehicle(actor: WorkOrderActor, id: string, raw: unknown) {
  await requireFleet(actor, 'edit');
  const d = VehicleInput.partial().extend({ expectedVersion: z.number().int().optional() }).parse(raw);
  const plate = d.plate === undefined ? undefined : normalizePlate(d.plate);
  if (plate === null) throw new WorkOrderApiError('Plaka geçerli değil (ör. 34 ABC 123)', 400);
  try {
    await withTransaction(async (tx: any) => {
      const before = await loadVehicle(tx, actor.tenantId, id, true);
      if (d.expectedVersion !== undefined && Number(before.version) !== d.expectedVersion) throw new WorkOrderApiError('Araç bu arada değişti; yenileyin', 409);
      await checkMember(tx, actor.tenantId, d.driverId);
      const next = {
        plate: plate ?? before.plate, make: d.make === undefined ? before.make : d.make || null, model: d.model === undefined ? before.model : d.model || null,
        model_year: d.modelYear === undefined ? before.model_year : d.modelYear, vehicle_type: d.type ?? before.vehicle_type, status: d.status ?? before.status,
        driver_id: d.driverId === undefined ? before.driver_id : d.driverId, odometer_km: d.odometerKm === undefined ? before.odometer_km : d.odometerKm, notes: d.notes === undefined ? before.notes : d.notes || null,
      };
      await tx`UPDATE vehicles SET plate = ${next.plate}, make = ${next.make}, model = ${next.model}, model_year = ${next.model_year}, vehicle_type = ${next.vehicle_type}, status = ${next.status},
        driver_id = ${next.driver_id}, odometer_km = ${next.odometer_km}, notes = ${next.notes}, version = version + 1, updated_at = now() WHERE tenant_id = ${actor.tenantId} AND id = ${id}`;
      await recordAudit(tx, { tenantId: actor.tenantId, actorId: actor.userId, entityType: 'vehicle', entityId: id, action: 'updated', changes: changedFields(before, next) });
    });
  } catch (e: any) {
    if (e?.code === '23505') throw new WorkOrderApiError('Bu plaka zaten kayıtlı', 409);
    throw e;
  }
}

const day = z.string().refine(isCalendarDay, 'Geçerli bir gün değil');
const DocInput = z.object({
  kind: z.enum(DOCUMENT_KINDS), number: z.string().trim().max(80).nullish(), issuedOn: day.nullish(), expiresOn: day.nullish(),
  amount: z.coerce.number().min(0).max(1e9).nullish(), attachmentId: z.string().uuid().nullish(), notes: z.string().trim().max(1000).nullish(),
}).strict();
const MaintenanceInput = z.object({
  doneOn: day, km: z.coerce.number().int().min(0).max(5_000_000).nullish(), amount: z.coerce.number().min(0).max(1e9), description: z.string().trim().min(1).max(500),
  vendor: z.string().trim().max(120).nullish(), nextDueOn: day.nullish(), nextDueKm: z.coerce.number().int().min(0).max(5_000_000).nullish(),
}).strict();
const FuelInput = z.object({
  filledOn: day, liters: z.coerce.number().positive().max(2000), amount: z.coerce.number().min(0).max(1e8), km: z.coerce.number().int().min(0).max(5_000_000).nullish(), fullTank: z.boolean().default(true),
}).strict();
const AssignmentInput = z.object({
  kind: z.enum(['installation', 'shipment', 'other']), installationId: z.string().uuid().nullish(), shipmentId: z.string().uuid().nullish(), title: z.string().trim().max(200).nullish(),
  startsAt: z.string().datetime({ offset: true }), endsAt: z.string().datetime({ offset: true }), driverId: z.string().uuid().nullish(),
}).strict();

/** One entry on a vehicle: a document, a maintenance, a fuel fill or an assignment. */
export async function addVehicleEntry(actor: WorkOrderActor, vehicleId: string, raw: unknown) {
  await requireFleet(actor, 'edit');
  const { type, ...body } = z.object({ type: z.enum(['document', 'maintenance', 'fuel', 'assignment']) }).passthrough().parse(raw);
  return withTransaction(async (tx: any) => {
    const v = await loadVehicle(tx, actor.tenantId, vehicleId, true);
    let id: string;
    let extra: Record<string, unknown> = {};
    if (type === 'document') {
      const d = DocInput.parse(body);
      if (d.issuedOn && d.expiresOn && d.expiresOn < d.issuedOn) throw new WorkOrderApiError('Bitiş, başlangıçtan önce olamaz', 400);
      if (d.attachmentId) {
        const [a] = await tx`SELECT 1 FROM record_attachments WHERE tenant_id = ${actor.tenantId} AND id = ${d.attachmentId} AND entity_type = 'vehicle' AND entity_id = ${vehicleId}`;
        if (!a) throw new WorkOrderApiError('Dosya bu araca ait değil', 400);
      }
      [{ id }] = await tx`INSERT INTO vehicle_documents (tenant_id, vehicle_id, kind, number, issued_on, expires_on, amount, attachment_id, notes, created_by)
        VALUES (${actor.tenantId}, ${vehicleId}, ${d.kind}, ${d.number || null}, ${d.issuedOn ?? null}, ${d.expiresOn ?? null}, ${d.amount ?? null}, ${d.attachmentId ?? null}, ${d.notes || null}, ${actor.userId}) RETURNING id`;
      extra = { kind: d.kind, expiresOn: d.expiresOn ?? null };
    } else if (type === 'maintenance') {
      const d = MaintenanceInput.parse(body);
      [{ id }] = await tx`INSERT INTO vehicle_maintenance (tenant_id, vehicle_id, done_on, km, amount, description, vendor, next_due_on, next_due_km, created_by)
        VALUES (${actor.tenantId}, ${vehicleId}, ${d.doneOn}, ${d.km ?? null}, ${d.amount}, ${d.description}, ${d.vendor || null}, ${d.nextDueOn ?? null}, ${d.nextDueKm ?? null}, ${actor.userId}) RETURNING id`;
      if (d.km && (v.odometer_km === null || d.km > Number(v.odometer_km))) await tx`UPDATE vehicles SET odometer_km = ${d.km}, updated_at = now() WHERE id = ${vehicleId}`;
      extra = { amount: d.amount, km: d.km ?? null };
    } else if (type === 'fuel') {
      const d = FuelInput.parse(body);
      [{ id }] = await tx`INSERT INTO vehicle_fuel (tenant_id, vehicle_id, filled_on, liters, amount, km, full_tank, created_by)
        VALUES (${actor.tenantId}, ${vehicleId}, ${d.filledOn}, ${d.liters}, ${d.amount}, ${d.km ?? null}, ${d.fullTank}, ${actor.userId}) RETURNING id`;
      if (d.km && (v.odometer_km === null || d.km > Number(v.odometer_km))) await tx`UPDATE vehicles SET odometer_km = ${d.km}, updated_at = now() WHERE id = ${vehicleId}`;
      extra = { liters: d.liters, amount: d.amount };
    } else {
      const d = AssignmentInput.parse(body);
      if (Date.parse(d.endsAt) <= Date.parse(d.startsAt)) throw new WorkOrderApiError('Bitiş başlangıçtan sonra olmalı', 400);
      if (d.kind === 'installation') {
        if (!d.installationId) throw new WorkOrderApiError('Montaj seçin', 400);
        const [i] = (await tableExists('installations')) ? await tx`SELECT 1 FROM installations WHERE tenant_id = ${actor.tenantId} AND id = ${d.installationId}` : [];
        if (!i) throw new WorkOrderApiError('Montaj bulunamadı', 404);
      }
      if (d.kind === 'shipment') {
        if (!d.shipmentId) throw new WorkOrderApiError('Sevkiyat seçin', 400);
        const [s] = await tx`SELECT 1 FROM shipments WHERE tenant_id = ${actor.tenantId} AND id = ${d.shipmentId}`;
        if (!s) throw new WorkOrderApiError('Sevkiyat bulunamadı', 404);
      }
      await checkMember(tx, actor.tenantId, d.driverId);
      [{ id }] = await tx`INSERT INTO vehicle_assignments (tenant_id, vehicle_id, kind, installation_id, shipment_id, title, starts_at, ends_at, driver_id, created_by)
        VALUES (${actor.tenantId}, ${vehicleId}, ${d.kind}, ${d.installationId ?? null}, ${d.shipmentId ?? null}, ${d.title || null}, ${d.startsAt}, ${d.endsAt}, ${d.driverId ?? v.driver_id ?? null}, ${actor.userId}) RETURNING id`;
      const overlapping = await tx`SELECT id, starts_at, ends_at FROM vehicle_assignments WHERE tenant_id = ${actor.tenantId} AND vehicle_id = ${vehicleId} AND id <> ${id}
        AND starts_at < ${d.endsAt} AND ends_at > ${d.startsAt}`;
      extra = { kind: d.kind, conflicts: overlapping.length };
    }
    await recordAudit(tx, { tenantId: actor.tenantId, actorId: actor.userId, entityType: 'vehicle', entityId: vehicleId, action: `${type}_added`, metadata: { id, ...extra } });
    return { id: String(id), ...(type === 'assignment' ? { conflicts: Number(extra.conflicts) } : {}) };
  });
}

/** Remove an entry (a wrong document, fuel line, maintenance or a cancelled assignment). */
export async function removeVehicleEntry(actor: WorkOrderActor, vehicleId: string, type: string, entryId: string) {
  await requireFleet(actor, 'delete');
  const table = ({ document: 'vehicle_documents', maintenance: 'vehicle_maintenance', fuel: 'vehicle_fuel', assignment: 'vehicle_assignments' } as Record<string, string>)[type];
  if (!table) throw new WorkOrderApiError('Bilinmeyen kayıt türü', 400);
  await withTransaction(async (tx: any) => {
    const [r] = await tx`DELETE FROM ${tx(table)} WHERE tenant_id = ${actor.tenantId} AND vehicle_id = ${vehicleId} AND id = ${entryId} RETURNING id`;
    if (!r) throw new WorkOrderApiError('Kayıt bulunamadı', 404);
    await recordAudit(tx, { tenantId: actor.tenantId, actorId: actor.userId, entityType: 'vehicle', entityId: vehicleId, action: `${type}_removed`, metadata: { id: entryId } });
  });
}

/** Installations and shipments a vehicle can be given to (upcoming). */
export async function assignableJobs(actor: WorkOrderActor) {
  await requireFleet(actor);
  const installations = (await tableExists('installations'))
    ? await sql`SELECT i.id, i.installation_number, i.scheduled_date, i.start_time, i.duration_minutes, o.order_number FROM installations i JOIN orders o ON o.id = i.order_id AND o.tenant_id = i.tenant_id
        WHERE i.tenant_id = ${actor.tenantId} AND i.status IN ('planned', 'in_progress') AND (i.scheduled_date IS NULL OR i.scheduled_date >= current_date - 1) ORDER BY i.scheduled_date NULLS LAST LIMIT 100`
    : [];
  const shipments = await sql`SELECT id, shipment_number, scheduled_date, customer_name FROM shipments WHERE tenant_id = ${actor.tenantId} AND status IN ('draft', 'ready', 'picked_up', 'in_transit') ORDER BY scheduled_date NULLS LAST LIMIT 100`;
  return {
    installations: installations.map((i: Row) => ({ id: String(i.id), label: `${i.installation_number} · ${i.order_number}`, date: iso(i.scheduled_date), startTime: i.start_time ?? null, durationMinutes: Number(i.duration_minutes) })),
    shipments: shipments.map((s: Row) => ({ id: String(s.id), label: `${s.shipment_number} · ${s.customer_name}`, date: iso(s.scheduled_date) })),
  };
}

// Faz B: devices, positions, retention -------------------------------------------------------------

/** A new device token for a vehicle; shown once, only its hash is kept. */
export async function createDevice(actor: WorkOrderActor, vehicleId: string, raw: unknown) {
  await requireFleet(actor, 'edit');
  const { label } = z.object({ label: z.string().trim().min(1).max(80) }).strict().parse(raw);
  const token = randomBytes(32).toString('base64url');
  const id = await withTransaction(async (tx: any) => {
    await loadVehicle(tx, actor.tenantId, vehicleId, true);
    const [d] = await tx`INSERT INTO vehicle_devices (tenant_id, vehicle_id, label, token_hash, created_by) VALUES (${actor.tenantId}, ${vehicleId}, ${label}, ${hashToken(token)}, ${actor.userId}) RETURNING id`;
    await recordAudit(tx, { tenantId: actor.tenantId, actorId: actor.userId, entityType: 'vehicle', entityId: vehicleId, action: 'device_added', metadata: { deviceId: d.id, label } });
    return String(d.id);
  });
  return { id, token };
}

export async function setDeviceActive(actor: WorkOrderActor, vehicleId: string, deviceId: string, active: boolean) {
  await requireFleet(actor, 'edit');
  await withTransaction(async (tx: any) => {
    const [d] = await tx`UPDATE vehicle_devices SET active = ${active} WHERE tenant_id = ${actor.tenantId} AND vehicle_id = ${vehicleId} AND id = ${deviceId} RETURNING id`;
    if (!d) throw new WorkOrderApiError('Cihaz bulunamadı', 404);
    await recordAudit(tx, { tenantId: actor.tenantId, actorId: actor.userId, entityType: 'vehicle', entityId: vehicleId, action: active ? 'device_activated' : 'device_deactivated', metadata: { deviceId } });
  });
}

/** Most points a day's route returns; a busier day is thinned evenly (first and last kept), never cut. */
const ROUTE_POINTS = 20_000;

/** A day's route (Istanbul day): the points, distance, stops and km. */
export async function vehicleRoute(actor: WorkOrderActor, vehicleId: string, dayIso: string) {
  await requireFleet(actor);
  await loadVehicle(sql, actor.tenantId, vehicleId);
  const parsed = day.safeParse(dayIso);
  if (!parsed.success) throw new WorkOrderApiError('Geçerli bir gün seçin', 400);
  const d = parsed.data;
  const rows = await sql`SELECT recorded_at, lat, lng, speed_kmh, heading, ignition, odometer_km, n FROM (
      SELECT *, row_number() OVER (ORDER BY recorded_at) AS rn, count(*) OVER () AS n FROM vehicle_positions
      WHERE tenant_id = ${actor.tenantId} AND vehicle_id = ${vehicleId}
        AND recorded_at >= (${d}::date)::timestamp AT TIME ZONE 'Europe/Istanbul' AND recorded_at < ((${d}::date) + 1)::timestamp AT TIME ZONE 'Europe/Istanbul'
    ) x WHERE n <= ${ROUTE_POINTS} OR rn = n OR (rn - 1) % ceil(n::numeric / ${ROUTE_POINTS})::int = 0
    ORDER BY recorded_at`;
  const points: Position[] = rows.map((r: Row) => ({ at: new Date(r.recorded_at).toISOString(), lat: Number(r.lat), lng: Number(r.lng), speedKmh: num(r.speed_kmh), heading: num(r.heading), ignition: r.ignition, odometerKm: num(r.odometer_km) }));
  const r = routeSummary(points);
  const total = rows.length ? Number(rows[0].n) : 0;
  return { day: d, points, totalPoints: total, sampled: total > points.length, distanceKm: r.distanceKm, stops: r.stops, dailyKm: r.dailyKm };
}

/** Last known position of every vehicle (the live fleet map). */
export async function fleetLive(actor: WorkOrderActor) {
  await requireFleet(actor);
  const rows = await lastPositions(actor.tenantId);
  const [devices] = await sql`SELECT count(*)::int AS n FROM vehicle_devices WHERE tenant_id = ${actor.tenantId} AND active`;
  return {
    devices: Number(devices?.n ?? 0),
    vehicles: rows.map((r: Row) => ({ vehicleId: String(r.vehicle_id), plate: r.plate as string, at: r.recorded_at, lat: Number(r.lat), lng: Number(r.lng), speedKmh: num(r.speed_kmh), ignition: r.ignition })),
  };
}

export async function fleetSettings(actor: WorkOrderActor) {
  await requireFleet(actor);
  const [r] = await sql`SELECT position_retention_days FROM fleet_settings WHERE tenant_id = ${actor.tenantId}`;
  return { retentionDays: r ? num(r.position_retention_days) : 365 };
}

/** Position history retention: 7–3650 days, or null for "süresiz". */
export async function saveFleetSettings(actor: WorkOrderActor, raw: unknown) {
  await requireFleet(actor, 'edit');
  const { retentionDays } = z.object({ retentionDays: z.coerce.number().int().min(7).max(3650).nullable() }).strict().parse(raw);
  const before = await fleetSettings(actor);
  await withTransaction(async (tx: any) => {
    await tx`INSERT INTO fleet_settings (tenant_id, position_retention_days, updated_by) VALUES (${actor.tenantId}, ${retentionDays}, ${actor.userId})
      ON CONFLICT (tenant_id) DO UPDATE SET position_retention_days = EXCLUDED.position_retention_days, updated_by = EXCLUDED.updated_by, updated_at = now()`;
    await recordAudit(tx, { tenantId: actor.tenantId, actorId: actor.userId, entityType: 'tenant_settings', entityId: actor.tenantId, action: 'fleet_retention_changed', changes: { saklamaGün: { from: before.retentionDays, to: retentionDays } } });
  });
  return { retentionDays };
}

export { pruneVehiclePositions } from './retention.server';

/** Dashboard card: how many vehicles are good / need attention / critical, and the worst alerts. */
export async function fleetHealthSummary(actor: WorkOrderActor) {
  type Card = Awaited<ReturnType<typeof listVehicles>>[number];
  const list: Card[] = await listVehicles(actor);
  const live = list.filter((v: Card) => v.status !== 'sold');
  return {
    total: live.length,
    good: live.filter((v: Card) => v.health === 'good').length,
    attention: live.filter((v: Card) => v.health === 'attention').length,
    critical: live.filter((v: Card) => v.health === 'critical').length,
    items: live.filter((v: Card) => v.health !== 'good').sort((a: Card, b: Card) => (a.health === 'critical' ? 0 : 1) - (b.health === 'critical' ? 0 : 1)).slice(0, 5).map((v: Card) => ({ id: v.id, plate: v.plate, health: v.health, reasons: v.reasons.slice(0, 2) })),
  };
}

/**
 * Device ingest (public; the device token is the key): up to 500 points, each checked; invalid ones
 * are counted and dropped, the same point twice is ignored, the device's last-seen is updated.
 */
export async function ingestTelemetry(token: string | null, raw: unknown) {
  if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token) || !(await tableExists('vehicle_devices'))) throw new WorkOrderApiError('Cihaz tanınmadı', 401);
  const [device] = await sql`SELECT id, tenant_id, vehicle_id, active FROM vehicle_devices WHERE token_hash = ${hashToken(token)}`;
  if (!device || !device.active) throw new WorkOrderApiError('Cihaz tanınmadı', 401);
  const limit = await consumeRateLimit('telemetryIngest', String(device.id));
  if (!limit.allowed) throw new WorkOrderApiError('Çok sık gönderim; biraz bekleyin', 429);
  const body = z.object({ positions: z.array(z.object({ t: z.string().max(40), lat: z.number(), lng: z.number(), speed: z.number().nullish(), heading: z.number().nullish(), ignition: z.boolean().nullish(), odometer: z.number().nullish() })).min(1).max(500) }).parse(raw);
  const now = Date.now();
  const rejected: Record<string, number> = {};
  const valid: Position[] = [];
  for (const p of body.positions) {
    const r = checkPosition(p as RawPosition, now);
    if (r.ok) valid.push(r.position); else rejected[r.reason] = (rejected[r.reason] ?? 0) + 1;
  }
  let stored = 0;
  if (valid.length) {
    const rows = await sql`INSERT INTO vehicle_positions ${sql(valid.map((p) => ({
      tenant_id: device.tenant_id, vehicle_id: device.vehicle_id, device_id: device.id, recorded_at: p.at, lat: p.lat, lng: p.lng,
      speed_kmh: p.speedKmh, heading: p.heading, ignition: p.ignition, odometer_km: p.odometerKm === null ? null : Math.round(p.odometerKm),
    })))} ON CONFLICT (device_id, recorded_at) DO NOTHING RETURNING id`;
    stored = rows.length;
    const maxKm = Math.max(...valid.map((p) => p.odometerKm ?? -1));
    // checkPosition caps the odometer (MAX_ODOMETER_KM), so a point in metres is refused, never stored as km.
    if (maxKm >= 0) await sql`UPDATE vehicles SET odometer_km = GREATEST(coalesce(odometer_km, 0), ${Math.round(maxKm)}) WHERE id = ${device.vehicle_id}`;
  }
  await sql`UPDATE vehicle_devices SET last_seen_at = now() WHERE id = ${device.id}`;
  return { received: body.positions.length, stored, duplicates: valid.length - stored, rejected };
}
