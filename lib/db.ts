import { neon } from "@neondatabase/serverless";

let _sql: ReturnType<typeof neon> | null = null;

export async function q<T = Record<string, any>>(
  text: string,
  params: unknown[] = [],
): Promise<T[]> {
  if (!_sql) {
    if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set");
    _sql = neon(process.env.DATABASE_URL);
  }
  return (await _sql.query(text, params)) as T[];
}
