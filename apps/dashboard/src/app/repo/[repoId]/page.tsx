import {
  getRepoById,
  getCheckRunsForRepo,
  getFinOpsMetrics,
  getPoliciesForOrg,
} from "@/lib/db";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

function VerdictBadge({ verdict }: { verdict: string }) {
  if (verdict === "BLOCK") return <span className="badge badge-block">🔴 BLOCK</span>;
  if (verdict === "WARN")  return <span className="badge badge-warn">🟡 WARN</span>;
  return <span className="badge badge-allow">🟢 ALLOW</span>;
}

function DepRow({ dep, evalResult }: { dep: any; evalResult: any }) {
  const icon = evalResult.verdict === "BLOCK" ? "🔴" : evalResult.verdict === "WARN" ? "🟡" : "🟢";
  const alts = (evalResult.alternatives ?? [])
    .map((a: any) => (typeof a === "string" ? a : a.replacement ?? a.name ?? ""))
    .filter(Boolean)
    .join(", ");
  return (
    <tr>
      <td><code>{dep.name}</code> <span style={{ color: "var(--text-muted)", fontSize: 11 }}>v{dep.version}</span></td>
      <td>{icon} {evalResult.verdict}</td>
      <td>{evalResult.healthScore ?? "—"}</td>
      <td>{evalResult.costEstimate?.addedSizeMB?.toFixed(2) ?? "—"} MB</td>
      <td style={{ color: "var(--text-muted)", fontSize: 12 }}>{alts || "—"}</td>
      <td style={{ color: "var(--text-muted)", fontSize: 12, maxWidth: 240 }}>{evalResult.reasons?.join("; ") ?? "—"}</td>
    </tr>
  );
}

export default async function RepoPage({
  params,
}: {
  params: Promise<{ repoId: string }>;
}) {
  const { repoId: repoIdStr } = await params;
  const repoId = Number(repoIdStr);
  const repo = await getRepoById(repoId);
  if (!repo) notFound();

  const [runs, metrics, repoPolicies] = await Promise.all([
    getCheckRunsForRepo(repoId, 20),
    getFinOpsMetrics(repoId, 7),
    getPoliciesForOrg(repo.orgId),
  ]);

  const repoPolicy = repoPolicies.find((p) => p.repoId === repoId);

  return (
    <div>
      <p className="breadcrumb">
        <a href="/">Organizations</a> / <a href={`/org/${repo.orgId}`}>@{repo.org.slug}</a> / {repo.name}
      </p>

      <div className="page-header">
        <h1>{repo.fullName}</h1>
        <p>GitHub Repo ID: {repo.githubRepoId} · Tracked since {new Date(repo.createdAt).toLocaleDateString()}</p>
      </div>

      {/* FinOps Stats */}
      <p className="section-label">FinOps Metrics · Last {metrics.days} days</p>
      <div className="stats">
        <div className="stat">
          <div className="value">{metrics.totalRuns}</div>
          <div className="label">PR Check Runs</div>
        </div>
        <div className="stat red">
          <div className="value">{metrics.blockedCount}</div>
          <div className="label">Deps Blocked</div>
        </div>
        <div className="stat yellow">
          <div className="value">{metrics.warnCount}</div>
          <div className="label">Deps Warned</div>
        </div>
        <div className="stat green">
          <div className="value">{metrics.allowCount}</div>
          <div className="label">Deps Allowed</div>
        </div>
        <div className="stat blue">
          <div className="value">${metrics.totalCostSaved.toFixed(2)}</div>
          <div className="label">Est. CI Cost Saved/mo</div>
        </div>
        <div className="stat blue">
          <div className="value">{metrics.totalSizeMB.toFixed(1)} MB</div>
          <div className="label">Bundle Size Impact</div>
        </div>
      </div>

      {/* Repo Policy */}
      <p className="section-label">Repo Policy Override</p>
      {repoPolicy ? (
        <pre className="json">
          {JSON.stringify(JSON.parse(repoPolicy.json), null, 2)}
        </pre>
      ) : (
        <div className="card">
          <p style={{ color: "var(--text-muted)" }}>
            No repo-level policy override. Inheriting from org policy (or system defaults).
          </p>
        </div>
      )}

      {/* Check Runs Table */}
      <p className="section-label">Recent Check Runs ({runs.length})</p>
      {runs.length === 0 ? (
        <div className="empty">No check runs recorded yet.</div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>PR</th>
                <th>Date</th>
                <th>Overall Verdict</th>
                <th>Base SHA</th>
                <th>Head SHA</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((run) => {
                let details: any[] = [];
                try { details = JSON.parse(run.detailsJson); } catch {}
                return (
                  <>
                    <tr key={run.id} style={{ background: "var(--surface)" }}>
                      <td><strong>#{run.prNumber}</strong></td>
                      <td style={{ color: "var(--text-muted)" }}>{new Date(run.createdAt).toLocaleString()}</td>
                      <td><VerdictBadge verdict={run.verdict} /></td>
                      <td><code style={{ fontSize: 11 }}>{run.baseSha.slice(0, 7)}</code></td>
                      <td><code style={{ fontSize: 11 }}>{run.headSha.slice(0, 7)}</code></td>
                    </tr>
                    {details.length > 0 && (
                      <tr key={`${run.id}-deps`}>
                        <td colSpan={5} style={{ padding: "0 14px 16px 32px" }}>
                          <table style={{ width: "100%", fontSize: 12 }}>
                            <thead>
                              <tr>
                                <th>Package</th>
                                <th>Verdict</th>
                                <th>Score</th>
                                <th>Size</th>
                                <th>Alternatives</th>
                                <th>Notes</th>
                              </tr>
                            </thead>
                            <tbody>
                              {details.map((d, i) => (
                                <DepRow key={i} dep={d.dep} evalResult={d.evalResult} />
                              ))}
                            </tbody>
                          </table>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
