"use client";

import { useActionState, type ReactNode } from "react";
import type { FormActionState } from "@/lib/action-state";

const initialState: FormActionState = {};

export function ActionForm({
  action,
  className,
  children,
  submitLabel,
  pendingLabel,
  footer,
}: {
  action: (state: FormActionState, formData: FormData) => Promise<FormActionState>;
  className?: string;
  children: ReactNode;
  submitLabel: string;
  pendingLabel: string;
  footer?: ReactNode;
}) {
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className={className}>
      {children}
      {state.error ? <p className="form-message error" role="alert">{state.error}</p> : null}
      {state.success ? <p className="form-message success" role="status">{state.success}</p> : null}
      {footer !== undefined ? (
        <div className="form-actions">
          {footer}
          <button type="submit" className="button button-primary" disabled={pending}>
            {pending ? pendingLabel : submitLabel}
          </button>
        </div>
      ) : (
        <div className="form-submit-row">
          <button type="submit" className="button button-primary" disabled={pending}>
            {pending ? pendingLabel : submitLabel}
          </button>
        </div>
      )}
    </form>
  );
}
