-- Traslados v13: email verificado para alta y recuperación del PIN.
-- Migración ADITIVA. No reasocia cuentas antiguas por coincidencia de teléfono.
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS email_verified text,
  ADD COLUMN IF NOT EXISTS auth_user_id uuid,
  ADD COLUMN IF NOT EXISTS email_verified_at timestamptz;
CREATE UNIQUE INDEX IF NOT EXISTS customers_email_verified_unique
  ON public.customers(lower(email_verified))
  WHERE email_verified IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS customers_auth_user_id_unique
  ON public.customers(auth_user_id)
  WHERE auth_user_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.customer_register_verified_email_v13(
  p_full_name text, p_phone text, p_pin text, p_device_label text DEFAULT 'web'
) RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public','extensions','auth'
AS $function$
DECLARE
  v_auth_uid uuid;
  v_email text;
  v_phone text;
  v_customer public.customers;
  v_token text;
BEGIN
  -- Supabase Auth verifies the email via OTP/magic link. Never trust a caller-supplied email.
  v_auth_uid := auth.uid();
  IF v_auth_uid IS NULL THEN RAISE EXCEPTION 'Verificá tu correo antes de crear tu cuenta'; END IF;
  SELECT lower(btrim(u.email)) INTO v_email
    FROM auth.users u
   WHERE u.id = v_auth_uid AND u.email_confirmed_at IS NOT NULL
     AND u.email IS NOT NULL AND u.deleted_at IS NULL
   LIMIT 1;
  IF v_email IS NULL THEN RAISE EXCEPTION 'El correo aún no está verificado'; END IF;

  IF char_length(btrim(coalesce(p_full_name,''))) NOT BETWEEN 2 AND 120 THEN
    RAISE EXCEPTION 'Ingresá un nombre válido';
  END IF;
  IF coalesce(p_pin,'') !~ '^[0-9]{6}$' THEN
    RAISE EXCEPTION 'El PIN debe tener 6 dígitos numéricos';
  END IF;
  v_phone := public.normalize_customer_phone(p_phone);
  IF v_phone !~ '^5989[0-9]{7}$' THEN
    RAISE EXCEPTION 'Ingresá un celular uruguayo válido';
  END IF;
  IF EXISTS (SELECT 1 FROM public.customers WHERE phone_normalized=v_phone) THEN
    RAISE EXCEPTION 'Ese celular ya está registrado. Contactanos para recuperar una cuenta anterior';
  END IF;
  IF EXISTS (SELECT 1 FROM public.customers WHERE auth_user_id=v_auth_uid OR lower(email_verified)=v_email) THEN
    RAISE EXCEPTION 'Ese correo ya tiene una cuenta de Traslados. Usá Recuperar PIN';
  END IF;

  INSERT INTO public.customers
      (phone_normalized, phone_display, full_name, pin_hash, pin_salt, active,
       email_verified, auth_user_id, email_verified_at)
  VALUES
      (v_phone, btrim(p_phone), btrim(p_full_name),
       extensions.crypt(p_pin, extensions.gen_salt('bf', 10)), NULL, true,
       v_email, v_auth_uid, now())
  RETURNING * INTO v_customer;

  v_token := encode(gen_random_bytes(32),'hex');
  INSERT INTO public.customer_sessions(customer_id,token_hash,device_label,expires_at,active)
  VALUES (v_customer.id,encode(extensions.digest(v_token,'sha256'),'hex'),
          nullif(btrim(coalesce(p_device_label,'')),''),now()+interval '180 days',true);

  RETURN json_build_object('session_token',v_token,
    'customer',json_build_object('id',v_customer.id,'full_name',v_customer.full_name,
                                 'phone',v_customer.phone_display));
END;
$function$;

CREATE OR REPLACE FUNCTION public.customer_reset_pin_verified_email_v13(
  p_new_pin text, p_device_label text DEFAULT 'web'
) RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public','extensions','auth'
AS $function$
DECLARE
  v_uid uuid;
  v_email text;
  v_customer public.customers;
  v_token text;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Verificá el correo para cambiar el PIN'; END IF;
  SELECT lower(btrim(u.email)) INTO v_email FROM auth.users u
   WHERE u.id=v_uid AND u.email_confirmed_at IS NOT NULL
     AND u.email IS NOT NULL AND u.deleted_at IS NULL LIMIT 1;
  IF v_email IS NULL THEN RAISE EXCEPTION 'El correo no está verificado'; END IF;
  IF coalesce(p_new_pin,'') !~ '^[0-9]{6}$' THEN
    RAISE EXCEPTION 'El PIN debe contener 6 dígitos';
  END IF;

  -- No linking by phone/email alone. An account must have been created under this Auth UID.
  SELECT * INTO v_customer FROM public.customers
   WHERE auth_user_id=v_uid AND lower(email_verified)=v_email AND active
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No encontramos una cuenta vinculada a ese correo. Contactanos';
  END IF;

  UPDATE public.customers
     SET pin_hash=extensions.crypt(p_new_pin,extensions.gen_salt('bf',10)),
         updated_at=now()
   WHERE id=v_customer.id;
  UPDATE public.customer_sessions SET active=false,last_seen_at=now()
   WHERE customer_id=v_customer.id AND active;

  v_token := encode(gen_random_bytes(32),'hex');
  INSERT INTO public.customer_sessions(customer_id,token_hash,device_label,expires_at,active)
  VALUES (v_customer.id,encode(extensions.digest(v_token,'sha256'),'hex'),
          nullif(btrim(coalesce(p_device_label,'')),''),now()+interval '180 days',true);
  RETURN json_build_object('session_token',v_token,
    'customer',json_build_object('id',v_customer.id,'full_name',v_customer.full_name,
                                 'phone',v_customer.phone_display));
END;
$function$;

REVOKE ALL ON FUNCTION public.customer_register_verified_email_v13(text,text,text,text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.customer_reset_pin_verified_email_v13(text,text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.customer_register_verified_email_v13(text,text,text,text)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.customer_reset_pin_verified_email_v13(text,text)
  TO authenticated;

COMMENT ON FUNCTION public.customer_register_verified_email_v13(text,text,text,text)
  IS 'Crear cliente únicamente tras verificar email con Supabase Auth; nunca confiar en email del navegador';
COMMENT ON FUNCTION public.customer_reset_pin_verified_email_v13(text,text)
  IS 'Restablecer PIN por Auth UID y email verificado, invalidando sesiones anteriores';
