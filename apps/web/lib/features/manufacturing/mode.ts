import 'server-only';

export function isNativeInventoryEnabled() {
  return process.env.NATIVE_INVENTORY_ENABLED === '1';
}

export function assertNativeInventoryEnabled() {
  if (!isNativeInventoryEnabled()) {
    throw new Error('Native stok motoru kapalı. NATIVE_INVENTORY_ENABLED=1 olarak etkinleştirin.');
  }
}
