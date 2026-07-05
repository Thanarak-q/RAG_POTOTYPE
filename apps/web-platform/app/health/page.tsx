import { PageHeader, Panel } from '@line-rag/ui';

export default function HealthPage() {
  return (
    <div className="grid">
      <PageHeader title="Health" />
      <Panel>
        <p className="muted">
          Provider health and platform-console access anomalies.
        </p>
      </Panel>
    </div>
  );
}
