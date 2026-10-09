# Traslados — activación segura de passkeys (v14)

Actualizado: octubre 2026. Código implementado y CI verificado. NO encender al público antes de completar los controles siguientes.

## Qué está implementado

- WebAuthn (SimpleWebAuthn 14) con validación en el SERVIDOR de desafío, firma, RP ID, origen y verificación local del usuario (huella/PIN del teléfono/rostro).
- Desafíos aleatorios de cinco minutos en Supabase, consumidos una sola vez, limitados por IP (máximo diez nuevos desafíos por diez minutos).
- Registro de cuenta nueva con nombre, celular uruguayo y PIN alternativo, sin vincular datos históricos por coincidencia de teléfono.
- Acceso directo mediante passkey descubierta desde el móvil, opción PIN heredada; añadir passkey a cuenta existente tras acceder con PIN.
- Recuperación de PIN con nueva firma WebAuthn en el mismo dispositivo.
- Recuperación alternativa con código de respaldo aleatorio de 256 bits, disponible una sola vez, guardado solo como SHA-256 en el servidor. Después de recuperarlo, se reemplaza por otro código y se invalidan sesiones anteriores.
- Supabase operativo zetaudvvutlouiqxopvg: tablas customer_passkeys, customer_passkey_challenges, customer_recovery_codes; cinco funciones privadas para v14; backups hash, PIN hash bcrypt.
- La APK Conductor y reservas no se modificaron. Los clientes existentes conservan su historial.
- WebAuthn NO almacena huella en servidores. Usa el sistema de bloqueo seguro del dispositivo.

## Lo que se necesita configurar en Cloudflare

El conector Cloudflare no está disponible en este chat. NO escribir los secretos en GitHub, en ChatGPT ni en variables públicas de Vite.

Panel del Worker: https://dash.cloudflare.com/aeda5eba5536ca3ffad786c099abb71a/workers/services/view/traslados-web/production

Cloudflare > Workers & Pages > traslados-web > Settings > Variables and Secrets (RUNTIME, NO build variables):

1. PASSKEY_SUPABASE_SERVICE_ROLE_KEY — tipo **Secret** — API key service_role del proyecto Supabase operativo zetaudvvutlouiqxopvg. Acceso directo al panel: https://supabase.com/dashboard/project/zetaudvvutlouiqxopvg/settings/api-keys . NUNCA colocar en VITE_* ni en repositorio.
2. PASSKEY_PUBLIC_ORIGIN — tipo Text — valor https://traslados-web.marcelof-gx.workers.dev (sin barra final).
3. PASSKEY_AUTH_ENABLED — tipo Text — valor true SOLO CUANDO las dos variables anteriores estén bien configuradas y se haya aprobado el dominio definitivo.

El código considera activación false si falta secret o flag. Protege requests con Origin y con comparación exacta del dominio.
El servicio del proyecto actual permanece desactivado hasta entonces.

## ADVERTENCIA DE DOMINIO

Las passkeys están asociadas criptográficamente a un RP ID (hostname). Si hoy las registramos en traslados-web.marcelof-gx.workers.dev y mañana cambiamos a trasladosuy.pp.ua, esas passkeys NO funcionarán en el dominio nuevo. Habrá que registrar una passkey nueva, manteniendo la cuenta mediante PIN/código.

Por eso recomiendo fijar el dominio público definitivo ANTES de permitir el registro de clientes reales. Para un dominio nuevo, ajustar PASSKEY_PUBLIC_ORIGIN y la URL pública. Nunca aceptar cualquier dominio enviado por el navegador.

## Pruebas obligatorias previas a producción

- [ ] Worker real con secret y flag activados devuelve enabled true en GET /api/auth/passkey.
- [ ] Validación de usuario real en Android: generar passkey, guardar código de respaldo y volver a ingresar.
- [ ] Añadir passkey a una cuenta existente sin cambiar el historial.
- [ ] Crear PIN nuevo mediante passkey verificada.
- [ ] Recuperación alternativa con código de respaldo: comprobar invalidez del anterior y de las sesiones previas.
- [ ] Registro con celular ya existente debe rechazarse y NO reasociar sus viajes.
- [ ] Solicitud desde otro Origin debe devolver 403.
- [ ] Desafío repetido o vencido debe ser rechazado.
- [ ] Verificar compatibilidad con dominio definitivo y navegadores Android/iOS.

## Estado y dependencias

GitHub: https://github.com/marcelofgx-ctrl/traslados-web .
API server-only: src/lib/passkey.server.ts; route: src/routes/api/auth/passkey.ts.
Cliente: src/lib/operativa/passkeys.ts; interfaz: src/components/PasskeyAccess.tsx.
Migración SQL reproducible: supabase/migrations/20261009_customer_passkeys_v14.sql (se completará con la función de recuperación adicional).

Dependencias @simplewebauthn/server 14.0.3 y @simplewebauthn/browser 14.0.0.
CI debe ejecutar TypeScript estricto, build, smoke HTTP y negar acceso sin secrets.

## Observaciones de seguridad pendientes

- La función customer_login PIN heredada, que utilizan las APK, tiene seis cifras y no dispone aún de bloqueo por intentos en el servidor. Evaluar rate limit/lockout SIN romper las APK antes de difusión amplia.
- No existe verificación de la propiedad del teléfono por SMS; la passkey prueba control del dispositivo y la cuenta registrada, no titularidad del número declarado.
- Si se pierde passkey, PIN y código de recuperación, solo un procedimiento asistido y verificado podrá restituir el acceso.
- El frontend de email v13 permanece sin SMTP y no forma parte del flujo actual.
