export const dynamic = 'force-dynamic';

export default function SuperTenantsPage() {
  return (
    <div className="grid">
      <header className="page-header">
        <h1>Tenants</h1>
      </header>
      <section className="panel">
        <table className="table">
          <thead>
            <tr>
              <th>Company</th>
              <th>Plan</th>
              <th>Status</th>
              <th>Messages Today</th>
              <th>Cost</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Seed shop</td>
              <td>trial</td>
              <td>
                <span className="badge">active</span>
              </td>
              <td>0</td>
              <td>$0.00</td>
            </tr>
          </tbody>
        </table>
      </section>
    </div>
  );
}
