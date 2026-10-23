/** Real PostgreSQL ownership/concurrency checks. No push provider or production data is used. */
import assert from 'node:assert/strict';
import { createECDH, randomBytes, randomUUID } from 'node:crypto';
import postgres from 'postgres';
import { localTestDatabaseURL } from './local-test-database';
async function main() {
  process.env.DATABASE_URL = localTestDatabaseURL();
  process.env.AUTH_SECRET = 'push-ownership-test-only-secret-123456789012';
  delete process.env.VAPID_PRIVATE_KEY;
  const db = postgres(process.env.DATABASE_URL, { onnotice: () => {} });
  assert.equal((await db`SELECT current_database() AS name`)[0].name, 'renkflow_test');
  const { sql } = await import('../lib/db');
  const { savePushSubscription, removePushSubscription } = await import('../lib/notifications/service');
  const users = [];
  try {
    for (let i = 0; i < 2; i++) {
      const [user] = await db`INSERT INTO users(name,email) VALUES('Push ownership test',${randomUUID() + '@example.invalid'}) RETURNING id`;
      users.push(user.id);
    }
    const key = createECDH('prime256v1'); key.generateKeys();
    const subscription = { endpoint: `https://fcm.googleapis.com/fcm/send/${randomUUID()}`, p256dh: key.getPublicKey().toString('base64url'), auth: randomBytes(16).toString('base64url') };
    await savePushSubscription(users[0], { ...subscription, userId: users[0] });
    await assert.rejects(savePushSubscription(users[1], { ...subscription, userId: users[1] }), (e: any) => e.status === 409);
    await removePushSubscription(subscription.endpoint, users[1]);
    assert.equal((await db`SELECT user_id FROM push_subscriptions WHERE endpoint=${subscription.endpoint}`)[0].user_id, users[0]);
    const newAuth = randomBytes(16).toString('base64url');
    await savePushSubscription(users[0], { ...subscription, auth: newAuth, userId: users[0] });
    assert.equal((await db`SELECT auth FROM push_subscriptions WHERE endpoint=${subscription.endpoint}`)[0].auth, newAuth);
    const concurrent = { ...subscription, endpoint: `https://web.push.apple.com/${randomUUID()}` };
    const results = await Promise.allSettled(users.map(userId => savePushSubscription(userId, { ...concurrent, userId })));
    assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
    assert.equal(results.filter(result => result.status === 'rejected' && result.reason.status === 409).length, 1);
    await removePushSubscription(subscription.endpoint, users[0]);
    await removePushSubscription(subscription.endpoint, users[0]);
    assert.equal((await db`SELECT endpoint FROM push_subscriptions WHERE endpoint=${subscription.endpoint}`).length, 0);
    console.log('PASS · push registration ownership, foreign deletion refusal, same-user renewal, concurrent claim, idempotent removal');
  } finally {
    await db`DELETE FROM users WHERE id=ANY(${users}::uuid[])`;
    await db.end();
    await sql.end();
  }
}
main().catch(error => { console.error(error); process.exit(1); });
