import { useCallback, useState } from 'react';
import { getErrorMessage } from './api';
import { useToast } from '../context/ToastContext';

/** Runs one-off mutations (approve, cancel, mark read…) with toasts and a per-key busy flag. */
export function useAction() {
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);

  const run = useCallback(
    async (key: string, action: () => Promise<unknown>, success?: string, onDone?: () => void): Promise<boolean> => {
      setBusy(key);
      try {
        await action();
        if (success) toast.success(success);
        onDone?.();
        return true;
      } catch (error) {
        toast.error(getErrorMessage(error));
        return false;
      } finally {
        setBusy(null);
      }
    },
    [toast],
  );

  return { run, busy, isBusy: (key: string) => busy === key };
}
