import { FormModal } from './FormModal';
import { Textarea } from './Input';
import type { FieldErrors } from '../../lib/formErrors';
import { useForm } from '../../lib/useForm';

interface DecisionModalProps {
  decision: 'approve' | 'reject';
  subject: string;
  /** Reject always needs a reason; approve notes are optional. */
  onConfirm: (note: string) => Promise<unknown>;
  onClose: () => void;
  onDone: () => void;
}

/** Approve / reject dialog that collects a decision note. Mount only while open. */
export function DecisionModal({ decision, subject, onConfirm, onClose, onDone }: DecisionModalProps) {
  const form = useForm({ note: '' });
  const rejecting = decision === 'reject';

  return (
    <FormModal
      open
      size="sm"
      title={rejecting ? 'Reject request' : 'Approve request'}
      description={subject}
      submitLabel={rejecting ? 'Reject' : 'Approve'}
      submitVariant={rejecting ? 'danger' : 'primary'}
      submitting={form.submitting}
      error={form.formError}
      onClose={onClose}
      onSubmit={() =>
        form.submit({
          validate: (values): FieldErrors => (rejecting && !values.note.trim() ? { note: 'Please give a reason' } : {}),
          action: (values) => onConfirm(values.note.trim()),
          success: rejecting ? 'Request rejected' : 'Request approved',
          onDone: () => {
            onDone();
            onClose();
          },
        })
      }
    >
      <Textarea
        label={rejecting ? 'Reason' : 'Note (optional)'}
        required={rejecting}
        autoFocus
        rows={3}
        placeholder={rejecting ? 'Explain why this is being rejected' : 'Add a comment for the requester'}
        {...form.bind('note')}
      />
    </FormModal>
  );
}
