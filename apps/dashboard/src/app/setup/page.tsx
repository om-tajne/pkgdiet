import Link from 'next/link';

export default function SetupPage() {
  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '40px 20px', fontFamily: 'system-ui, sans-serif' }}>
      <h1>🚀 Welcome to PkgDiet Setup</h1>
      <p>Configure PkgDiet for your GitHub organization in 4 simple steps.</p>

      <div style={{ marginTop: '32px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <div style={{ border: '1px solid #ccc', padding: '24px', borderRadius: '8px' }}>
          <h2>Step 1: Install GitHub App</h2>
          <p>Install the PkgDiet GitHub App on your organization to enable PR checks.</p>
          <a 
            href="https://github.com/apps/pkgdiet-demo/installations/new"
            target="_blank"
            rel="noopener noreferrer"
            style={{ display: 'inline-block', background: '#24292e', color: 'white', padding: '10px 20px', borderRadius: '6px', textDecoration: 'none' }}>
            Install on GitHub
          </a>
        </div>

        <div style={{ border: '1px solid #ccc', padding: '24px', borderRadius: '8px' }}>
          <h2>Step 2: Select Repositories</h2>
          <p>The app is currently active on all repositories granted during installation.</p>
          <p style={{ color: '#666' }}>Wait for your first PR to see checks in action.</p>
        </div>

        <div style={{ border: '1px solid #ccc', padding: '24px', borderRadius: '8px' }}>
          <h2>Step 3: Choose a Policy Template</h2>
          <select style={{ padding: '8px', width: '100%', maxWidth: '300px', marginBottom: '16px' }}>
            <option>Strict (Blocks score &lt; 50)</option>
            <option>Balanced (Blocks score &lt; 30)</option>
            <option>Lenient (Warns only)</option>
          </select>
          <p>
            <button style={{ background: '#0366d6', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '6px', cursor: 'pointer' }}>
              Save Policy
            </button>
          </p>
        </div>

        <div style={{ border: '1px solid #ccc', padding: '24px', borderRadius: '8px' }}>
          <h2>Step 4: Done!</h2>
          <p>Your next PR will show PkgDiet checks automatically.</p>
          <Link href="/" style={{ display: 'inline-block', marginTop: '8px', color: '#0366d6', fontWeight: 'bold' }}>
            Go to Dashboard &rarr;
          </Link>
        </div>
      </div>
    </div>
  );
}
