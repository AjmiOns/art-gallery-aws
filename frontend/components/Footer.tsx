'use client';

import { usePathname } from 'next/navigation';
import LanguageSwitch from './LanguageSwitch';
import { useI18n } from './LanguageProvider';

export default function Footer() {
  const pathname = usePathname();
  const { t } = useI18n();
  if (pathname === '/login' || pathname === '/register') return null;
  return (
    <footer className="site-footer">
      <p>{t("Galerie d'art en ligne. Publiez vos créations, découvrez celles des autres.")}</p>
      <LanguageSwitch />
    </footer>
  );
}
