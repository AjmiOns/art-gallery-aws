'use client';

import { useState } from 'react';
import AdminArtworks from '@/components/admin/AdminArtworks';
import AdminCategories from '@/components/admin/AdminCategories';
import AdminOrders from '@/components/admin/AdminOrders';
import AdminStats from '@/components/admin/AdminStats';
import AdminUsers from '@/components/admin/AdminUsers';
import { useI18n } from '@/components/LanguageProvider';
import RequireRole from '@/components/RequireRole';
import Tabs from '@/components/Tabs';

const TABS = [
  { id: 'stats', label: 'Statistiques' },
  { id: 'users', label: 'Utilisateurs' },
  { id: 'artworks', label: 'Œuvres' },
  { id: 'orders', label: 'Commandes' },
  { id: 'categories', label: 'Catégories' },
];

export default function AdminPage() {
  const { t } = useI18n();
  const [tab, setTab] = useState('stats');
  return (
    <RequireRole roles={['admin']}>
      <div className="page page--wide">
        <header className="page-head">
          <div>
            <h1>{t('Administration')}</h1>
            <p className="muted">{t('Pilotez la galerie : utilisateurs, œuvres, commandes et catégories.')}</p>
          </div>
        </header>
        <Tabs items={TABS} active={tab} onChange={setTab} />
        {tab === 'stats' && <AdminStats />}
        {tab === 'users' && <AdminUsers />}
        {tab === 'artworks' && <AdminArtworks />}
        {tab === 'orders' && <AdminOrders />}
        {tab === 'categories' && <AdminCategories />}
      </div>
    </RequireRole>
  );
}
