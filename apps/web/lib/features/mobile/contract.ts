import { z } from 'zod';
import contract from '../../../../../contracts/mobile/openapi.json';

export const MIN_APP_VERSION = contract['x-min-app-version'];
export const MOBILE_API_VERSION = contract.info.version;
export function needsUpdate(version: string | null): boolean {
  if (!version || !/^\d+\.\d+\.\d+$/.test(version)) return true;
  const parts = version.split('.').map(Number);
  const minimum = MIN_APP_VERSION.split('.').map(Number);
  if (parts.some(part => !Number.isSafeInteger(part))) return true;
  for (let index = 0; index < 3; index++) {
    if (parts[index] !== minimum[index]) return parts[index] < minimum[index];
  }
  return false;
}
const validators = new Map<string, z.ZodType>();
export function validateMobileDTO(name: keyof typeof contract.components.schemas, value: unknown) {
  if (!validators.has(name)) validators.set(name, z.fromJSONSchema({ $ref: `#/$defs/${name}`, $defs: JSON.parse(JSON.stringify(contract.components.schemas).replaceAll('#/components/schemas/', '#/$defs/')) }));
  return validators.get(name)!.parse(value);
}
