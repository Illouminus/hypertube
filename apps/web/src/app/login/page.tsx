import Link from 'next/link';

export default function LoginPage() {
  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
        color: 'white',
      }}
    >
      <div style={{ textAlign: 'center', padding: '2rem' }}>
        <h1 style={{ fontSize: '2rem', marginBottom: '1rem' }}>Login</h1>
        <p style={{ color: '#a0a0a0', marginBottom: '2rem' }}>
          Authentication will be implemented in a future stage.
        </p>
        <Link
          href="/"
          style={{
            display: 'inline-block',
            padding: '0.75rem 1.5rem',
            backgroundColor: '#e94560',
            borderRadius: '8px',
            color: 'white',
          }}
        >
          Back to Home
        </Link>
      </div>
    </main>
  );
}
