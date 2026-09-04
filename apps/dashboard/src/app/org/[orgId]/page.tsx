import {
  getOrgById,
  getReposForOrg,
  getLatestCheckRunForRepo,
  getPoliciesForOrg,
} from "@/lib/db";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

function VerdictBadge({ verdict }: { verdict: string | null }) {
  if (!verdict) return <span className="badge" style={{ color: "var(--text-muted)" }}>No runs</span>;
  if (verdict === "BLOCK") return <span className="badge badge-block">🔴 BLOCK</span>;
  if (verdict === "WARN")  return <span className="badge badge-warn">🟡 WARN</span>;
  return <span className="badge badge-allow">🟢 ALLOW</span>;
}

export default async function OrgPage({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const { orgId: orgIdStr } = await params;
  const orgId = Number(orgIdStr);
  const org = await getOrgById(orgId);
  if (!org) notFound();

  const repos = await getReposForOrg(orgId);
  const policies = await getPoliciesForOrg(orgId);
  const orgPolicy = policies.find((p) => !p.repoId);

  const reposWithLatest = await Promise.all(
    repos.map(async (repo) => {
      const latest = await getLatestCheckRunForRepo(repo.id);
      return { ...repo, latestRun: latest };
    })
  );

  return (
    <div>
      <p className="breadcrumb">
        <a href="/">Organizations</a> / @{org.slug}
      </p>

      <div className="page-header">
        <h1>@{org.slug}</h1>
        <p>GitHub Org ID: {org.githubOrgId} · Synced {new Date(org.createdAt).toLocaleDateString()}</p>
      </div>

      {/* Org-level Policy */}
      <p className="section-label">Org Policy</p>
      {orgPolicy ? (
        <pre className="json">
          {JSON.stringify(JSON.parse(orgPolicy.json), null, 2)}
        </pre>
      ) : (
        <div className="card">
          <p style={{ color: "var(--text-muted)" }}>
            No org-level policy configured. Using system defaults.
          </p>
        </div>
      )}

      {/* Repos */}
      <p className="section-label">Repositories ({repos.length})</p>
      {reposWithLatest.length === 0 ? (
        <div className="empty">No repositories tracked yet.</div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Repository</th>
                <th>Latest PR</th>
                <th>Latest Verdict</th>
                <th>Last Check</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {reposWithLatest.map((repo) => (
                <tr key={repo.id}>
                  <td>
                    <strong>{repo.fullName}</strong>
                  </td>
                  <td>
                    {repo.latestRun ? `#${repo.latestRun.prNumber}` : "—"}
                  </td>
                  <td>
                    <VerdictBadge verdict={repo.latestRun?.verdict ?? null} />
                  </td>
                  <td style={{ color: "var(--text-muted)" }}>
                    {repo.latestRun
                      ? new Date(repo.latestRun.createdAt).toLocaleString()
                      : "—"}
                  </td>
                  <td>
                    <a href={`/repo/${repo.id}`}>View →</a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
