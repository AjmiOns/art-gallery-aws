import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '@/components/AuthProvider';
import { CategoriesProvider } from '@/components/CategoriesProvider';
import { ToastProvider } from '@/components/Toast';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

export const metadata: Metadata = {
  title: "Galerie d'art en ligne",
  description: "Publiez, découvrez et achetez des œuvres d'art : peintures, décoration murale, art numérique et croquis.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap"
        />
      </head>
      <body>
        <AuthProvider>
          <CategoriesProvider>
            <ToastProvider>
              <Header />
              <main>{children}</main>
              <Footer />
            </ToastProvider>
          </CategoriesProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
