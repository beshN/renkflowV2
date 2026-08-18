"use client";

import { useActionState } from "react";
import { acceptOrganizationInviteAction, type AuthActionState } from "@/app/actions/auth";

const initialState: AuthActionState = {};

export function InviteAcceptForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(acceptOrganizationInviteAction, initialState);
  return (
    <form action={action} className="auth-form">
      <input type="hidden" name="token" value={token} />
      {state.error ? <p className="form-message error" role="alert">{state.error}</p> : null}
      <button type="submit" className="button button-primary" disabled={pending}>
        {pending ? "Davet doğrulanıyor…" : "Daveti kabul et"}
      </button>
    </form>
  );
}
