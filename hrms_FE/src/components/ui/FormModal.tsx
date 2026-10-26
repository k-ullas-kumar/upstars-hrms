import { useId, type FormEvent, type ReactNode } from 'react';
import { AlertCircle } from 'lucide-react';
import { Button, type ButtonVariant } from './Button';
import { Modal } from './Modal';

interface FormModalProps {
  open: boolean;
  title: string;
  description?: string;
  submitLabel?: string;
  submitVariant?: ButtonVariant;
  submitting?: boolean;
  /** Shown in an inline banner above the fields (server or validation summary). */
  error?: string | null;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  onClose: () => void;
  onSubmit: () => void;
  children: ReactNode;
}

/** Modal wrapping a <form>: Enter submits, errors render inline, submit shows a spinner. */
export function FormModal({
  open,
  title,
  description,
  submitLabel = 'Save',
  submitVariant = 'primary',
  submitting,
  error,
  size = 'md',
  onClose,
  onSubmit,
  children,
}: FormModalProps) {
  const formId = useId();

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    onSubmit();
  };

  return (
    <Modal
      open={open}
      title={title}
      description={description}
      size={size}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" form={formId} variant={submitVariant} loading={submitting}>
            {submitLabel}
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={handleSubmit} noValidate className="space-y-4">
        {error && (
          <div role="alert" className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <span>{error}</span>
          </div>
        )}
        {children}
      </form>
    </Modal>
  );
}
