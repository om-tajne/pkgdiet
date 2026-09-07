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

// --- Top Actions Component ---
function TopActions({ runs }: { runs: any[] }) {
  // Extract all warned/blocked deps from recent runs
  const actionableDeps = new Map();
  
  runs.forEach(run => {
    let detailsObj: any = {};
    try { detailsObj = JSON.parse(run.detailsJson); } catch {}
    const results = Array.isArray(detailsObj) ? detailsObj : (detailsObj.results || []);
    
    results.forEach((r: any) => {
      const depName = r.dep?.name || r.name; // depending on structure
      const evalResult = r.evalResult || r;
      if (evalResult.verdict === 'WARN' || evalResult.verdict === 'BLOCK') {
        if (!actionableDeps.has(depName)) {
          actionableDeps.set(depName, evalResult);
        }
      }
    });
  });

  const topDeps = Array.from(actionableDeps.values())
    .sort((a, b) => (b.costEstimate?.monthlyCiCost100Builds || 0) - (a.costEstimate?.monthlyCiCost100Builds || 0))
    .slice(0, 5);

  if (topDeps.length === 0) return null;

  const potentialSavings = topDeps.reduce((sum, d) => sum + (d.costEstimate?.monthlyCiCost100Builds || 0), 0);

  return (
    <div style={{ background: '#f8f9fa', border: '1px solid #e1e4e8', borderRadius: '6px', padding: '16px', marginBottom: '24px' }}>
      <h3 style={{ marginTop: 0, display: 'flex', justifyContent: 'space-between' }}>
        <span>⚡ Top Actions: Packages to Replace</span>
        <span style={{ color: '#28a745' }}>Potential Savings: ${potentialSavings.toFixed(2)}/mo</span>
      </h3>
      <table style={{ width: '100%', fontSize: '14px', borderCollapse: 'collapse', marginTop: '12px' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid #e1e4e8', textAlign: 'left' }}>
            <th style={{ paddingBottom: '8px' }}>Package</th>
            <th style={{ paddingBottom: '8px' }}>Size / Cost</th>
            <th style={{ paddingBottom: '8px' }}>Alternative</th>
            <th style={{ paddingBottom: '8px' }}>Action</th>
          </tr>
        </thead>
        <tbody>
          {topDeps.map((dep, i) => {
            const alts = dep.alternatives || [];
            const firstAlt = alts.length > 0 ? (typeof alts[0] === 'string' ? alts[0] : (alts[0].replacement || alts[0].name)) : null;
            return (
              <tr key={i} style={{ borderBottom: '1px solid #eaecef' }}>
                <td style={{ padding: '8px 0' }}><strong>{dep.name}</strong> <VerdictBadge verdict={dep.verdict} /></td>
                <td style={{ padding: '8px 0' }}>{dep.costEstimate?.addedSizeMB?.toFixed(2) || 0}MB <span style={{ color: '#666' }}>(${dep.costEstimate?.monthlyCiCost100Builds?.toFixed(3) || 0}/mo)</span></td>
                <td style={{ padding: '8px 0' }}>{firstAlt || 'None'}</td>
                <td style={{ padding: '8px 0' }}>
                  {firstAlt ? (
                    <code style={{ background: '#e1e4e8', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer' }} onClick={() => console.log('Copy to clipboard')}>
                      npm rm {dep.name} && npm i {firstAlt}
                    </code>
                  ) : (
                    <span style={{ color: '#666' }}>Find alternative</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
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
        <p>GitHub Repo ID: {repo.githubRepoId} • Tracked since {new Date(repo.createdAt).toLocaleDateString()}</p>
      </div>

      <TopActions runs={runs} />

      {/* FinOps Stats */}
      <p className="section-label">FinOps Metrics • Last {metrics.days} days</p>
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
                let detailsObj: any = {};
                try { detailsObj = JSON.parse(run.detailsJson); } catch {}
                const results = Array.isArray(detailsObj) ? detailsObj : (detailsObj.results || []);
                return (
                  <>
                    <tr key={run.id} style={{ background: "var(--surface)" }}>
                      <td><strong>#{run.prNumber}</strong></td>
                      <td style={{ color: "var(--text-muted)" }}>{new Date(run.createdAt).toLocaleString()}</td>
                      <td><VerdictBadge verdict={run.verdict} /></td>
                      <td><code style={{ fontSize: 11 }}>{run.baseSha.slice(0, 7)}</code></td>
                      <td><code style={{ fontSize: 11 }}>{run.headSha.slice(0, 7)}</code></td>
                    </tr>
                    {results.length > 0 && (
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
                              {results.map((r: any, i: number) => {
                                const dep = r.dep || { name: r.name, version: 'unknown' };
                                const evalResult = r.evalResult || r;
                                return <DepRow key={i} dep={dep} evalResult={evalResult} />;
                              })}
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

