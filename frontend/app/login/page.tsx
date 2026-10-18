import AuthForm from '@/components/AuthForm';

export const metadata = { title: "Connexion · Galerie d'art" };

export default function LoginPage() {
  return <AuthForm mode="login" />;
}
