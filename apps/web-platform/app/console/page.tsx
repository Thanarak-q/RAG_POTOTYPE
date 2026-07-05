import { PageHeader, Panel } from '@line-rag/ui';

export default function ConsolePage() {
  return (
    <div className="grid">
      <PageHeader title="Tenant Operations" />
      <Panel>
        <p className="muted">
          Platform-only tenant CRUD and impersonation surface.
        </p>
      </Panel>
    </div>
  );
}
