import { getAllOrgs, getLatestCheckRunForRepo, getReposForOrg } from "@/lib/db";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const session = await getSession();
  const orgs = await getAllOrgs();

  // Pre-load latest run for each repo across all orgs
  const orgsWithRepos = await Promise.all(
    orgs.map(async (org) => {
      const repos = await getReposForOrg(org.id);
      const reposWithRuns = await Promise.all(
        repos.map(async (repo) => {
          const latest = await getLatestCheckRunForRepo(repo.id);
          return { ...repo, latestRun: latest };
        })
      );
      return { ...org, repos: reposWithRuns };
    })
  );

  return (
    <div>
      {orgsWithRepos.length === 0 && (
        <div style={{ background: '#e1f0fa', border: '1px solid #c8e1ff', padding: '16px', borderRadius: '6px', marginBottom: '24px' }}>
          <h3 style={{ margin: '0 0 8px 0', color: '#0366d6' }}>👋 Welcome to PkgDiet!</h3>
          <p style={{ margin: 0 }}>It looks like you haven't completed the setup yet. <a href="/setup" style={{ fontWeight: 'bold', color: '#0366d6' }}>Complete the Setup Wizard &rarr;</a></p>
        </div>
      )}

      <div className="demo-banner">
        ⚠️ <strong>Demo Mode</strong> — authenticated as{" "}
        <strong>{session?.user.email}</strong>. Set{" "}
        <code>AUTH_MODE=github</code> in <code>.env.local</code> to enable real
        GitHub OAuth.
      </div>

      <div className="page-header">
        <h1>Organizations</h1>
        <p>
          All organizations tracked by the PkgDiet GitHub App.
        </p>
      </div>

      {orgsWithRepos.length === 0 ? (
        <div className="empty">
          <p>No organizations synced yet.</p>
          <p>
            Open a pull request in a repo where the GitHub App is installed to
            populate this view.
          </p>
        </div>
      ) : (
        <div className="card-grid">
          {orgsWithRepos.map((org) => {
            const totalRepos = org.repos.length;
            const blocked = org.repos.filter(
              (r) => r.latestRun?.verdict === "BLOCK"
            ).length;
            const warned = org.repos.filter(
              (r) => r.latestRun?.verdict === "WARN"
            ).length;

            return (
              <a
                key={org.id}
                href={`/org/${org.id}`}
                style={{ textDecoration: "none" }}
              >
                <div className="card" style={{ cursor: "pointer" }}>
                  <h2>@{org.slug}</h2>
                  <p>GitHub Org ID: {org.githubOrgId}</p>
                  <div className="meta">
                    <span>📦 {totalRepos} repo{totalRepos !== 1 ? "s" : ""}</span>
                    {blocked > 0 && (
                      <span style={{ color: "var(--red)" }}>
                        🔴 {blocked} blocked
                      </span>
                    )}
                    {warned > 0 && (
                      <span style={{ color: "var(--yellow)" }}>
                        🟡 {warned} warned
                      </span>
                    )}
                    {blocked === 0 && warned === 0 && totalRepos > 0 && (
                      <span style={{ color: "var(--green)" }}>🟢 All clear</span>
                    )}
                  </div>
                  <p style={{ marginTop: 10, fontSize: 12, color: "var(--text-muted)" }}>
                    Synced {new Date(org.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}
