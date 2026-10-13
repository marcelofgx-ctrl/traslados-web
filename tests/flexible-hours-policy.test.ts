import {describe,expect,test} from "bun:test";
import {readFileSync} from "node:fs";
const sql=readFileSync("supabase/migrations/20261013_flexible_operating_hours_and_scheduled_requests.sql","utf8");
describe("Flexible hours are NOT automatic booking confirmation",()=>{
 test("flags and PIN-controlled policy are explicit",()=>{
  expect(sql).toContain("ADD COLUMN IF NOT EXISTS allow_scheduled_any_time");
  expect(sql).toContain("ADD COLUMN IF NOT EXISTS allow_live_outside_hours");
  expect(sql).toContain("public.driver_set_availability_settings_v12");
  expect(sql).toContain("public.driver_pin_valid");
  expect(sql).toContain("public.driver_set_availability_settings_v11_3");
  expect(sql).toContain("public.driver_get_availability_settings_v11_3");
 });
 test("requests are independent of capacity and require future dates",()=>{
  expect(sql).toContain("public.schedule_request_policy_v1");
  expect(sql).toContain("p_date+p_time<=local_now");
  expect(sql).toContain("SCHEDULE_REQUESTS_PAUSED");
  expect(sql).toContain("PENDING_DRIVER_REVIEW");
  expect(sql).toContain("reservation_schedule_request_policy_v1");
  expect(sql).toContain("BEFORE INSERT ON public.reservations");
  expect(sql).toContain("CREATE OR REPLACE FUNCTION public.customer_create_reservation_v11_4");
  expect(sql).not.toMatch(/DELETE FROM public\.reservations|TRUNCATE public\.reservations/i);
 });
 test("live shift can override habitual hours without exposing GPS",()=>{
  expect(sql).toContain("within_hours := coalesce(s.allow_live_outside_hours,false) or");
  expect(sql).toContain("'available', presence_ok and within_hours and not agenda_busy");
  expect(sql).toContain("p.accuracy_m <= 45");
  expect(sql).not.toContain("driverLat");
 });
 test("confirmed conflicts remain protected and driver quote required",()=>{
  expect(sql).toContain("v_res.id,false,false");
  expect(sql).toContain("HORARIO_YA_NO_DISPONIBLE");
  expect(sql).toContain("quote_status='ACEPTADO'");
  expect(sql).toContain("public.availability_route_check_v11_4");
 });
 test("Conductor gets ordered stop details privately",()=>{
  expect(sql).toContain("'stops',coalesce");
  expect(sql).toContain("public.reservation_stops");
  expect(sql).toContain("order by st.position");
  expect(sql).toContain("public.driver_list_reservations_v3");
 });
});