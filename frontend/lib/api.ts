import type { CategoryId } from './categories';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api';
export const CURRENCY = process.env.NEXT_PUBLIC_CURRENCY ?? 'TND';

export type Artwork = {
  id: string;
  title: string;
  imageUrl: string;
  tags: string[];
  price: number;
  status: 'available' | 'sold';
  ownerId: string;
  owner?: { id: string; username: string };
  createdAt: string;
};

export type Session = {
  accessToken: string;
  user: { id: string; email: string; username: string };
};

export type ArtworkFilters = { q?: string; tag?: CategoryId | ''; maxPrice?: string };

async function request<T>(path: string, options: RequestInit = {}, token?: string | null): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
  } catch {
    throw new Error("Impossible de joindre le serveur. Vérifiez que l'API est démarrée.");
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const message = Array.isArray(data?.message) ? data.message.join(', ') : data?.message;
    throw new Error(message ?? 'Une erreur est survenue.');
  }
  return data as T;
}

export const api = {
  listArtworks: (filters: ArtworkFilters) => {
    const params = new URLSearchParams();
    if (filters.q) params.set('q', filters.q);
    if (filters.tag) params.set('tag', filters.tag);
    if (filters.maxPrice) params.set('maxPrice', filters.maxPrice);
    const qs = params.toString();
    return request<Artwork[]>(`/artworks${qs ? `?${qs}` : ''}`);
  },
  register: (body: { email: string; username: string; password: string }) =>
    request<Session>('/auth/register', { method: 'POST', body: JSON.stringify(body) }),
  login: (body: { email: string; password: string }) =>
    request<Session>('/auth/login', { method: 'POST', body: JSON.stringify(body) }),
  createArtwork: (body: { title: string; imageUrl: string; tags: string[]; price: number }, token: string) =>
    request<Artwork>('/artworks', { method: 'POST', body: JSON.stringify(body) }, token),
  buy: (artworkId: string, token: string) =>
    request('/orders', { method: 'POST', body: JSON.stringify({ artworkId }) }, token),
};
