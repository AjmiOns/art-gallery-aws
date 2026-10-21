'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { api, Artwork, Conversation, Thread } from '@/lib/api';
import { formatTime } from '@/lib/format';
import Avatar from '@/components/Avatar';
import { useAuth } from '@/components/AuthProvider';
import RequireRole from '@/components/RequireRole';

const ROLE_LABEL = { admin: 'Admin', artist: 'Artiste', buyer: 'Acheteur' } as const;

function Inbox() {
  const { token, user } = useAuth();
  const params = useSearchParams();
  const toParam = params.get('to');
  const artworkParam = params.get('artwork');
  const [threads, setThreads] = useState<Thread[]>([]);
  const [activeId, setActiveId] = useState<string | null>(toParam);
  const [conv, setConv] = useState<Conversation | null>(null);
  const [artwork, setArtwork] = useState<Artwork | null>(null);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [loaded, setLoaded] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const loadThreads = useCallback(async () => {
    if (!token) return;
    try {
      setThreads(await api.threads(token));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoaded(true);
    }
  }, [token]);

  const loadConv = useCallback(async () => {
    if (!token || !activeId) return setConv(null);
    try {
      setConv(await api.conversation(activeId, token));
      setError('');
    } catch (e) {
      setError((e as Error).message);
    }
  }, [token, activeId]);

  useEffect(() => { loadThreads(); }, [loadThreads]);
  useEffect(() => { setConv(null); loadConv(); }, [loadConv]);

  // Nouveaux messages : rafraîchissement régulier
  useEffect(() => {
    const t = setInterval(() => { loadThreads(); loadConv(); }, 8000);
    return () => clearInterval(t);
  }, [loadThreads, loadConv]);

  // Œuvre à l'origine de la discussion (depuis la fiche d'une œuvre)
  useEffect(() => {
    setArtwork(null);
    if (artworkParam && activeId && activeId === toParam) api.getArtwork(artworkParam).then(setArtwork).catch(() => {});
  }, [artworkParam, activeId, toParam]);

  useEffect(() => { endRef.current?.scrollIntoView({ block: 'end' }); }, [conv?.messages.length]);

  async function send(e?: React.FormEvent) {
    e?.preventDefault();
    if (!token || !activeId || !text.trim() || sending) return;
    setSending(true);
    setError('');
    try {
      await api.sendMessage({ recipientId: activeId, body: text, artworkId: artwork?.id }, token);
      setText('');
      await Promise.all([loadConv(), loadThreads()]);
      loadThreads();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSending(false);
    }
  }

  const list: Thread[] = [...threads];
  if (conv && !list.some((t) => t.userId === conv.user.id)) {
    list.unshift({ userId: conv.user.id, username: conv.user.username, role: conv.user.role, lastMessage: 'Nouvelle conversation', lastAt: new Date().toISOString(), lastFromMe: false, unread: 0 });
  }

  return (
    <div className="page page--wide">
      <header className="page-head"><div><h1>Messages</h1><p className="muted">Échangez avec les artistes, les acheteurs et l&apos;équipe de la galerie.</p></div></header>

      <div className={`inbox${activeId ? ' has-active' : ''}`}>
        <aside className="inbox__list" aria-label="Conversations">
          {loaded && list.length === 0 && (
            <div className="state state--plain"><p>Aucune conversation.</p><p className="muted">Contactez un artiste depuis la fiche d&apos;une de ses œuvres.</p><Link href="/" className="btn btn--soft btn--sm">Parcourir la galerie</Link></div>
          )}
          {list.map((t) => (
            <button key={t.userId} type="button" className={`thread${activeId === t.userId ? ' is-active' : ''}`} onClick={() => setActiveId(t.userId)}>
              <Avatar name={t.username} size={40} />
              <span className="thread__body">
                <span className="thread__top"><strong>{t.username}</strong><span className="role-tag">{ROLE_LABEL[t.role]}</span></span>
                <span className="thread__last">{t.lastFromMe ? 'Vous : ' : ''}{t.lastMessage}</span>
              </span>
              {t.unread > 0 && <span className="nav-badge">{t.unread}</span>}
            </button>
          ))}
        </aside>

        <section className="inbox__chat" aria-label="Conversation">
          {!activeId ? (
            <div className="state state--plain"><p>Sélectionnez une conversation.</p></div>
          ) : (
            <>
              <header className="chat__head">
                <button type="button" className="btn btn--ghost btn--sm chat__back" onClick={() => setActiveId(null)}>Retour</button>
                {conv && <><Avatar name={conv.user.username} size={36} /><div><strong>{conv.user.username}</strong><span className="role-tag">{ROLE_LABEL[conv.user.role]}</span></div></>}
              </header>
              <div className="chat__messages">
                {conv && conv.messages.length === 0 && <p className="muted chat__empty">Écrivez votre premier message.</p>}
                {conv?.messages.map((m) => (
                  <div key={m.id} className={`bubble${m.senderId === user?.id ? ' bubble--me' : ''}`}>
                    {m.artwork && <span className="bubble__ref">À propos de « {m.artwork.title} »</span>}
                    <p>{m.body}</p>
                    <time>{formatTime(m.createdAt)}</time>
                  </div>
                ))}
                <div ref={endRef} />
              </div>
              {artwork && <p className="chat__context">À propos de : <strong>{artwork.title}</strong></p>}
              {error && <p className="form-error" role="alert">{error}</p>}
              <form className="chat__form" onSubmit={send}>
                <textarea
                  rows={2}
                  maxLength={2000}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) send(e); }}
                  placeholder="Votre message… (Entrée pour envoyer)"
                  aria-label="Votre message"
                />
                <button type="submit" className="btn btn--primary" disabled={sending || !text.trim()}>Envoyer</button>
              </form>
            </>
          )}
        </section>
      </div>
    </div>
  );
}

export default function MessagesPage() {
  return (
    <RequireRole>
      <Suspense fallback={null}>
        <Inbox />
      </Suspense>
    </RequireRole>
  );
}
