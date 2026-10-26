import { useEffect } from 'react';
import { Async } from '../../components/ui/Async';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { PageHeader } from '../../components/ui/PageHeader';
import { Select } from '../../components/ui/Select';
import { StatusChip } from '../../components/ui/StatusChip';
import { api } from '../../lib/api';
import { normTenant } from '../../lib/normalize';
import { toPayload } from '../../lib/payload';
import { useApi } from '../../lib/useApi';
import { required, useForm } from '../../lib/useForm';
import type { CompanySettings } from '../../types';

function timezones(current: string): string[] {
  const supported = typeof Intl.supportedValuesOf === 'function' ? Intl.supportedValuesOf('timeZone') : [];
  const list = supported.includes('UTC') ? supported : ['UTC', ...supported];
  return list.includes(current) ? list : [current, ...list];
}

function SettingsForm({ settings, onSaved }: { settings: CompanySettings; onSaved: () => void }) {
  const form = useForm({ name: settings.name, timezone: settings.timezone });
  const dirty = form.values.name !== settings.name || form.values.timezone !== settings.timezone;

  useEffect(() => {
    form.reset({ name: settings.name, timezone: settings.timezone });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.name, settings.timezone]);

  return (
    <Card title="Company profile">
      <form
        noValidate
        className="max-w-xl space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          void form.submit({
            validate: required(['name', 'Company name'], ['timezone', 'Time zone']),
            action: (values) => api.patch('/tenant', toPayload({ name: values.name.trim(), timezone: values.timezone })),
            success: 'Company settings saved',
            onDone: onSaved,
          });
        }}
      >
        {form.formError && (
          <div role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {form.formError}
          </div>
        )}
        <Input label="Company name" required {...form.bind('name')} />
        <Select
          label="Time zone"
          required
          hint="Used for attendance days and report boundaries."
          options={timezones(settings.timezone).map((zone) => ({ value: zone, label: zone.replace(/_/g, ' ') }))}
          {...form.bind('timezone')}
        />
        {settings.slug && <Input label="Workspace ID" value={settings.slug} readOnly disabled hint="Identifies your workspace and cannot be changed." />}
        <div className="flex items-center gap-3 pt-1">
          <Button type="submit" loading={form.submitting} disabled={!dirty}>
            Save changes
          </Button>
          {dirty && (
            <Button variant="ghost" onClick={() => form.reset({ name: settings.name, timezone: settings.timezone })} disabled={form.submitting}>
              Discard
            </Button>
          )}
        </div>
      </form>
    </Card>
  );
}

export function CompanySettingsPage() {
  const state = useApi(async (signal) => normTenant(await api.get<unknown>('/tenant', undefined, signal)), []);
  return (
    <div>
      <PageHeader
        title="Company settings"
        description="Basic details about your organisation."
        actions={state.data?.status ? <StatusChip status={state.data.status} /> : undefined}
      />
      <Async state={state}>{(settings) => <SettingsForm settings={settings} onSaved={state.reload} />}</Async>
    </div>
  );
}
