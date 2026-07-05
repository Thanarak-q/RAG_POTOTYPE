import { PageHeader, Panel } from '@line-rag/ui';

export default function ProductsPage() {
  return (
    <div className="grid">
      <PageHeader title="Products" />
      <Panel>
        <p className="muted">
          Tenant-scoped product catalog. Platform routes are not bundled in this
          app.
        </p>
      </Panel>
    </div>
  );
}
