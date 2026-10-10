# Web principal de Traslados — Cloudflare Workers

**Decisión expresa del usuario (10/10/2026):** la web completa y definitiva para pasajeros debe estar en **https://traslados-web.marcelof-gx.workers.dev/**. GitHub Pages **NO** es la dirección pública principal ni la fuente de verdad de la experiencia final. Esta decisión prevalece sobre recomendaciones antiguas de promover la PWA Pages a producción.

## Arquitectura acordada

- **Workers, repositorio `marcelofgx-ctrl/traslados-web`:** portada cálida premium, reserva, origen y destino, paradas intermedias, búsqueda Uruguay, distancias y minutos A→B, tarifa orientativa, modos ahora/10 minutos/programado, estado del conductor obtenido de Mapa, registro/acceso, reservas e historial y propuesta final del conductor.
- **Supabase operativo `zetaudvvutlouiqxopvg`:** agenda y cotizaciones, ruta cacheada, tarifa PIN, heartbeat opt-in desde Mapa. El GPS privado nunca se publica crudo. El motor ORS en Workers se comprobó anteriormente con kilómetros/minutos/tarifa reales.
- **Mapa Trayectos:** jornada y conducción GPS, consentimiento y marcado ocupado, fuente de estado en vivo.
- **Cliente Android nativo:** utiliza el mismo backend; debe conservar paridad funcional.
- **GitHub Pages `marcelofgx-ctrl.github.io/traslados-android/web-pasajero/`:** beta/PWA secundaria para QA y comparación hasta migración controlada. No redirigir ni cerrar antes de publicar y probar Workers.

## Estado comprobado al 10/10/2026

- El repositorio Workers tiene `BookingQuickSummary`, `RoutePreview`, `PickupModePicker`, `BookingAvailability`, `DriverPickupEta`, `PremiumHome`, historial, Passkeys, control de paradas, ORS y acceso al Supabase correcto a nivel de módulos operativos.
- Antes de este corte, **la consulta de disponibilidad desde Workers solo aparecía dentro del componente Booking, protegido por login**. Se agregó `DriverLiveStatus.tsx` a la portada `PremiumHome.tsx`: consulta `public_driver_availability_v1` anon, sin coordenadas, cada 40 s y al volver a la pestaña. Es una tarjeta compacta premium; **no promete llegada ni confirma reservas**.
- La consulta precisa Conductor→origen A sigue siendo protegida por sesión en `DriverPickupEta`. La variante sin cuenta con posición aproximada fue **bloqueada por validación de seguridad en la Edge Function**; aunque exista una migración SQL para datos cuantizados, no está probado un flujo público anónimo con km/min. No exponer una ruta que permita triangular GPS ni afirmar que esos km/min ya se muestran sin cuenta.
- La home de Workers y las rutas de reservas no requieren importar ni copiar toda la PWA Pages, pero faltan verificaciones reales de paridad visual y funcional. En Workers el botón «Reservar» aún lleva a acceso/registro cuando no hay sesión: distinto a la PWA pública con A/B antes del login. Es un **gap real** a resolver deliberadamente: permitir preparar presupuesto sin cuenta sin enviar reservas no autorizadas, y pedir identificación únicamente antes de confirmar.
- `wrangler.jsonc` usa `keep_vars:true` y NO contiene `ORS_API_KEY`; no introducir claves en GitHub. Se había visto en una captura de Cloudflare como Variable visible; conviene rotar y configurar como Secret sin copiarlas a chat.

## Publicación controlada

Workflow [`publicar-cloudflare-manual.yml`](https://github.com/marcelofgx-ctrl/traslados-web/blob/main/.github/workflows/publicar-cloudflare-manual.yml) tiene **solo** `workflow_dispatch` y requiere `CLOUDFLARE_API_TOKEN` y `CLOUDFLARE_ACCOUNT_ID` en GitHub Secrets. Nunca asumir que existen; CI verde en `traslados-web-ci.yml` NO es despliegue. No hay herramienta de Cloudflare conectada en esta conversación para activar el despliegue remotamente.

Antes de publicar ejecuta pruebas de agenda, cliente, rutas, seguridad y TypeScript, compila con Bun y usa `wrangler deploy`. Después confirma SSR de la portada y la ruta de control ORS con km/min/tarifa. Si faltan credenciales, detener el proceso sin exponer secretos y pedir configurar GitHub Secrets desde la interfaz de GitHub.

**NO declarar la última versión de Workers publicada hasta que el run manual dé SUCCESS y una lectura del Workers público muestre el nuevo estado.** Una compilación exitosa únicamente confirma que el código listo para publicar no tiene fallos de build.

## Próximas prioridades

1. Confirmar CI del último commit y lanzar el workflow manual con credenciales disponibles. Si faltan, guiar al usuario por Cloudflare/GitHub, sin copiar secretos al chat.
2. Publicar la nueva portada en Workers y verificarla en Samsung. Confirmar la tarjeta de disponibilidad y lectura de Mapa.
3. Reconciliar la experiencia completa del formulario (A/B y estimación visibles antes del login, tarifas, paradas, UX premium), **manteniendo autorización antes de crear reservas**.
4. Prueba consentida de punta a punta Conductor→Pasajero con reserva y presupuesto final.
5. Tras la validación, difundir exclusivamente la URL Workers como pública; dejar Pages como entorno de prueba o redirigir con plan para PWA instalada.

**Contexto maestro transversal:** https://github.com/marcelofgx-ctrl/traslados-android/blob/main/docs/CONTEXTO_MAESTRO_PROYECTOS.md
