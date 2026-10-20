/**
 * Integration test for the fleet (gece 2, Tur 3) on the isolated local test database only: add a
 * vehicle, a document, see the expiry warning, give the vehicle to an installation (conflict),
 * a fake device POST lands on the map, every other role sees nothing, retention clean-up.
 */
import assert from 'node:assert/strict';
import postgres from 'postgres';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { localTestDatabaseURL } from './local-test-database';

async function main() {
  process.env.AUTH_SECRET = 'integration-test-secret-local-only-1234567890';
  process.env.DATABASE_URL = localTestDatabaseURL();
  const db = postgres(process.env.DATABASE_URL, { onnotice: () => {} });
  assert.equal((await db`SELECT current_database() AS name`)[0].name, 'renkflow_test');
  for (const file of ['044_access_control.sql', '045_sales_service_chain.sql', '046_fleet.sql', '046_fleet.sql'])
    await db.unsafe(readFileSync(`lib/db/migrations/${file}`, 'utf8'));

  const fleet = await import('../lib/features/fleet/fleet.server');
  const inst = await import('../lib/features/field/installations.server');
  const access = await import('../lib/security/member-access.server');
  const { routeRequirement } = await import('../lib/security/access-matrix');
  const team = await import('../lib/security/team.server');
  const records = await import('../lib/features/records/registry');
  const { sql: appSql } = await import('../lib/db');

  const tenantId = randomUUID();
  const ids: Record<string, string> = {};
  await db`INSERT INTO tenants (id, name, slug) VALUES (${tenantId}, 'Filo Test', ${'fleet-' + tenantId.slice(0, 8)})`;
  for (const role of ['owner', 'admin', 'office', 'accountant', 'worker', 'member']) {
    ids[role] = randomUUID();
    await db`INSERT INTO users (id, email, name) VALUES (${ids[role]}, ${`${role}-${ids[role]}@test.local`}, ${role})`;
    await db`INSERT INTO tenant_members (tenant_id, user_id, role) VALUES (${tenantId}, ${ids[role]}, ${role})`;
  }
  const actor = (role: string) => ({ tenantId, userId: ids[role], role: role as any });
  const owner = actor('owner');

  // Add a vehicle (plate normalized, unique) and a document that expires in 10 days.
  await assert.rejects(fleet.createVehicle(owner, { plate: 'ABC' }), /Plaka/);
  const v = await fleet.createVehicle(owner, { plate: '34 rf 2026', make: 'Ford', model: 'Transit', type: 'van', driverId: ids.worker, odometerKm: 82000 });
  assert.equal(v.plate, '34RF2026');
  await assert.rejects(fleet.createVehicle(owner, { plate: '34RF 2026' }), /zaten/);
  await assert.rejects(fleet.createVehicle(owner, { plate: '34 rf 2026' }), /zaten/, 'lowercase input is the same plate');
  const inTen = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Istanbul' }).format(new Date(Date.now() + 10 * 86_400_000));
  await fleet.addVehicleEntry(owner, v.id, { type: 'document', kind: 'inspection', number: 'M-1', expiresOn: inTen });
  await fleet.addVehicleEntry(owner, v.id, { type: 'document', kind: 'traffic_insurance', expiresOn: '2027-06-01' });
  await fleet.addVehicleEntry(owner, v.id, { type: 'maintenance', doneOn: '2026-09-01', km: 80000, amount: 6500, description: 'Periyodik bakım', nextDueKm: 82500 });
  await fleet.addVehicleEntry(owner, v.id, { type: 'fuel', filledOn: '2026-09-10', liters: 60, amount: 2700, km: 81000, fullTank: true });
  await fleet.addVehicleEntry(owner, v.id, { type: 'fuel', filledOn: '2026-10-01', liters: 55, amount: 2500, km: 81600, fullTank: true });
  let list = await fleet.listVehicles(owner);
  assert.equal(list[0].alerts[0].level, 'd15', 'inspection warns at 15 days');
  assert.equal(list[0].health, 'attention');
  assert.ok(list[0].reasons.some((r: string) => /Bakıma 500 km/.test(r)));
  let detail = await fleet.getVehicle(owner, v.id);
  assert.equal(detail.costs.monthly.length, 2);
  assert.equal(detail.costs.consumptionL100, 9.2);
  assert.equal(detail.odometerKm, 82000);

  // Give the vehicle to an installation; a second overlapping job is a conflict (warned, not blocked).
  const [order] = await db`INSERT INTO orders (tenant_id, order_number, customer_name, status, total_amount, product_name) VALUES (${tenantId}, ${'ORD-F-' + tenantId.slice(0, 6)}, 'Filo Müşteri', 'approved', 0, 'Pergola') RETURNING id`;
  const plan = await inst.planInstallation(owner as any, String(order.id), { date: '2026-10-20', startTime: '09:00' });
  const a1 = await fleet.addVehicleEntry(owner, v.id, { type: 'assignment', kind: 'installation', installationId: plan.id, startsAt: '2026-10-20T09:00:00+03:00', endsAt: '2026-10-20T13:00:00+03:00' });
  assert.equal(a1.conflicts, 0);
  const a2 = await fleet.addVehicleEntry(owner, v.id, { type: 'assignment', kind: 'other', title: 'Malzeme alımı', startsAt: '2026-10-20T12:00:00+03:00', endsAt: '2026-10-20T14:00:00+03:00' });
  assert.equal(a2.conflicts, 1);
  detail = await fleet.getVehicle(owner, v.id);
  assert.equal(detail.assignments.filter((a: any) => a.conflict).length, 2);
  await assert.rejects(fleet.addVehicleEntry(owner, v.id, { type: 'assignment', kind: 'installation', installationId: randomUUID(), startsAt: '2026-10-21T09:00:00Z', endsAt: '2026-10-21T10:00:00Z' }), /bulunamadı/);

  // A device and a fake telemetry POST: points land on the live map; duplicates and bad points are not stored.
  const device = await fleet.createDevice(owner, v.id, { label: 'Test cihazı' });
  const [stored] = await db`SELECT token_hash FROM vehicle_devices WHERE id = ${device.id}`;
  assert.notEqual(stored.token_hash, device.token);
  // The route is read per Istanbul day: just after midnight, points from the last hour would
  // straddle two days, so start them before midnight then.
  const [hh, mm] = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Istanbul', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date()).split(':').map(Number);
  const minutesIntoDay = hh * 60 + mm;
  const now = Date.now() - (minutesIntoDay < 65 ? (minutesIntoDay + 5) * 60_000 : 0);
  const t = (min: number) => new Date(now - min * 60_000).toISOString();
  const positions = [
    { t: t(60), lat: 41.0, lng: 29.0, speed: 0, ignition: true, odometer: 82010 },
    { t: t(50), lat: 41.03, lng: 29.0, speed: 40, ignition: true },
    { t: t(40), lat: 41.06, lng: 29.0, speed: 40, ignition: true, odometer: 82017 },
    { t: t(30), lat: 0, lng: 0 },
    { t: new Date(Date.now() + 3_600_000).toISOString(), lat: 41, lng: 29 },
  ];
  const r1 = await fleet.ingestTelemetry(device.token, { positions });
  assert.deepEqual([r1.stored, r1.rejected], [3, { koordinat: 1, 'gelecek zaman': 1 }]);
  const r2 = await fleet.ingestTelemetry(device.token, { positions: positions.slice(0, 3) });
  assert.deepEqual([r2.stored, r2.duplicates], [0, 3]);
  await assert.rejects(fleet.ingestTelemetry('x'.repeat(43), { positions }), (e: any) => e.status === 401);
  await assert.rejects(fleet.ingestTelemetry(null, { positions }), (e: any) => e.status === 401);
  const live = await fleet.fleetLive(owner);
  assert.equal(live.vehicles[0].plate, '34RF2026');
  assert.equal(live.vehicles[0].lat, 41.06);
  const today = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Istanbul' }).format(new Date(now - 40 * 60_000));
  const route = await fleet.vehicleRoute(owner, v.id, today);
  assert.equal(route.points.length, 3);
  assert.ok(Math.abs(route.distanceKm - 6.7) < 0.2, `route ${route.distanceKm} km`);
  assert.deepEqual([route.totalPoints, route.sampled], [3, false]);
  await assert.rejects(fleet.vehicleRoute(owner, v.id, '2026-02-30'), (e: any) => e.status === 400, 'impossible day is a 400');
  // An odometer in metres is refused; the vehicle's km does not jump.
  const r3 = await fleet.ingestTelemetry(device.token, { positions: [{ t: t(5), lat: 41.07, lng: 29.0, odometer: 3_000_000_000 }] });
  assert.deepEqual([r3.stored, r3.rejected], [0, { km: 1 }]);
  assert.equal((await fleet.getVehicle(owner, v.id)).odometerKm, 82017, 'device odometer moves the vehicle forward');
  // A turned-off device's token stops working.
  await fleet.setDeviceActive(owner, v.id, device.id, false);
  await assert.rejects(fleet.ingestTelemetry(device.token, { positions }), (e: any) => e.status === 401);

  // Nobody but owner and admin sees the fleet: service layer, proxy route map, page roles.
  assert.ok(await fleet.listVehicles(actor('admin')));
  for (const role of ['office', 'accountant', 'worker', 'member']) {
    await assert.rejects(fleet.listVehicles(actor(role)), (e: any) => e.status === 404, `${role} sees the fleet`);
    await assert.rejects(fleet.getVehicle(actor(role), v.id), (e: any) => e.status === 404);
    await assert.rejects(fleet.createVehicle(actor(role), { plate: '06AB123' }), (e: any) => e.status === 404);
    const a = await access.resolveMemberAccess(ids[role], tenantId);
    assert.ok(!(a!.permissions.fleet ?? []).length, `${role} has no fleet cell`);
  }
  assert.deepEqual(routeRequirement('/api/v1/vehicles', 'GET'), { module: 'fleet', action: 'view' });
  assert.deepEqual(routeRequirement('/vehicles/x', 'GET'), { module: 'fleet', action: 'view' });
  const { canAccessRoute } = await import('../lib/features/auth/permissions');
  assert.deepEqual(['owner', 'admin', 'office', 'accountant', 'worker', 'member'].map((r) => canAccessRoute(r as any, '/vehicles')), [true, true, false, false, false, false]);

  // An admin whose custom role leaves the fleet out sees neither the fleet nor the vehicle record.
  const noFleet = await team.saveRole(owner as any, null, { name: 'Filosuz yönetici', base: 'admin', permissions: { orders: ['view'] }, hidden: [] });
  await team.updateMember(owner as any, ids.admin, { accessRole: noFleet });
  access.forgetMemberAccess(ids.admin, tenantId);
  await assert.rejects(fleet.listVehicles(actor('admin')), (e: any) => e.status === 404);
  await assert.rejects(records.openRecord(appSql, actor('admin') as any, 'vehicle', v.id), (e: any) => e.status === 404, 'record platform honours the fleet cell');
  assert.ok(await records.openRecord(appSql, owner as any, 'vehicle', v.id));
  await team.updateMember(owner as any, ids.admin, { accessRole: null });
  access.forgetMemberAccess(ids.admin, tenantId);

  // Retention: positions older than the firm's setting go; "süresiz" keeps them.
  await db`INSERT INTO vehicle_positions (tenant_id, vehicle_id, device_id, recorded_at, lat, lng) VALUES (${tenantId}, ${v.id}, ${device.id}, now() - interval '400 days', 41, 29)`;
  await fleet.saveFleetSettings(owner, { retentionDays: null });
  await fleet.pruneVehiclePositions();
  assert.equal((await db`SELECT count(*)::int AS n FROM vehicle_positions WHERE tenant_id = ${tenantId}`)[0].n, 4);
  await fleet.saveFleetSettings(owner, { retentionDays: 365 });
  await fleet.pruneVehiclePositions();
  assert.equal((await db`SELECT count(*)::int AS n FROM vehicle_positions WHERE tenant_id = ${tenantId}`)[0].n, 3);

  // The dashboard card and the audit trail.
  // A second vehicle with an expired inspection is critical and is listed first.
  const v2 = await fleet.createVehicle(owner, { plate: '01 B 99' });
  await fleet.addVehicleEntry(owner, v2.id, { type: 'document', kind: 'inspection', expiresOn: '2026-01-01' });
  const health = await fleet.fleetHealthSummary(owner);
  assert.equal(health.total, 2);
  assert.equal(health.items[0].plate, '01B99', 'critical first');
  const actions = (await db`SELECT DISTINCT action FROM activity_logs WHERE tenant_id = ${tenantId} AND entity_type = 'vehicle'`).map((r) => r.action);
  for (const want of ['created', 'document_added', 'maintenance_added', 'fuel_added', 'assignment_added', 'device_added', 'device_deactivated']) assert.ok(actions.includes(want), `audit has ${want}`);

  await db`DELETE FROM tenants WHERE id = ${tenantId}`;
  await db`DELETE FROM users WHERE id = ANY(${Object.values(ids)}::uuid[])`;
  await db.end();
  await (appSql as any).end?.();
  console.log('test:fleet OK');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
