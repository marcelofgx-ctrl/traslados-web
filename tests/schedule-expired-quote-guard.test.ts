import {describe,expect,test} from "bun:test";
import {readFileSync} from "node:fs";
const s=readFileSync("supabase/migrations/20261013_schedule_expired_quote_guard.sql","utf8");
describe("scheduled quote acceptance must remain future-only",()=>{
 test("protects both driver quote RPCs and customer acceptance",()=>{
  expect(s).toContain("customer_quote_decision_v13");
  expect(s).toContain("driver_send_quote_v10");
  expect(s).toContain("driver_send_quote_v10_7");
  expect(s).toContain("r.pickup_mode=''schedule''");
  expect(s).toContain("v_res.pickup_mode=''schedule''");
  expect(s).toContain("America/Montevideo");
  expect(s).toContain("pg_get_functiondef");
 });
 test("keeps past rejection separate from habitual hours or current availability",()=>{
  expect(s).not.toContain("availability_settings_effective");
  expect(s).not.toContain("drop function");
  expect(s).not.toContain("drop table");
  expect(s).not.toContain("delete from");
 });
});