import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const sql = readFileSync("supabase/migrations/20261012_driver_quote_expiration_guard.sql", "utf8");

describe("driver quote expiration guard migration", () => {
  test("covers active and compatibility quote RPCs", () => {
    expect(sql).toContain("CREATE OR REPLACE FUNCTION public.driver_send_quote_v10(");
    expect(sql).toContain("CREATE OR REPLACE FUNCTION public.driver_send_quote_v10_7(");
    expect((sql.match(/La solicitud inmediata venció/g) || []).length).toBeGreaterThanOrEqual(3);
    expect((sql.match(/pickup_mode in \('now','10'\)/g) || []).length).toBe(2);
  });

  test("uses the same server-time deadline as quote acceptance", () => {
    expect((sql.match(/created_at < now\(\)-interval '90 minutes'/g) || []).length).toBe(2);
    expect(sql).toContain("r.status='PENDIENTE'");
    expect(sql).not.toMatch(/\b(delete from|truncate table|drop table)\b/i);
  });

  test("preserves function permissions and performs a post-migration assertion", () => {
    expect((sql.match(/\n SECURITY DEFINER\n/g) || []).length).toBe(2);
    expect((sql.match(/SET search_path TO 'public'/g) || []).length).toBe(2);
    expect(sql).toContain("pg_get_functiondef");
  });
});
