import { PageHeader, Panel } from '@line-rag/ui';

export default function ConversationsPage() {
  return (
    <div className="grid">
      <PageHeader title="Conversations" />
      <Panel>
        <p className="muted">Tenant-scoped chat logs.</p>
      </Panel>
    </div>
  );
}
