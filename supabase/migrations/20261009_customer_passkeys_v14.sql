-- Traslados v14 — WebAuthn backend, migration reproducible.
-- Applies to operational Supabase project; additive tables and private RPCs.
-- Requires public.customers, public.customer_sessions and extensions.digest/crypt.
CREATE TABLE IF NOT EXISTS public.customer_passkeys (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
 credential_id text NOT NULL UNIQUE,
 public_key text NOT NULL,
 counter bigint NOT NULL DEFAULT 0,
 transports text[] NOT NULL DEFAULT '{}',
 device_type text NOT NULL,
 backed_up boolean NOT NULL DEFAULT false,
 created_at timestamptz NOT NULL DEFAULT now(),
 last_used_at timestamptz
);
CREATE TABLE IF NOT EXISTS public.customer_passkey_challenges(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 challenge text NOT NULL,
 operation text NOT NULL CHECK (operation IN ('register','authenticate')),
 rp_id text NOT NULL,
 customer_id uuid REFERENCES public.customers(id),
 ip_hash text,
 consumed boolean NOT NULL DEFAULT false,
 created_at timestamptz NOT NULL DEFAULT now(),
 expires_at timestamptz NOT NULL DEFAULT now() + interval '5 minutes'
);
CREATE TABLE IF NOT EXISTS public.customer_recovery_codes (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
 code_hash text NOT NULL UNIQUE,
 created_at timestamptz NOT NULL DEFAULT now(),
 used_at timestamptz
);
ALTER TABLE public.customer_passkeys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_passkey_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_recovery_codes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.customer_passkeys, public.customer_passkey_challenges, public.customer_recovery_codes FROM anon,authenticated;
GRANT ALL ON public.customer_passkeys, public.customer_passkey_challenges, public.customer_recovery_codes TO service_role;

CREATE OR REPLACE FUNCTION public.customer_passkey_add_v14(p_session_token text, p_credential_id text, p_public_key text, p_counter bigint, p_transports text[], p_device_type text, p_backed_up boolean, p_recovery_code text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE v_customer_id uuid;
BEGIN
 IF length(coalesce(p_recovery_code,''))<30 THEN RAISE EXCEPTION 'Código de recuperación inválido'; END IF;
 SELECT s.customer_id INTO v_customer_id
 FROM public.customer_sessions s JOIN public.customers c ON c.id=s.customer_id
 WHERE s.token_hash=encode(extensions.digest(coalesce(p_session_token,''),'sha256'),'hex')
 AND s.active AND s.expires_at>now() AND c.active LIMIT 1;
 IF v_customer_id IS NULL THEN RAISE EXCEPTION 'Sesión inválida'; END IF;
 INSERT INTO public.customer_passkeys(customer_id,credential_id,public_key,counter,transports,device_type,backed_up)
 VALUES(v_customer_id,p_credential_id,p_public_key,p_counter,coalesce(p_transports,'{}'),p_device_type,p_backed_up);
 INSERT INTO public.customer_recovery_codes(customer_id,code_hash)
 VALUES(v_customer_id,encode(extensions.digest(p_recovery_code,'sha256'),'hex'));
 RETURN true;
END;$function$
;

CREATE OR REPLACE FUNCTION public.customer_passkey_create_v14(p_name text, p_phone text, p_pin text, p_credential_id text, p_public_key text, p_counter bigint, p_transports text[], p_device_type text, p_backed_up boolean, p_recovery_code text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE v_phone text; v_c public.customers; v_token text;
BEGIN
 IF length(trim(coalesce(p_name,''))) NOT BETWEEN 2 AND 120 THEN RAISE EXCEPTION 'Nombre inválido'; END IF;
 IF p_pin !~ '^[0-9]{6}$' THEN RAISE EXCEPTION 'PIN de seis dígitos requerido'; END IF;
 v_phone:=public.normalize_customer_phone(p_phone);
 IF v_phone !~ '^5989[0-9]{7}$' THEN RAISE EXCEPTION 'Celular uruguayo inválido'; END IF;
 IF EXISTS (SELECT 1 FROM public.customers WHERE phone_normalized=v_phone) THEN RAISE EXCEPTION 'Celular ya registrado'; END IF;
 IF length(p_credential_id)<20 OR length(p_public_key)<20 OR length(p_recovery_code)<30 THEN RAISE EXCEPTION 'Credenciales incompletas'; END IF;
 INSERT INTO public.customers(phone_normalized,phone_display,full_name,pin_hash,pin_salt,active)
 VALUES(v_phone,trim(p_phone),trim(p_name),extensions.crypt(p_pin,extensions.gen_salt('bf',10)),null,true) RETURNING * INTO v_c;
 INSERT INTO public.customer_passkeys(customer_id,credential_id,public_key,counter,transports,device_type,backed_up)
 VALUES(v_c.id,p_credential_id,p_public_key,p_counter,coalesce(p_transports,'{}'),p_device_type,p_backed_up);
 INSERT INTO public.customer_recovery_codes(customer_id,code_hash)
 VALUES(v_c.id,encode(extensions.digest(p_recovery_code,'sha256'),'hex'));
 v_token:=encode(gen_random_bytes(32),'hex');
 INSERT INTO public.customer_sessions(customer_id,token_hash,device_label,expires_at,active)
 VALUES(v_c.id,encode(extensions.digest(v_token,'sha256'),'hex'),'web passkey',now()+interval '180 days',true);
 RETURN json_build_object('session_token',v_token,'customer',
 json_build_object('id',v_c.id,'full_name',v_c.full_name,'phone',v_c.phone_display));
END;$function$
;

CREATE OR REPLACE FUNCTION public.customer_passkey_login_v14(p_credential_id text, p_new_counter bigint)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE v_p public.customer_passkeys;v_c public.customers;v_token text;
BEGIN
 SELECT * INTO v_p FROM public.customer_passkeys WHERE credential_id=p_credential_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Credencial inexistente'; END IF;
 SELECT * INTO v_c FROM public.customers WHERE id=v_p.customer_id AND active;
 IF NOT FOUND THEN RAISE EXCEPTION 'Cuenta inactiva'; END IF;
 IF p_new_counter<0 OR (v_p.counter>0 AND p_new_counter<=v_p.counter)
 THEN RAISE EXCEPTION 'Contador inválido'; END IF;
 UPDATE public.customer_passkeys SET counter=p_new_counter,last_used_at=now() WHERE id=v_p.id;
 v_token:=encode(gen_random_bytes(32),'hex');
 INSERT INTO public.customer_sessions(customer_id,token_hash,device_label,expires_at,active)
 VALUES(v_c.id,encode(extensions.digest(v_token,'sha256'),'hex'),'web passkey',now()+interval '180 days',true);
 RETURN json_build_object('session_token',v_token,'customer',
 json_build_object('id',v_c.id,'full_name',v_c.full_name,'phone',v_c.phone_display));
END;$function$
;

CREATE OR REPLACE FUNCTION public.customer_passkey_recover_v14(p_phone text, p_recovery_code text, p_new_pin text, p_new_recovery_code text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE v_c public.customers;v_recovery uuid;v_token text;
BEGIN
 IF p_new_pin !~ '^[0-9]{6}$' OR length(p_recovery_code)<30 OR length(p_new_recovery_code)<30
 THEN RAISE EXCEPTION 'Datos inválidos'; END IF;
 SELECT * INTO v_c FROM public.customers WHERE phone_normalized=public.normalize_customer_phone(p_phone) AND active FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Datos de recuperación inválidos'; END IF;
 SELECT id INTO v_recovery FROM public.customer_recovery_codes
 WHERE customer_id=v_c.id AND code_hash=encode(extensions.digest(p_recovery_code,'sha256'),'hex')
 AND used_at IS NULL FOR UPDATE LIMIT 1;
 IF v_recovery IS NULL THEN RAISE EXCEPTION 'Datos de recuperación inválidos'; END IF;
 UPDATE public.customer_recovery_codes SET used_at=now() WHERE id=v_recovery;
 INSERT INTO public.customer_recovery_codes(customer_id,code_hash)
 VALUES(v_c.id,encode(extensions.digest(p_new_recovery_code,'sha256'),'hex'));
 UPDATE public.customers SET pin_hash=extensions.crypt(p_new_pin,extensions.gen_salt('bf',10)),updated_at=now() WHERE id=v_c.id;
 UPDATE public.customer_sessions SET active=false,last_seen_at=now() WHERE customer_id=v_c.id AND active;
 v_token:=encode(gen_random_bytes(32),'hex');
 INSERT INTO public.customer_sessions(customer_id,token_hash,device_label,expires_at,active)
 VALUES(v_c.id,encode(extensions.digest(v_token,'sha256'),'hex'),'web recuperacion',now()+interval '180 days',true);
 RETURN json_build_object('session_token',v_token,'customer',
 json_build_object('id',v_c.id,'full_name',v_c.full_name,'phone',v_c.phone_display));
END;$function$
;

REVOKE ALL ON FUNCTION public.customer_passkey_create_v14(text,text,text,text,text,bigint,text[],text,boolean,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.customer_passkey_create_v14(text,text,text,text,text,bigint,text[],text,boolean,text) TO service_role;
REVOKE ALL ON FUNCTION public.customer_passkey_add_v14(text,text,text,bigint,text[],text,boolean,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.customer_passkey_add_v14(text,text,text,bigint,text[],text,boolean,text) TO service_role;
REVOKE ALL ON FUNCTION public.customer_passkey_login_v14(text,bigint) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.customer_passkey_login_v14(text,bigint) TO service_role;
REVOKE ALL ON FUNCTION public.customer_passkey_recover_v14(text,text,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.customer_passkey_recover_v14(text,text,text,text) TO service_role;
