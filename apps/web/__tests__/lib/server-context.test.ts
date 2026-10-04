import {auth} from '@/auth';
import {sql} from '@/lib/db';
import {getServerUserContext,AuthenticationError,requirePermission} from '@/lib/features/auth/serverAuth';
jest.mock('@/auth',()=>({auth:jest.fn()}));
jest.mock('@/lib/db',()=>({sql:jest.fn()}));
beforeEach(()=>{(auth as jest.Mock).mockResolvedValue({user:{id:'user',tenantId:'tenant',role:'owner',email:'test@example.invalid'}});});
it('uses the current membership role after an administrator is demoted',async()=>{
 (sql as unknown as jest.Mock).mockResolvedValue([{role:'worker'}]);
 const context=await getServerUserContext();expect(context.role).toBe('worker');
 expect(()=>requirePermission(context,'finance.view')).toThrow();
});
it('rejects an old signed session after membership removal',async()=>{
 (sql as unknown as jest.Mock).mockResolvedValue([]);
 await expect(getServerUserContext()).rejects.toBeInstanceOf(AuthenticationError);
});
