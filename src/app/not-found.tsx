import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="editor-shell" style={{ textAlign: 'center', padding: '80px 20px' }}>
      <span className="eyebrow">404</span>
      <h1 style={{ marginTop: 12 }}>Бет табылмады</h1>
      <p style={{ color: '#64748b', marginBottom: 24 }}>
        Сіз іздеген бет жойылған немесе мекенжайы қате енгізілген.
      </p>
      <Link href="/" className="primary" style={{ display: 'inline-flex' }}>
        Басты бетке оралу
      </Link>
    </main>
  );
}
