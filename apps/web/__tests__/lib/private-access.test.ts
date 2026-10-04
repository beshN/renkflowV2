import {isPrivateAccessAllowed,privateAccessEmail} from '@/lib/features/auth/private-access';
const previous=process.env.PRIVATE_ACCESS_EMAIL;
afterEach(()=>{if(previous===undefined)delete process.env.PRIVATE_ACCESS_EMAIL;else process.env.PRIVATE_ACCESS_EMAIL=previous;});
it('keeps normal multi-user mode when the private pilot is unset',()=>{delete process.env.PRIVATE_ACCESS_EMAIL;expect(isPrivateAccessAllowed('any@example.invalid')).toBe(true);});
it('only permits the configured account and never accepts missing identities',()=>{process.env.PRIVATE_ACCESS_EMAIL='  DEMO@renkflow.com ';expect(privateAccessEmail()).toBe('demo@renkflow.com');expect(isPrivateAccessAllowed('Demo@RenkFlow.com')).toBe(true);expect(isPrivateAccessAllowed(undefined)).toBe(false);expect(isPrivateAccessAllowed('other@renkflow.com')).toBe(false);});
