import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import LoginPage from '@/app/auth/login/page';
import { getProviders, signIn } from 'next-auth/react';
const push=jest.fn(),refresh=jest.fn();
jest.mock('next/navigation',()=>({useRouter:()=>({push,refresh}),useSearchParams:()=>new URLSearchParams('callbackUrl=https%3A%2F%2Funtrusted.example')}));
jest.mock('next-auth/react',()=>({getProviders:jest.fn(),signIn:jest.fn()}));
beforeEach(()=>{jest.clearAllMocks();jest.mocked(getProviders).mockResolvedValue(null);jest.mocked(signIn).mockResolvedValue({ok:true,status:200,error:undefined,code:undefined,url:'/dashboard'});});
it('keeps credentials out of native query strings and blocks submission before hydration',()=>{
 const host=document.createElement('div');host.innerHTML=renderToStaticMarkup(<LoginPage/>);
 expect(host.querySelector('form')?.method).toBe('post');
 expect(host.querySelector<HTMLButtonElement>('button[type="submit"]')?.disabled).toBe(true);
});
it('signs in through Auth.js and rejects an external callback',async()=>{
 render(<LoginPage/>);
 fireEvent.change(screen.getByLabelText(/E-posta adresi/),{target:{value:'DEMO@RENKFLOW.COM'}});
 fireEvent.change(screen.getByLabelText(/^Şifre/,{selector:"input"}),{target:{value:'test-secret'}});
 fireEvent.click(screen.getByRole('button',{name:'Çalışma alanına gir'}));
 await waitFor(()=>expect(push).toHaveBeenCalledWith('/dashboard'));
 expect(signIn).toHaveBeenCalledWith('credentials',{email:'demo@renkflow.com',password:'test-secret',redirect:false,callbackUrl:'/dashboard'});
 expect(refresh).toHaveBeenCalled();
});
