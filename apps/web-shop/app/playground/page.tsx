import { PageHeader, Panel } from '@line-rag/ui';

export default function PlaygroundPage() {
  return (
    <div className="grid">
      <PageHeader title="Playground" />
      <Panel>
        <p className="muted">Tenant-only chat tuning surface.</p>
      </Panel>
    </div>
  );
}
