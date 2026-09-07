// Demo Mode auth layer
// AUTH_MODE=demo auto-logs in as a mock admin user.
// To switch to real GitHub OAuth, set AUTH_MODE=github and configure
// GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET, and NEXTAUTH_SECRET in .env.local.

export const DEMO_USER = {
  id: "demo",
  name: "Demo Admin",
  email: "demo@pkgdiet.local",
  image: null as string | null,
};

export type SessionUser = typeof DEMO_USER;

export async function getSession(): Promise<{ user: SessionUser } | null> {
  const mode = process.env.AUTH_MODE ?? "demo";

  if (mode === "demo") {
    return { user: DEMO_USER };
  }

  // TODO: swap in real next-auth session lookup when AUTH_MODE=github
  return null;
}
