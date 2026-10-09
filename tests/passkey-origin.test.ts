import { describe, test, expect } from "bun:test";
import { normalizePasskeyOrigin, isPermittedPasskeyRequest, passkeyHostMatches } from "../src/lib/passkey-origin";

const host = "traslados-web.marcelof-gx.workers.dev";
const origin = "https://" + host;
function request(at: string, from: string | null) {
  return new Request(at + "/api/auth/passkey", {
    method: "POST",
    headers: from === null ? undefined : { origin: from },
  });
}

describe("Origen WebAuthn: compatible y estricto", () => {
  test("normaliza host sin https, HTTPS con o sin barra", () => {
    expect(normalizePasskeyOrigin(host)).toBe(origin);
    expect(normalizePasskeyOrigin(origin)).toBe(origin);
    expect(normalizePasskeyOrigin(origin + "/")).toBe(origin);
    expect(normalizePasskeyOrigin("  " + host + "/  ")).toBe(origin);
  });
  test("no acepta http ni rutas, puertos o query strings", () => {
    expect(normalizePasskeyOrigin("http://" + host)).toBeNull();
    expect(normalizePasskeyOrigin(origin + "/otra")).toBeNull();
    expect(normalizePasskeyOrigin(origin + "?a=1")).toBeNull();
    expect(normalizePasskeyOrigin("")).toBeNull();
  });
  test("autoriza origen correcto con host sin esquema", () => {
    expect(isPermittedPasskeyRequest(host, request(origin, origin))).toBe(true);
    expect(passkeyHostMatches(host, request(origin, null))).toBe(true);
  });
  test("bloquea solicitudes cruzadas o sin Origin", () => {
    expect(isPermittedPasskeyRequest(host, request(origin, "https://evil.example"))).toBe(false);
    expect(isPermittedPasskeyRequest(host, request(origin, null))).toBe(false);
    expect(isPermittedPasskeyRequest(host, request("https://evil.example", origin))).toBe(false);
    expect(passkeyHostMatches(host, request("https://evil.example", null))).toBe(false);
  });
});
