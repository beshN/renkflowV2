// ============================================
// CONTEXT API + useReducer PATTERN
// For Server Component Compatible State
// ============================================

'use client';

import {
  createContext,
  useContext,
  useReducer,
  useCallback,
  useMemo,
  type ReactNode,
  type Dispatch,
} from 'react';

// ============================================
// TYPES
// ============================================

interface FormState {
  values: Record<string, unknown>;
  errors: Record<string, string>;
  touched: Record<string, boolean>;
  isSubmitting: boolean;
  isValid: boolean;
}

type FormAction =
  | { type: 'SET_VALUE'; field: string; value: unknown }
  | { type: 'SET_ERROR'; field: string; error: string }
  | { type: 'SET_TOUCHED'; field: string }
  | { type: 'SET_SUBMITTING'; isSubmitting: boolean }
  | { type: 'VALIDATE'; isValid: boolean }
  | { type: 'RESET'; initialValues?: Record<string, unknown> }
  | { type: 'SET_VALUES'; values: Record<string, unknown> }
  | { type: 'SET_ERRORS'; errors: Record<string, string> };

// ============================================
// REDUCER
// ============================================

function formReducer(state: FormState, action: FormAction): FormState {
  switch (action.type) {
    case 'SET_VALUE':
      return {
        ...state,
        values: { ...state.values, [action.field]: action.value },
      };
      
    case 'SET_ERROR':
      return {
        ...state,
        errors: { ...state.errors, [action.field]: action.error },
      };
      
    case 'SET_TOUCHED':
      return {
        ...state,
        touched: { ...state.touched, [action.field]: true },
      };
      
    case 'SET_SUBMITTING':
      return {
        ...state,
        isSubmitting: action.isSubmitting,
      };
      
    case 'VALIDATE':
      return {
        ...state,
        isValid: action.isValid,
      };
      
    case 'RESET':
      return {
        values: action.initialValues ?? {},
        errors: {},
        touched: {},
        isSubmitting: false,
        isValid: true,
      };
      
    case 'SET_VALUES':
      return {
        ...state,
        values: action.values,
      };
      
    case 'SET_ERRORS':
      return {
        ...state,
        errors: action.errors,
        isValid: Object.keys(action.errors).length === 0,
      };
      
    default:
      return state;
  }
}

// ============================================
// CONTEXT
// ============================================

interface FormContextValue {
  state: FormState;
  dispatch: Dispatch<FormAction>;
  // Helper methods
  setValue: (field: string, value: unknown) => void;
  setError: (field: string, error: string) => void;
  setTouched: (field: string) => void;
  reset: (initialValues?: Record<string, unknown>) => void;
  getFieldProps: (field: string) => {
    value: unknown;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onBlur: () => void;
    error: string | undefined;
  };
}

const FormContext = createContext<FormContextValue | null>(null);

// ============================================
// PROVIDER
// ============================================

interface FormProviderProps {
  children: ReactNode;
  initialValues?: Record<string, unknown>;
  onSubmit?: (values: Record<string, unknown>) => Promise<void>;
}

export function FormProvider({ 
  children, 
  initialValues = {} 
}: FormProviderProps) {
  const [state, dispatch] = useReducer(formReducer, {
    values: initialValues,
    errors: {},
    touched: {},
    isSubmitting: false,
    isValid: true,
  });

  const setValue = useCallback((field: string, value: unknown) => {
    dispatch({ type: 'SET_VALUE', field, value });
  }, []);

  const setError = useCallback((field: string, error: string) => {
    dispatch({ type: 'SET_ERROR', field, error });
  }, []);

  const setTouched = useCallback((field: string) => {
    dispatch({ type: 'SET_TOUCHED', field });
  }, []);

  const reset = useCallback((initialValues?: Record<string, unknown>) => {
    dispatch({ type: 'RESET', initialValues });
  }, []);

  const getFieldProps = useCallback((field: string) => ({
    value: state.values[field] ?? '',
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
      setValue(field, e.target.value);
    },
    onBlur: () => {
      setTouched(field);
    },
    error: state.touched[field] ? state.errors[field] : undefined,
  }), [state.values, state.errors, state.touched, setValue, setTouched]);

  const value = useMemo(() => ({
    state,
    dispatch,
    setValue,
    setError,
    setTouched,
    reset,
    getFieldProps,
  }), [state, setValue, setError, setTouched, reset, getFieldProps]);

  return (
    <FormContext.Provider value={value}>
      {children}
    </FormContext.Provider>
  );
}

// ============================================
// HOOK
// ============================================

export function useFormContext() {
  const context = useContext(FormContext);
  if (!context) {
    throw new Error('useFormContext must be used within FormProvider');
  }
  return context;
}

// ============================================
// MODAL CONTEXT EXAMPLE
// ============================================

type ModalType = 'confirm' | 'alert' | 'custom';

interface ModalState {
  isOpen: boolean;
  type: ModalType | null;
  title: string;
  content: ReactNode;
  onConfirm?: () => void;
  onCancel?: () => void;
}

type ModalAction =
  | { type: 'OPEN'; payload: Omit<ModalState, 'isOpen'> }
  | { type: 'CLOSE' };

function modalReducer(state: ModalState, action: ModalAction): ModalState {
  switch (action.type) {
    case 'OPEN':
      return { ...action.payload, isOpen: true };
    case 'CLOSE':
      return { ...state, isOpen: false };
    default:
      return state;
  }
}

const ModalContext = createContext<{
  state: ModalState;
  openModal: (config: Omit<ModalState, 'isOpen'>) => void;
  closeModal: () => void;
  confirm: (title: string, content: ReactNode) => Promise<boolean>;
} | null>(null);

export function ModalProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(modalReducer, {
    isOpen: false,
    type: null,
    title: '',
    content: null,
  });

  const openModal = useCallback((config: Omit<ModalState, 'isOpen'>) => {
    dispatch({ type: 'OPEN', payload: config });
  }, []);

  const closeModal = useCallback(() => {
    dispatch({ type: 'CLOSE' });
  }, []);

  const confirm = useCallback((title: string, content: ReactNode): Promise<boolean> => {
    return new Promise((resolve) => {
      openModal({
        type: 'confirm',
        title,
        content,
        onConfirm: () => {
          closeModal();
          resolve(true);
        },
        onCancel: () => {
          closeModal();
          resolve(false);
        },
      });
    });
  }, [openModal, closeModal]);

  const value = useMemo(() => ({
    state,
    openModal,
    closeModal,
    confirm,
  }), [state, openModal, closeModal, confirm]);

  return (
    <ModalContext.Provider value={value}>
      {children}
    </ModalContext.Provider>
  );
}

export function useModal() {
  const context = useContext(ModalContext);
  if (!context) {
    throw new Error('useModal must be used within ModalProvider');
  }
  return context;
}

// ============================================
// COMBINED PROVIDERS
// ============================================

interface ProvidersProps {
  children: ReactNode;
}

export function StateProviders({ children }: ProvidersProps) {
  return (
    <ModalProvider>
      {children}
    </ModalProvider>
  );
}
