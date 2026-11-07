import type { PlanId } from '@/lib/api';

// Petit badge affiché sur les œuvres des artistes abonnés. Rien pour le plan gratuit.
export default function PlanBadge({ plan }: { plan?: PlanId }) {
  if (!plan || plan === 'free') return null;
  const label = plan === 'pro' ? 'Pro' : 'Premium';
  return (
    <span className={`plan-badge plan-badge--${plan}`} title={`Artiste ${label}`}>
      <svg viewBox="0 0 24 24" width="11" height="11" fill="currentColor" aria-hidden="true"><path d="M12 2l2.9 6.3 6.9.7-5.2 4.6 1.5 6.8L12 17l-6.1 3.4 1.5-6.8L2.2 9l6.9-.7z" /></svg>
      {label}
    </span>
  );
}
