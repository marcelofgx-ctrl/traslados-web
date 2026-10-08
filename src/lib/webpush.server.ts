/**
 * Web Push (RFC 8291 aes128gcm + VAPID RFC 8292) con Web Crypto.
 * Solo se ejecuta en el servidor: nunca importar desde componentes.
 */

const enc = new TextEncoder();

function b64url(data: ArrayBuffer | Uint8Array): string {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  let binary = "";
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromB64url(value: string): Uint8Array {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((value.length + 3) % 4);
  const binary = atob(padded);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i);
  return out;
}

function concat(...parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, p) => sum + p.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

async function hkdf(salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, length: number) {
  const key = await crypto.subtle.importKey("raw", ikm as BufferSource, "HKDF", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "HKDF", hash: "SHA-256", salt: salt as BufferSource, info: info as BufferSource },
    key,
    length * 8,
  );
  return new Uint8Array(bits);
}

async function vapidToken(audience: string, subject: string, publicKey: string, privateKey: string) {
  const header = b64url(enc.encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const payload = b64url(
    enc.encode(
      JSON.stringify({
        aud: audience,
        exp: Math.floor(Date.now() / 1000) + 12 * 3600,
        sub: subject,
      }),
    ),
  );
  const raw = fromB64url(publicKey);
  const jwk: JsonWebKey = {
    kty: "EC",
    crv: "P-256",
    x: b64url(raw.slice(1, 33)),
    y: b64url(raw.slice(33, 65)),
    d: privateKey,
    ext: true,
  };
  const key = await crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    key,
    enc.encode(`${header}.${payload}`),
  );
  return `${header}.${payload}.${b64url(signature)}`;
}

export type PushSubscriptionRow = { endpoint: string; p256dh: string; auth: string };

export type SendResult = { endpoint: string; status: number; ok: boolean; error?: string | undefined };

export async function sendWebPush(
  subscription: PushSubscriptionRow,
  payload: unknown,
  vapid: { publicKey: string; privateKey: string; subject: string },
): Promise<SendResult> {
  try {
    const clientPublic = fromB64url(subscription.p256dh);
    const authSecret = fromB64url(subscription.auth);

    const serverKeys = await crypto.subtle.generateKey(
      { name: "ECDH", namedCurve: "P-256" },
      true,
      ["deriveBits"],
    );
    const serverPublicRaw = new Uint8Array(
      await crypto.subtle.exportKey("raw", serverKeys.publicKey),
    );
    const clientKey = await crypto.subtle.importKey(
      "raw",
      clientPublic as BufferSource,
      { name: "ECDH", namedCurve: "P-256" },
      false,
      [],
    );
    const shared = new Uint8Array(
      await crypto.subtle.deriveBits({ name: "ECDH", public: clientKey }, serverKeys.privateKey, 256),
    );

    const salt = crypto.getRandomValues(new Uint8Array(16));
    const prkInfo = concat(
      enc.encode("WebPush: info\0"),
      clientPublic,
      serverPublicRaw,
    );
    const ikm = await hkdf(authSecret, shared, prkInfo, 32);
    const cek = await hkdf(salt, ikm, enc.encode("Content-Encoding: aes128gcm\0"), 16);
    const nonce = await hkdf(salt, ikm, enc.encode("Content-Encoding: nonce\0"), 12);

    const body = concat(enc.encode(JSON.stringify(payload)), new Uint8Array([2]));
    const aesKey = await crypto.subtle.importKey("raw", cek as BufferSource, "AES-GCM", false, [
      "encrypt",
    ]);
    const ciphertext = new Uint8Array(
      await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce as BufferSource }, aesKey, body as BufferSource),
    );

    const recordSize = new Uint8Array(4);
    new DataView(recordSize.buffer).setUint32(0, 4096);
    const header = concat(
      salt,
      recordSize,
      new Uint8Array([serverPublicRaw.length]),
      serverPublicRaw,
    );
    const encrypted = concat(header, ciphertext);

    const url = new URL(subscription.endpoint);
    const jwt = await vapidToken(url.origin, vapid.subject, vapid.publicKey, vapid.privateKey);

    const response = await fetch(subscription.endpoint, {
      method: "POST",
      headers: {
        TTL: "1800",
        Urgency: "high",
        "Content-Encoding": "aes128gcm",
        "Content-Type": "application/octet-stream",
        Authorization: `vapid t=${jwt}, k=${vapid.publicKey}`,
      },
      body: encrypted as BodyInit,
    });

    return {
      endpoint: subscription.endpoint,
      status: response.status,
      ok: response.ok,
      error: response.ok ? undefined : await response.text(),
    };
  } catch (error) {
    return {
      endpoint: subscription.endpoint,
      status: 0,
      ok: false,
      error: error instanceof Error ? error.message : "error desconocido",
    };
  }
}