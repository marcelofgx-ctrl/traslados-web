# Activación del motor de rutas y estimación de Traslados

## Estado comprobado
El motor real ya existe en `src/routes/api/public/route-estimate.ts` y utiliza openrouteservice de HeiGIT/OpenStreetMap. El cliente Web Premium y la PWA GitHub Pages utilizan la MISMA URL: `https://traslados-web.marcelof-gx.workers.dev/api/public/route-estimate`.

El smoke público del 09/10/2026 [Actions 38011099526](https://github.com/marcelofgx-ctrl/traslados-android/actions/runs/38011099526) obtuvo **HTTP 503**, `{available:false,reason:"not_configured"}`. El Worker desplegado NO encuentra `ORS_API_KEY`; no es un defecto del formulario ni de la geobúsqueda. No publicar valores de km/min ni precios calculados hasta que haya ruta real.

## Activación segura sin compartir credenciales

1. Crear/usar una clave de API para **openrouteservice** en la cuenta del proveedor ([portal de HeiGIT](https://api.heigit.org/)). Consultar cuotas y usos permitidos del plan; no suponer tráfico ilimitado ni una garantía de disponibilidad.
2. En la configuración del **Worker de producción** `traslados-web` de Cloudflare, agregar **secret** `ORS_API_KEY` con esa clave mediante su propio panel. No ponerla en Github, JavaScript, Android, capturas ni chats. Una variable de entorno de una sesión local no configura automáticamente el Worker remoto.
3. Opcional: definir `FARE_REFERENCE_UYU_PER_KM=40` como variable del Worker. Sin esa variable, el código contempla 40 UYU/km: 8 km → 320 UYU, 43 km → 1720 UYU. Es un valor orientativo sin extras, redondeado a diez pesos y sujeto a confirmación del Conductor desde Mapa. La variable puede ajustarse internamente; el frontend no fija un importe.
4. **Desplegar el código web actualizado** además de guardar el secret. Hay un workflow manual en [GitHub Actions](../.github/workflows/publicar-cloudflare-manual.yml); requiere `CLOUDFLARE_API_TOKEN` y `CLOUDFLARE_ACCOUNT_ID` configurados exclusivamente como secretos del repositorio. Si Cloudflare ya publica mediante integración de GitHub u otro pipeline, usar esa vía y no activar despliegues duplicados.
5. Probar con una ruta de ejemplo: `GET https://traslados-web.marcelof-gx.workers.dev/api/public/route-estimate?points=-56.016380%2C-34.836960%3B-56.180000%2C-34.900000`. Respuesta de éxito debe tener `available:true`, `distanceKm`, `durationMin`, `referenceFareUyu` y `calculatedAt`. Un 503 con `not_configured` señala la clave ausente; `temporarily_unavailable` puede indicar proveedor/red/cuota; `no_route` señala que no se determinó una ruta válida. No escribir coordenadas ni precios inventados como fallback.
6. Verificar desde **Chrome Android** los campos de A/B y las medidas; repetir con una parada si procede. El backend protege la llave: nunca regresa al navegador.

## Restricciones y siguiente bloque de trabajo

El servicio de distancias A→B no informa ubicación del Conductor. Para `Ahora / En 10 min` se necesita una transmisión GPS **opt-in**, estado explícito libre/ocupado y consentimiento revocable desde Mapa, una tabla privada, caducidad de ubicación (~90 s) y servicio del lado servidor que calcule Conductor→A con ORS. No publicar coordenadas del conductor ni deducir que está libre porque no tiene reservas; podría trabajar para Uber/Cabify. Actualmente las consultas urgentes se coordinan vía WhatsApp, sin simular ETAs ni crear reservas inválidas. Supabase tiene un lead time efectivo de **30 minutos** para reservas programadas mientras la configuración de disponibilidad no se cambie.

Si en futuras sesiones el usuario solicita «activar ya», distinguir cambios de código/CI, despliegue remoto, secreto vigente y prueba en teléfono. Evitar afirmar que un CI verde significa que el proveedor está configurado.
