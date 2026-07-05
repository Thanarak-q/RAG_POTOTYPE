export default function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  return (
    <main className="content" style={{ maxWidth: 420, margin: '80px auto' }}>
      <section className="panel">
        <h1>Admin Login</h1>
        <form className="form" action="/api/login" method="post">
          <div className="field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
            />
          </div>
          <button className="button" type="submit">
            Sign in
          </button>
        </form>
        <LoginError searchParams={searchParams} />
      </section>
    </main>
  );
}

async function LoginError({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  return params.error ? <p className="muted">Invalid password.</p> : null;
}
