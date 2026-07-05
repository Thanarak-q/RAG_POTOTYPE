import { PageHeader, Panel } from '@line-rag/ui';

export default function UsagePage() {
  return (
    <div className="grid">
      <PageHeader title="Usage" />
      <Panel>
        <p className="muted">
          Messages, token usage, cost, and error rate by tenant.
        </p>
      </Panel>
    </div>
  );
}
