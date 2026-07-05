import { PageHeader, Panel } from '@line-rag/ui';

export default function SettingsPage() {
  return (
    <div className="grid">
      <PageHeader title="Platform Settings" />
      <Panel>
        <p className="muted">
          Model tiers, release gates, and ops-only defaults.
        </p>
      </Panel>
    </div>
  );
}
