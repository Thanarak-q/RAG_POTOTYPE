import { PageHeader, Panel } from '@line-rag/ui';

export default function LeadsPage() {
  return (
    <div className="grid">
      <PageHeader title="Leads" />
      <Panel>
        <p className="muted">Buying-intent lead inbox.</p>
      </Panel>
    </div>
  );
}
