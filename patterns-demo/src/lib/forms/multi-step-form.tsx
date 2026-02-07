// ============================================
// MULTI-STEP FORM COMPONENT
// React Hook Form + Zod Integration
// ============================================

'use client';

import { useState, useCallback, useMemo } from 'react';
import { useForm, FormProvider, useFormContext, UseFormReturn } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { formSteps, buildSchemaForStep, type StepId } from './schemas';

// ============================================
// TYPES
// ============================================

interface MultiStepFormProps<T extends z.ZodType> {
  schema: T;
  onSubmit: (data: z.infer<T>) => Promise<void>;
  defaultValues?: Partial<z.infer<T>>;
  children: React.ReactNode;
}

interface StepProps {
  children: React.ReactNode;
  stepId: StepId;
}

interface FormFieldProps {
  name: string;
  label: string;
  type?: 'text' | 'email' | 'password' | 'tel' | 'date' | 'select' | 'checkbox' | 'textarea';
  placeholder?: string;
  options?: { value: string; label: string }[];
  className?: string;
}

// ============================================
// CONTEXT
// ============================================

interface MultiStepContextValue {
  currentStep: number;
  totalSteps: number;
  isFirstStep: boolean;
  isLastStep: boolean;
  nextStep: () => Promise<boolean>;
  prevStep: () => void;
  goToStep: (step: number) => void;
  isStepValid: (step: number) => boolean;
  completedSteps: number[];
}

import { createContext, useContext } from 'react';

const MultiStepContext = createContext<MultiStepContextValue | null>(null);

export function useMultiStep() {
  const context = useContext(MultiStepContext);
  if (!context) {
    throw new Error('useMultiStep must be used within MultiStepFormProvider');
  }
  return context;
}

// ============================================
// MULTI-STEP FORM PROVIDER
// ============================================

export function MultiStepFormProvider<T extends z.ZodType>({
  schema,
  onSubmit,
  defaultValues,
  children,
}: MultiStepFormProps<T>) {
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<z.infer<T>>({
    resolver: zodResolver(schema),
    defaultValues: defaultValues as z.infer<T>,
    mode: 'onChange',
  });

  const totalSteps = formSteps.length;
  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === totalSteps - 1;

  const validateCurrentStep = useCallback(async () => {
    const stepSchema = buildSchemaForStep(currentStep);
    const stepFields = formSteps[currentStep].fields;
    
    // Trigger validation only for current step fields
    const results = await Promise.all(
      stepFields.map(field => form.trigger(field as keyof z.infer<T>))
    );
    
    return results.every(Boolean);
  }, [currentStep, form]);

  const nextStep = useCallback(async () => {
    const isValid = await validateCurrentStep();
    
    if (isValid) {
      if (!completedSteps.includes(currentStep)) {
        setCompletedSteps(prev => [...prev, currentStep]);
      }
      
      if (isLastStep) {
        setIsSubmitting(true);
        try {
          await onSubmit(form.getValues());
        } finally {
          setIsSubmitting(false);
        }
      } else {
        setCurrentStep(prev => prev + 1);
      }
      return true;
    }
    return false;
  }, [validateCurrentStep, completedSteps, currentStep, isLastStep, onSubmit, form]);

  const prevStep = useCallback(() => {
    if (!isFirstStep) {
      setCurrentStep(prev => prev - 1);
    }
  }, [isFirstStep]);

  const goToStep = useCallback((step: number) => {
    if (step >= 0 && step < totalSteps) {
      // Only allow going to completed steps or next step
      if (step <= Math.max(...completedSteps, 0) + 1) {
        setCurrentStep(step);
      }
    }
  }, [totalSteps, completedSteps]);

  const isStepValid = useCallback((step: number) => {
    return completedSteps.includes(step);
  }, [completedSteps]);

  const contextValue = useMemo(() => ({
    currentStep,
    totalSteps,
    isFirstStep,
    isLastStep,
    nextStep,
    prevStep,
    goToStep,
    isStepValid,
    completedSteps,
  }), [currentStep, totalSteps, isFirstStep, isLastStep, nextStep, prevStep, goToStep, isStepValid, completedSteps]);

  return (
    <MultiStepContext.Provider value={contextValue}>
      <FormProvider {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* Progress Bar */}
          <StepProgress />
          
          {/* Form Content */}
          <div className="min-h-[300px]">
            {children}
          </div>
          
          {/* Navigation */}
          <StepNavigation isSubmitting={isSubmitting} />
        </form>
      </FormProvider>
    </MultiStepContext.Provider>
  );
}

// ============================================
// STEP COMPONENT
// ============================================

export function Step({ children, stepId }: StepProps) {
  const { currentStep } = useMultiStep();
  const stepIndex = formSteps.findIndex(s => s.id === stepId);
  
  if (stepIndex !== currentStep) {
    return null;
  }

  const stepConfig = formSteps[stepIndex];

  return (
    <div className="space-y-4">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-900">
          {stepConfig.title}
        </h2>
        <p className="text-sm text-gray-500 mt-1">
          {stepConfig.description}
        </p>
      </div>
      {children}
    </div>
  );
}

// ============================================
// FORM FIELD COMPONENT
// ============================================

export function FormField({
  name,
  label,
  type = 'text',
  placeholder,
  options,
  className,
}: FormFieldProps) {
  const { register, formState: { errors } } = useFormContext();
  const error = errors[name];

  const baseInputClasses = `
    w-full px-4 py-2 border rounded-lg transition-colors
    focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
    ${error ? 'border-red-500 bg-red-50' : 'border-gray-300'}
  `;

  return (
    <div className={`space-y-1 ${className}`}>
      <label 
        htmlFor={name} 
        className="block text-sm font-medium text-gray-700"
      >
        {label}
      </label>

      {type === 'select' && options ? (
        <select
          id={name}
          {...register(name)}
          className={baseInputClasses}
        >
          <option value="">Seçin...</option>
          {options.map(opt => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      ) : type === 'checkbox' ? (
        <div className="flex items-center">
          <input
            id={name}
            type="checkbox"
            {...register(name)}
            className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
          />
          <span className="ml-2 text-sm text-gray-600">{placeholder}</span>
        </div>
      ) : type === 'textarea' ? (
        <textarea
          id={name}
          {...register(name)}
          placeholder={placeholder}
          rows={4}
          className={baseInputClasses}
        />
      ) : (
        <input
          id={name}
          type={type}
          {...register(name)}
          placeholder={placeholder}
          className={baseInputClasses}
        />
      )}

      {error && (
        <p className="text-sm text-red-600 mt-1">
          {error.message as string}
        </p>
      )}
    </div>
  );
}

// ============================================
// STEP PROGRESS COMPONENT
// ============================================

function StepProgress() {
  const { currentStep, totalSteps, completedSteps, goToStep } = useMultiStep();

  return (
    <div className="flex items-center justify-between mb-8">
      {formSteps.map((step, index) => {
        const isCompleted = completedSteps.includes(index);
        const isCurrent = index === currentStep;
        const isClickable = index <= Math.max(...completedSteps, 0) + 1;

        return (
          <div key={step.id} className="flex items-center">
            <button
              type="button"
              onClick={() => isClickable && goToStep(index)}
              disabled={!isClickable}
              className={`
                w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium
                transition-all duration-200
                ${isCompleted 
                  ? 'bg-green-500 text-white' 
                  : isCurrent 
                    ? 'bg-blue-500 text-white ring-4 ring-blue-200' 
                    : 'bg-gray-200 text-gray-500'
                }
                ${isClickable ? 'cursor-pointer hover:scale-110' : 'cursor-not-allowed'}
              `}
            >
              {isCompleted ? '✓' : index + 1}
            </button>
            
            {index < totalSteps - 1 && (
              <div 
                className={`
                  w-16 h-1 mx-2
                  ${isCompleted ? 'bg-green-500' : 'bg-gray-200'}
                `}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ============================================
// STEP NAVIGATION COMPONENT
// ============================================

interface StepNavigationProps {
  isSubmitting: boolean;
}

function StepNavigation({ isSubmitting }: StepNavigationProps) {
  const { isFirstStep, isLastStep, nextStep, prevStep } = useMultiStep();

  return (
    <div className="flex justify-between pt-6 border-t">
      <button
        type="button"
        onClick={prevStep}
        disabled={isFirstStep}
        className={`
          px-6 py-2 rounded-lg font-medium transition-colors
          ${isFirstStep 
            ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }
        `}
      >
        Geri
      </button>

      <button
        type="button"
        onClick={nextStep}
        disabled={isSubmitting}
        className={`
          px-6 py-2 rounded-lg font-medium transition-colors
          ${isSubmitting 
            ? 'bg-blue-300 cursor-wait' 
            : 'bg-blue-500 text-white hover:bg-blue-600'
          }
        `}
      >
        {isSubmitting ? (
          <span className="flex items-center">
            <svg className="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Gönderiliyor...
          </span>
        ) : isLastStep ? (
          'Tamamla'
        ) : (
          'İleri'
        )}
      </button>
    </div>
  );
}

// ============================================
// FIELD ARRAY COMPONENT (for dynamic fields)
// ============================================

interface FieldArrayProps {
  name: string;
  label: string;
  maxItems?: number;
  renderItem: (index: number) => React.ReactNode;
}

export function FieldArray({ name, label, maxItems = 5, renderItem }: FieldArrayProps) {
  const { watch, setValue } = useFormContext();
  const items = watch(name) || [];

  const addItem = () => {
    if (items.length < maxItems) {
      setValue(name, [...items, {}]);
    }
  };

  const removeItem = (index: number) => {
    setValue(name, items.filter((_: unknown, i: number) => i !== index));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <label className="block text-sm font-medium text-gray-700">{label}</label>
        <button
          type="button"
          onClick={addItem}
          disabled={items.length >= maxItems}
          className="text-sm text-blue-500 hover:text-blue-700 disabled:text-gray-400"
        >
          + Ekle
        </button>
      </div>
      
      {items.map((_: unknown, index: number) => (
        <div key={index} className="flex gap-4 items-start">
          <div className="flex-1">{renderItem(index)}</div>
          <button
            type="button"
            onClick={() => removeItem(index)}
            className="mt-6 text-red-500 hover:text-red-700"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
