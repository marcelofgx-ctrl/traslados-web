# Traslados Web — activación de correo (sin SMS)

## Estado — 08/10/2026

Migración Supabase v13 customer_email_verificado_v13 aplicada en proyecto operativo zetaudvvutlouiqxopvg.

- Campos opcionales de clientes: email_verified, email_verified_at, auth_user_id.
- Función customer_register_verified_email_v13: exige token Supabase Auth autenticado y email_confirmed_at, sin aceptar que el navegador declare arbitrariamente el email.
- Función customer_reset_pin_verified_email_v13: requiere el mismo auth_user_id y correo confirmado; invalida todas las sesiones anteriores al cambiar el PIN.
- Funciones v13 accesibles únicamente por rol authenticated, no por anon.
- Pantallas en src/components/EmailAccess.tsx y src/lib/operativa/email-auth.ts: enlaces mágicos para crear cuenta y recuperar PIN.
- Flag de seguridad VITE_EMAIL_AUTH_READY apagado por defecto. No activar sin SMTP y prueba de entrega.
- Cuentas antiguas sin correo asociado: requieren vinculación asistida, nunca reclamar simplemente por coincidencia de teléfono.
- API heredada customer_register y customer_login sigue en uso para compatibilidad con APK antiguas; aún falta migrar y fortalecer la autenticación antigua antes de imponer email obligatorio en todas las plataformas.

## SMTP gratis para usuarios reales

Supabase predeterminado solo envía correos a miembros autorizados del proyecto. Requiere SMTP externo para usuarios comunes. Una opción gratuita para bajo volumen es SMTP2GO: https://www.smtp2go.com/ ; hasta 1000 correos/mes, 200/día con restricciones. Documentación: https://support.smtp2go.com/hc/en-gb/articles/223087947-Free-Plan . La verificación individual de un remitente puede no funcionar con Gmail por las políticas DMARC. Se recomienda usar un dominio autenticado (SPF/DKIM/DMARC).

1. Crear cuenta en SMTP2GO (o proveedor de SMTP equivalente), verificar remitente y obtener host, port, usuario, contraseña. Nunca enviar claves por ChatGPT ni GitHub.
2. En Supabase operativo activar SMTP personalizado: https://supabase.com/dashboard/project/zetaudvvutlouiqxopvg/auth/smtp .
3. En Auth URL Configuration: https://supabase.com/dashboard/project/zetaudvvutlouiqxopvg/auth/url-configuration fijar Site URL a https://traslados-web.marcelof-gx.workers.dev y permitir retorno en https://traslados-web.marcelof-gx.workers.dev/** .
4. Authentication → Providers → Email: email habilitado y confirmación de email obligatoria, NO autoconfirmación.
5. Authentication → Email Templates → Magic Link: mantener plantilla estándar con variable ConfirmationURL; frontend usa ENLACES, no OTP numérico.
6. Configurar CAPTCHA, rate limit para auth OTP y protección de fuerza bruta sobre acceso anterior con PIN.
7. En Cloudflare Workers & Pages → traslados-web → Settings/Build, agregar variable de COMPILACIÓN VITE_EMAIL_AUTH_READY=true y volver a compilar main.

## Pruebas requeridas ANTES de producción

- Enviar correo real de registro a email no perteneciente al equipo Supabase.
- Abrir enlace desde el navegador y volver a sitio con ?auth_email=registro.
- Crear nombre, celular, PIN. Verificar que nuevo cliente se guarda en base operativa y pueda entrar.
- Recuperar PIN por correo verificado y comprobar revocación de sesiones anteriores.
- Comprobar que correo ajeno / teléfono existente no permite reclamar reservas históricas.
- No habilitar hasta configurar SMTP, URL y realizar estas verificaciones.

La compilación de CI NO prueba envío real de correo ni dominios en Cloudflare.
