import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PkgDiet Dashboard",
  description: "FinOps Lite – org policy engine and dependency governance",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <nav>
          <div className="nav-inner">
            <a href="/" className="nav-brand">🥗 PkgDiet</a>
            <span className="nav-badge">v2.0 · Demo Mode</span>
          </div>
        </nav>
        <main>{children}</main>
        <footer>
          <p>PkgDiet v2.0 · <a href="https://github.com/om-tajne/pkgdiet">GitHub</a></p>
        </footer>
      </body>
    </html>
  );
}
