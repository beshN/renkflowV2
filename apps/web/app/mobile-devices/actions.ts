'use server';
import {revalidatePath} from 'next/cache';
import {deviceOwner} from './identity';
import {revokeMobileDevice} from '@/lib/features/mobile/sessions';
import {validateMobileDTO} from '@/lib/features/mobile/contract';
export async function revokeDevice(form:FormData) {
 const owner=await deviceOwner(),input=validateMobileDTO('DeviceRevokeInput',{id:form.get('id')}) as {id:string};
 await revokeMobileDevice(owner.userId,owner.tenantId,input.id);revalidatePath('/mobile-devices');
}
