import { useCallback, useState, type ChangeEvent } from 'react';
import { getErrorMessage } from './api';
import { fieldErrors, type FieldErrors } from './formErrors';
import { useToast } from '../context/ToastContext';

type FormValues = Record<string, string>;

interface SubmitOptions<T> {
  /** Return a map of field -> message. Submission is blocked when it is non-empty. */
  validate?: (values: T) => FieldErrors;
  action: (values: T) => Promise<unknown>;
  success?: string;
  onDone?: () => void;
}

/** Small controlled-form helper with inline validation errors and a submit lifecycle. */
export function useForm<T extends FormValues>(initial: T) {
  const toast = useToast();
  const [values, setValues] = useState<T>(initial);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const set = useCallback(<K extends keyof T>(key: K, value: T[K]) => {
    setValues((current) => ({ ...current, [key]: value }));
    setErrors((current) => {
      if (!current[key as string]) return current;
      const { [key as string]: _removed, ...rest } = current;
      return rest;
    });
  }, []);

  const bind = (key: keyof T & string) => ({
    value: values[key],
    error: errors[key],
    onChange: (event: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      set(key, event.target.value as T[typeof key]),
  });

  const reset = useCallback(
    (next?: T) => {
      setValues(next ?? initial);
      setErrors({});
      setFormError(null);
      setSubmitting(false);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const submit = async ({ validate, action, success, onDone }: SubmitOptions<T>) => {
    const found = validate?.(values) ?? {};
    if (Object.keys(found).length > 0) {
      setErrors(found);
      setFormError('Please fix the highlighted fields.');
      return;
    }
    setSubmitting(true);
    setFormError(null);
    try {
      await action(values);
      if (success) toast.success(success);
      onDone?.();
    } catch (error) {
      const serverErrors = fieldErrors(error);
      setErrors(serverErrors);
      setFormError(getErrorMessage(error, 'Could not save. Please try again.'));
    } finally {
      setSubmitting(false);
    }
  };

  return { values, errors, formError, submitting, set, bind, reset, submit, setErrors };
}

export const required =
  (...pairs: [key: string, label: string][]) =>
  (values: FormValues): FieldErrors => {
    const result: FieldErrors = {};
    pairs.forEach(([key, label]) => {
      if (!values[key]?.trim()) result[key] = `${label} is required`;
    });
    return result;
  };
