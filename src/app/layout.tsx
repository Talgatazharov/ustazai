import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = { title: 'USTAZ AI — Мұғалімнің жұмыс кеңістігі', description: 'Мұғалімге арналған цифрлық жұмыс кеңістігі' };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="kk"><body>{children}</body></html>; }
