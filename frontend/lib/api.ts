import type { Category } from './categories';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api';
export const CURRENCY = process.env.NEXT_PUBLIC_CURRENCY ?? 'TND';

export type Role = 'admin' | 'artist' | 'buyer';
export type ArtworkStatus = 'available' | 'reserved' | 'sold';
export type OrderStatus = 'pending' | 'accepted' | 'rejected' | 'cancelled' | 'paid';

export type SessionUser = { id: string; email: string; username: string; role: Role };
export type Session = { accessToken: string; user: SessionUser };
export type UserProfile = SessionUser & {
  phone: string | null; city: string | null; bio: string | null; isActive: boolean; createdAt: string;
};

export type Artwork = {
  id: string; title: string; imageUrl: string; tags: string[]; price: number; status: ArtworkStatus;
  ownerId: string; owner?: { id: string; username: string }; createdAt: string;
};

export type Order = {
  id: string; status: OrderStatus; amount: number; message: string | null; paidAt: string | null; createdAt: string;
  artwork: Pick<Artwork, 'id' | 'title' | 'imageUrl' | 'price' | 'status' | 'tags'>;
  buyer: { id: string; username: string }; seller: { id: string; username: string };
  payment?: { id: string; provider: string; cardBrand: string | null; cardLast4: string | null; currency: string; paidAt: string } | null;
};

export type PaymentConfig = { provider: 'mock' | 'stripe'; currency: string; testMode: boolean };
export type Receipt = {
  paymentId: string; orderId: string; status: string; amount: number; currency: string; provider: string;
  cardBrand: string | null; cardLast4: string | null; paidAt: string;
};

export type Thread = { userId: string; username: string; role: Role; lastMessage: string; lastAt: string; lastFromMe: boolean; unread: number };
export type ChatMessage = { id: string; senderId: string; recipientId: string; body: string; createdAt: string; artwork: { id: string; title: string } | null };
export type Conversation = { user: { id: string; username: string; role: Role }; messages: ChatMessage[] };

export type Stats = {
  users: { total: number; admins: number; artists: number; buyers: number; suspended: number };
  artworks: { total: number; available: number; reserved: number; sold: number };
  orders: { total: number; pending: number; accepted: number; rejected: number; cancelled: number; paid: number };
  revenue: { total: number; last30: number; payments: number };
  byCategory: { slug: string; label: string; tone: string; artworks: number; sold: number; revenue: number }[];
  daily: { date: string; sales: number; revenue: number }[];
  topArtists: { id: string; username: string; sales: number; revenue: number }[];
};

export type ArtworkFilters = { q?: string; tag?: string; maxPrice?: string; status?: string };
export type ArtworkInput = { title: string; imageUrl: string; tags: string[]; price: number };
export type ProfileInput = { username?: string; phone?: string; city?: string; bio?: string };

type Options = { method?: string; body?: unknown; token?: string | null; form?: FormData };

async function request<T>(path: string, { method = 'GET', body, token, form }: Options = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method,
      headers: {
        ...(form ? {} : { 'Content-Type': 'application/json' }),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: form ?? (body !== undefined ? JSON.stringify(body) : undefined),
    });
  } catch {
    throw new Error("Impossible de joindre le serveur. Vérifiez que l'API est démarrée.");
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    // Jeton expiré ou compte suspendu : l'application déconnecte l'utilisateur.
    if (res.status === 401 && token) window.dispatchEvent(new Event('auth:expired'));
    const message = Array.isArray(data?.message) ? data.message.join(', ') : data?.message;
    throw new Error(message ?? 'Une erreur est survenue.');
  }
  return data as T;
}

const qs = (params: Record<string, string | undefined>) => {
  const p = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => v && p.set(k, v));
  const s = p.toString();
  return s ? `?${s}` : '';
};

export const api = {
  // authentification et profil
  register: (body: { email: string; username: string; password: string; role: 'artist' | 'buyer' }) =>
    request<Session>('/auth/register', { method: 'POST', body }),
  login: (body: { email: string; password: string }) => request<Session>('/auth/login', { method: 'POST', body }),
  getMe: (token: string) => request<UserProfile>('/users/me', { token }),
  updateMe: (body: ProfileInput, token: string) => request<UserProfile>('/users/me', { method: 'PATCH', body, token }),
  changePassword: (body: { currentPassword: string; newPassword: string }, token: string) =>
    request('/users/me/password', { method: 'PATCH', body, token }),

  // catalogue
  listCategories: () => request<Category[]>('/categories'),
  listArtworks: (f: ArtworkFilters) => request<Artwork[]>(`/artworks${qs(f)}`),
  getArtwork: (id: string) => request<Artwork>(`/artworks/${id}`),
  myArtworks: (token: string) => request<Artwork[]>('/artworks/mine', { token }),
  createArtwork: (body: ArtworkInput, token: string) => request<Artwork>('/artworks', { method: 'POST', body, token }),
  updateArtwork: (id: string, body: Partial<ArtworkInput>, token: string) =>
    request<Artwork>(`/artworks/${id}`, { method: 'PATCH', body, token }),
  deleteArtwork: (id: string, token: string) => request(`/artworks/${id}`, { method: 'DELETE', token }),
  uploadImage: (file: File, token: string) => {
    const form = new FormData();
    form.append('file', file);
    return request<{ url: string }>('/uploads', { method: 'POST', form, token });
  },

  // demandes d'achat et paiement
  requestPurchase: (artworkId: string, message: string, token: string) =>
    request<Order>('/orders', { method: 'POST', body: { artworkId, message: message || undefined }, token }),
  boughtOrders: (token: string) => request<Order[]>('/orders/bought', { token }),
  salesOrders: (token: string) => request<Order[]>('/orders/sales', { token }),
  getOrder: (id: string, token: string) => request<Order>(`/orders/${id}`, { token }),
  orderAction: (id: string, action: 'accept' | 'reject' | 'cancel', token: string) =>
    request<Order>(`/orders/${id}/${action}`, { method: 'PATCH', token }),
  paymentConfig: () => request<PaymentConfig>('/payments/config'),
  checkout: (orderId: string, token: string) =>
    request<{ provider: 'mock' | 'stripe'; paymentId: string; url?: string }>('/payments/checkout', { method: 'POST', body: { orderId }, token }),
  confirmMock: (body: { paymentId: string; cardNumber: string; expiry: string; cvc: string; holder: string }, token: string) =>
    request<Receipt>('/payments/mock/confirm', { method: 'POST', body, token }),
  confirmStripe: (sessionId: string, token: string) =>
    request<Receipt>('/payments/stripe/confirm', { method: 'POST', body: { sessionId }, token }),

  // messagerie
  threads: (token: string) => request<Thread[]>('/messages/threads', { token }),
  conversation: (userId: string, token: string) => request<Conversation>(`/messages/with/${userId}`, { token }),
  sendMessage: (body: { recipientId: string; body: string; artworkId?: string }, token: string) =>
    request('/messages', { method: 'POST', body, token }),
  unreadCount: (token: string) => request<{ unread: number }>('/messages/unread-count', { token }),

  // administration
  adminStats: (token: string) => request<Stats>('/admin/stats', { token }),
  adminUsers: (f: { q?: string; role?: string; status?: string }, token: string) =>
    request<UserProfile[]>(`/admin/users${qs(f)}`, { token }),
  adminUpdateUser: (id: string, body: ProfileInput & { role?: Role; isActive?: boolean }, token: string) =>
    request<UserProfile>(`/admin/users/${id}`, { method: 'PATCH', body, token }),
  adminDeleteUser: (id: string, token: string) => request(`/admin/users/${id}`, { method: 'DELETE', token }),
  adminOrders: (status: string, token: string) => request<Order[]>(`/admin/orders${qs({ status })}`, { token }),
  adminCategories: (token: string) => request<Category[]>('/admin/categories', { token }),
  adminCreateCategory: (body: { slug: string; label: string; tagline?: string; tone?: string }, token: string) =>
    request<Category>('/admin/categories', { method: 'POST', body, token }),
  adminUpdateCategory: (id: string, body: Partial<Pick<Category, 'label' | 'tagline' | 'tone' | 'sortOrder' | 'isActive'>>, token: string) =>
    request<Category>(`/admin/categories/${id}`, { method: 'PATCH', body, token }),
  adminDeleteCategory: (id: string, token: string) => request(`/admin/categories/${id}`, { method: 'DELETE', token }),
};
