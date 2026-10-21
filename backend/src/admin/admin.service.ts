import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class AdminService {
  constructor(private readonly dataSource: DataSource) {}

  private async one<T>(sql: string): Promise<T> {
    const [row] = await this.dataSource.query(sql);
    return row;
  }

  // Tableau de bord : tous les chiffres sont calculés en SQL.
  async stats() {
    const users = await this.one(`SELECT COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE role = 'admin')::int AS admins,
      COUNT(*) FILTER (WHERE role = 'artist')::int AS artists,
      COUNT(*) FILTER (WHERE role = 'buyer')::int AS buyers,
      COUNT(*) FILTER (WHERE NOT is_active)::int AS suspended FROM users`);
    const artworks = await this.one(`SELECT COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE status = 'available')::int AS available,
      COUNT(*) FILTER (WHERE status = 'reserved')::int AS reserved,
      COUNT(*) FILTER (WHERE status = 'sold')::int AS sold FROM artworks`);
    const orders = await this.one(`SELECT COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE status = 'pending')::int AS pending,
      COUNT(*) FILTER (WHERE status = 'accepted')::int AS accepted,
      COUNT(*) FILTER (WHERE status = 'rejected')::int AS rejected,
      COUNT(*) FILTER (WHERE status = 'cancelled')::int AS cancelled,
      COUNT(*) FILTER (WHERE status = 'paid')::int AS paid FROM orders`);
    const revenue = await this.one(`SELECT COALESCE(SUM(amount), 0)::float AS total,
      COALESCE(SUM(amount) FILTER (WHERE paid_at > now() - interval '30 days'), 0)::float AS last30,
      COUNT(*)::int AS payments FROM payments WHERE status = 'succeeded'`);
    const byCategory = await this.dataSource.query(`SELECT c.slug, c.label, c.tone,
      COUNT(a.id)::int AS artworks,
      COUNT(a.id) FILTER (WHERE a.status = 'sold')::int AS sold,
      COALESCE(SUM(a.price) FILTER (WHERE a.status = 'sold'), 0)::float AS revenue
      FROM categories c LEFT JOIN artworks a ON a.tags[1] = c.slug
      GROUP BY c.slug, c.label, c.tone, c.sort_order ORDER BY c.sort_order`);
    const daily = await this.dataSource.query(`SELECT to_char(d::date, 'YYYY-MM-DD') AS date,
      COALESCE(x.sales, 0)::int AS sales, COALESCE(x.revenue, 0)::float AS revenue
      FROM generate_series(current_date - interval '29 days', current_date, interval '1 day') d
      LEFT JOIN (SELECT paid_at::date AS day, COUNT(*) AS sales, SUM(amount) AS revenue
                 FROM payments WHERE status = 'succeeded' GROUP BY 1) x ON x.day = d::date
      ORDER BY d`);
    const topArtists = await this.dataSource.query(`SELECT u.id, u.username,
      COUNT(o.id)::int AS sales, COALESCE(SUM(o.amount), 0)::float AS revenue
      FROM users u JOIN orders o ON o.seller_id = u.id AND o.status = 'paid'
      GROUP BY u.id, u.username ORDER BY revenue DESC LIMIT 5`);
    return { users, artworks, orders, revenue, byCategory, daily, topArtists };
  }
}
