import { createClient } from "@supabase/supabase-js";
import { Buffer } from "node:buffer";
import { normalizePasskeyOrigin, isPermittedPasskeyRequest, passkeyHostMatches } from "./passkey-origin";
import {
  generateRegistrationOptions, generateAuthenticationOptions,
  verifyRegistrationResponse, verifyAuthenticationResponse,
  type RegistrationResponseJSON, type AuthenticationResponseJSON,
} from "@simplewebauthn/server";

/** Solo se usa en handlers de servidor. Nunca importar desde React. */
const OPERATIVE_URL = "https://zetaudvvutlouiqxopvg.supabase.co";
const PUBLIC_ORIGIN = "https://traslados-web.marcelof-gx.workers.dev";
type Body = Record<string, unknown>;
type PasskeyDb = any; // Service-role schema is distinct from the generated legacy database types.
class ApiError extends Error { constructor(message: string, public status = 400) { super(message); } }

function serverConfig(request: Request) {
  const configuredOrigin = process.env["PASSKEY_PUBLIC_ORIGIN"] || PUBLIC_ORIGIN;
  const origin = normalizePasskeyOrigin(configuredOrigin);
  // Both the browser's Origin header and the requested host must match.
  // Accept a hostname without https:// in Cloudflare, but never an external origin.
  if (!origin || !isPermittedPasskeyRequest(configuredOrigin, request)) {
    throw new ApiError("Origen no autorizado", 403);
  }
  if (process.env["PASSKEY_AUTH_ENABLED"] !== "true") {
    throw new ApiError("El acceso con huella se está preparando", 503);
  }
  const key = process.env["PASSKEY_SUPABASE_SERVICE_ROLE_KEY"];
  if (!key) throw new ApiError("Falta configurar la autenticación del servidor", 503);
  const db: PasskeyDb = createClient(OPERATIVE_URL, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: {
      fetch: (input, init) => {
        const headers = new Headers(init?.headers);
        if (key.startsWith("sb_secret_") && headers.get("Authorization") === "Bearer " + key) {
          headers.delete("Authorization");
        }
        headers.set("apikey", key);
        return fetch(input, { ...init, headers });
      },
    },
  });
  return { origin, rpID: new URL(origin).hostname, db };
}

function b64(b: Uint8Array) { return Buffer.from(b).toString("base64url"); }
function unb64(s: string) { return new Uint8Array(Buffer.from(s, "base64url")); }
function randomSecret(bytes = 32) { return b64(crypto.getRandomValues(new Uint8Array(bytes))); }
async function hash(s: string) {
  return Buffer.from(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s))).toString("hex");
}
function failDb(error: {message:string} | null, fallback="No se pudo guardar la credencial") {
  if (error) { console.error("Passkey persistence:", error.message); throw new ApiError(fallback, 500); }
}
async function protectRate(db: PasskeyDb, request: Request) {
  const ip = request.headers.get("cf-connecting-ip") || "local";
  const ipHash = await hash(ip);
  const cutoff = new Date(Date.now() - 10 * 60_000).toISOString();
  const { count, error } = await db.from("customer_passkey_challenges")
    .select("id", {count:"exact",head:true})
    .eq("ip_hash",ipHash).gte("created_at",cutoff);
  failDb(error, "No se pudo comprobar el límite de solicitudes");
  if ((count||0)>=10) throw new ApiError("Demasiados intentos. Probá dentro de unos minutos.",429);
  return ipHash;
}
async function consume(db: PasskeyDb, challengeId: unknown, op:string, rpID:string) {
  if (typeof challengeId !== "string" || !/^[0-9a-f-]{36}$/.test(challengeId)) throw new ApiError("Desafío inválido");
  const {data,error} = await db.from("customer_passkey_challenges")
    .update({consumed:true})
    .eq("id",challengeId).eq("operation",op).eq("consumed",false).eq("rp_id",rpID)
    .gt("expires_at",new Date().toISOString())
    .select("challenge,customer_id").maybeSingle();
  failDb(error,"No se pudo validar el desafío");
  if (!data) throw new ApiError("La operación venció o ya fue utilizada. Volvé a intentarlo.");
  return data;
}
function validString(v:unknown,min=1,max=300) {
  if(typeof v!=="string"||v.trim().length<min||v.trim().length>max)throw new ApiError("Datos incompletos");
  return v.trim();
}
async function findCustomer(db:PasskeyDb,token:unknown) {
  const s=validString(token,32,300);
  const tokenHash=await hash(s);
  const {data,error}=await db.from("customer_sessions").select("customer_id,expires_at")
    .eq("token_hash",tokenHash).eq("active",true).gt("expires_at",new Date().toISOString()).maybeSingle();
  failDb(error,"No se pudo validar tu sesión");
  if(!data)throw new ApiError("Sesión vencida. Volvé a entrar con tu PIN.");
  return data.customer_id as string;
}

export async function passkeyHandler(request:Request, body:Body) {
  const {db,origin,rpID}=serverConfig(request);
  const step=validString(body["step"],1,60);
  if(step==="register-options") {
    const ipHash=await protectRate(db,request);
    const customerId=body["sessionToken"]?await findCustomer(db,body["sessionToken"]):null;
    const username=crypto.randomUUID();
    const options=await generateRegistrationOptions({
      rpName:"Traslados Uruguay",rpID,userName:username,userDisplayName:"Cliente de Traslados",
      userID:crypto.getRandomValues(new Uint8Array(32)),
      attestationType:"none",
      authenticatorSelection:{residentKey:"required",userVerification:"required"},
      supportedAlgorithmIDs:[-7,-257],
    });
    const {data,error}=await db.from("customer_passkey_challenges").insert({
      challenge:options.challenge,operation:"register",rp_id:rpID,customer_id:customerId,ip_hash:ipHash,
    }).select("id").single();
    failDb(error);
    return {challengeId:data!.id,options};
  }
  if(step==="register-verify") {
    const pending=await consume(db,body["challengeId"],"register",rpID);
    if(pending.customer_id) {
      const actual=await findCustomer(db,body["sessionToken"]);
      if(actual!==pending.customer_id)throw new ApiError("Cuenta incorrecta",403);
    }
    if(!body["credential"]||typeof body["credential"]!=="object")throw new ApiError("Faltan datos de la huella");
    const result=await verifyRegistrationResponse({
      response:body["credential"] as RegistrationResponseJSON,
      expectedChallenge:pending.challenge,expectedOrigin:origin,expectedRPID:rpID,
      requireUserVerification:true,supportedAlgorithmIDs:[-7,-257],
    });
    if(!result.verified||!result.registrationInfo)throw new ApiError("No pudimos confirmar el dispositivo");
    const {credential,credentialDeviceType,credentialBackedUp}=result.registrationInfo;
    const metadata={
      p_credential_id:credential.id,
      p_public_key:b64(credential.publicKey),
      p_counter:credential.counter,
      p_transports:credential.transports??[],
      p_device_type:credentialDeviceType,
      p_backed_up:credentialBackedUp,
    };
    if(pending.customer_id) {
      const recoveryCode=randomSecret(32);
      const {data,error}=await db.rpc("customer_passkey_add_v14",{
        p_session_token:body["sessionToken"],p_recovery_code:recoveryCode,...metadata,
      });
      failDb(error,"No pudimos asociar la huella a tu cuenta");
      return {ok:Boolean(data),added:true,recoveryCode};
    }
    const name=validString(body["name"],2,120),phone=validString(body["phone"],8,22);
    const pin=validString(body["pin"],6,6);
    if(!/^\d{6}$/.test(pin))throw new ApiError("El PIN debe tener 6 dígitos");
    const recoveryCode=randomSecret(32);
    const {data,error}=await db.rpc("customer_passkey_create_v14",{
      p_name:name,p_phone:phone,p_pin:pin,p_recovery_code:recoveryCode,...metadata,
    });
    if(error){
      // Exponer error genérico: no filtrar estado de un número a través de registro.
      console.warn("Passkey account creation:",error.code);
      throw new ApiError("No pudimos crear la cuenta. Si tu celular ya está registrado, ingresá con PIN y agregá la huella.",400);
    }
    return {ok:true,session:data,recoveryCode};
  }
  if(step==="authenticate-options") {
    const ipHash=await protectRate(db,request);
    const options=await generateAuthenticationOptions({
      rpID,userVerification:"required",allowCredentials:[],
    });
    const {data,error}=await db.from("customer_passkey_challenges").insert({
      challenge:options.challenge,operation:"authenticate",rp_id:rpID,ip_hash:ipHash,
    }).select("id").single();
    failDb(error);
    return {challengeId:data!.id,options};
  }
  if(step==="authenticate-verify" || step==="reset-pin-verify") {
    const pending=await consume(db,body["challengeId"],"authenticate",rpID);
    const response=body["credential"] as AuthenticationResponseJSON|undefined;
    if(!response ||typeof response.id!=="string")throw new ApiError("Faltan datos de autenticación");
    const {data:passkey,error}=await db.from("customer_passkeys")
      .select("credential_id,public_key,counter,transports")
      .eq("credential_id",response.id).maybeSingle();
    failDb(error);
    if(!passkey)throw new ApiError("No encontramos esa llave de acceso");
    const verification=await verifyAuthenticationResponse({
      response,expectedChallenge:pending.challenge,expectedOrigin:origin,expectedRPID:rpID,
      requireUserVerification:true,
      credential:{
        id:passkey.credential_id,publicKey:unb64(passkey.public_key),
        counter:Number(passkey.counter),transports:passkey.transports,
      },
    });
    if(!verification.verified)throw new ApiError("No se pudo verificar tu identidad");
    const changingPin=step==="reset-pin-verify";
    const newPin=changingPin?validString(body["pin"],6,6):null;
    if(changingPin && !/^\d{6}$/.test(newPin!)) throw new ApiError("El nuevo PIN debe tener 6 dígitos");
    const {data,error:sessionErr}=await db.rpc(changingPin?"customer_passkey_reset_pin_v14":"customer_passkey_login_v14",{
      p_credential_id:passkey.credential_id,
      p_new_counter:verification.authenticationInfo.newCounter,
      ...(changingPin?{p_pin:newPin}:{}),
    });
    failDb(sessionErr,"No se pudo iniciar sesión con la llave de acceso");
    return {ok:true,session:data};
  }
  if(step==="recover") {
    // Código de recuperación de 256 bits: el servidor almacena solo su SHA-256.
    // El cliente recibe un código NUEVO y debe conservarlo fuera del teléfono.
    await protectRate(db,request);
    const recoveryCode=randomSecret(32);
    const {data,error}=await db.rpc("customer_passkey_recover_v14",{
      p_phone:validString(body["phone"],8,22),p_recovery_code:validString(body["recoveryCode"],30,120),
      p_new_pin:validString(body["pin"],6,6),p_new_recovery_code:recoveryCode,
    });
    if(error)throw new ApiError("Datos de recuperación incorrectos",400);
    return {ok:true,session:data,recoveryCode};
  }
  throw new ApiError("Operación no permitida",400);
}

export function passkeyStatus(request: Request) {
  // Status must also check the configured hostname; a present secret is not
  // sufficient evidence that the configured WebAuthn origin is usable.
  const configuredOrigin = process.env["PASSKEY_PUBLIC_ORIGIN"] || PUBLIC_ORIGIN;
  return Boolean(
    process.env["PASSKEY_AUTH_ENABLED"] === "true" &&
    process.env["PASSKEY_SUPABASE_SERVICE_ROLE_KEY"] &&
    passkeyHostMatches(configuredOrigin, request),
  );
}
export function passkeyError(error:unknown) {
  if (error instanceof ApiError)return {status:error.status,message:error.message};
  console.error("Passkey server error:",error);
  return {status:500,message:"No se pudo completar la operación. Probá nuevamente."};
}
