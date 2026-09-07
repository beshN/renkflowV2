import { runNativeManufacturingPilot } from '../lib/features/manufacturing/pilot.service';

async function main() {
  const tenantId = process.env.PILOT_TENANT_ID;
  const userId = process.env.PILOT_USER_ID;
  const orderId = process.env.PILOT_ORDER_ID;
  if (!tenantId || !userId || !orderId) {
    throw new Error('PILOT_TENANT_ID, PILOT_USER_ID ve PILOT_ORDER_ID zorunludur');
  }
  const result = await runNativeManufacturingPilot({ tenantId, userId }, orderId);
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
