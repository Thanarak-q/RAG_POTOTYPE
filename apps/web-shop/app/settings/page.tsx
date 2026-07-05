import { PageHeader, Panel } from '@line-rag/ui';

export default function SettingsPage() {
  return (
    <div className="grid">
      <PageHeader title="Settings" />
      <Panel>
        <p className="muted">
          Shop persona, tone, owner LINE ID, and privacy policy URL.
        </p>
      </Panel>
    </div>
  );
}
