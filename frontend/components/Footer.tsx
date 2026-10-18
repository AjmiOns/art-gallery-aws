'use client';

import { usePathname } from 'next/navigation';

export default function Footer() {
  const pathname = usePathname();
  if (pathname === '/login' || pathname === '/register') return null;
  return (
    <footer className="site-footer">
      <p>Galerie d&apos;art en ligne. Publiez vos créations, découvrez celles des autres.</p>
    </footer>
  );
}
