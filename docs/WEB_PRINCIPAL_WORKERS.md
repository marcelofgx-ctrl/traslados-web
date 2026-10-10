# Web principal de Traslados — Cloudflare Workers

**Decisión expresa del usuario (10/10/2026):** la web completa y definitiva para pasajeros debe estar en **https://traslados-web.marcelof-gx.workers.dev/**. GitHub Pages **NO** es la dirección pública principal ni la fuente de verdad de la experiencia final. Esta decisión prevalece sobre recomendaciones antiguas de promover la PWA Pages a producción.

## Auditoría de reanudación (10/10/2026)

- **Código R3:** commit `4d4152e1`, [CI 38024838373](https://github.com/marcelofgx-ctrl/traslados-web/actions/runs/38024838373) SUCCESS en dos jobs. Posterior commit `26dea1da` solo documenta y [CI 38024918603](https://github.com/marcelofgx-ctrl/traslados-web/actions/runs/38024918603) SUCCESS en ambos jobs. No se identificó un error de compilación activo en esos cortes.
- **Publicación:** consulta real a GitHub de `event=workflow_dispatch` dio **0 ejecuciones** en el historial de este repositorio. **NO hay evidencia de que el workflow manual publicara Workers R3**. La URL Cloudflare no fue accesible desde las herramientas de esta auditoría: tampoco se pudo capturar pantalla real. Estado real del HTML en producción **sin verificar**.
- **Seguridad/configuración en main:** Worker `traslados-web`, `PASSKEY_PUBLIC_ORIGIN=https://traslados-web.marcelof-gx.workers.dev`, `keep_vars:true` y sin `ORS_API_KEY` versionada. Mantener la URL y secretos; no disparar deploy con un trigger nuevo ni usar GitHub Pages como reemplazo.
- **Integraciones:** Supabase `zetaudvvutlouiqxopvg` responde con estado `ACTIVE_HEALTHY`; existen tablas de reservas, Mapa y presencia con RLS, y función Edge `pickup-eta` activa. No se comprobaron heartbeat fresco ni operaciones de reserva end-to-end. Código R3 inspeccionado: invitado consulta recorrido A/B con paradas y precio si existe ruta real; estado público sin GPS; ETA conductor→origen protegida por sesión. `Ahora` y `En 10 min` siguen como **consulta WhatsApp**, no creación automática confirmada.
- **Desbloqueo:** el titular debe ejecutar [Publicar Traslados Web en Cloudflare (manual)](https://github.com/marcelofgx-ctrl/traslados-web/actions/workflows/publicar-cloudflare-manual.yml) → **Run workflow → main**; el conector GitHub utilizado carece de `workflow_dispatch`. Revisar conclusión, marcador HTML `workers-2026-10-10-r3`, ORS y tarifa; luego QA móvil y una reserva real autorizada. No modificar la web estética aprobada antes de esa verificación.
- **Coordinación:** esta revisión se registró también en el [contexto maestro](https://github.com/marcelofgx-ctrl/traslados-android/blob/main/docs/CONTEXTO_MAESTRO_PROYECTOS.md) (commit `787da926`). Ningún código visual, APK, reserva ni secreto cambió por esta auditoría.

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
- **MEJORA IMPLEMENTADA Y PROBADA CI 10/10:** el botón Reservar de Workers ahora muestra `GuestRoutePlanner` a usuarios sin sesión: origen, destino, hasta ocho paradas con ajuste y orden, km/min por carretera y tarifa orientativa calculada por `BookingQuickSummary`/`useRoadEstimate` (motor ORS/Caché). No se llama a `createReservation` ni `checkAvailability` en el componente invitado. Al pulsar «Continuar para solicitar» se guarda un borrador tipado en estado y `sessionStorage` con TTL 2 h; después del acceso el formulario `Booking` inicializa origen/destino/paradas de ese borrador, consulta agenda con token, y requiere revisión y envío autenticados. Se borra borrador solo después de `onSent` exitoso. La sesión no es necesaria para estimar, pero SÍ para reservar; un presupuesto de referencia no es definitivo. CI [38023590926](https://github.com/marcelofgx-ctrl/traslados-web/actions/runs/38023590926) SUCCESS con tests guest, TS, build y Worker HTTP local. **NO afirmar que fue desplegado en Workers** hasta ejecutar el workflow manual de publicación y revisar producción.
- `wrangler.jsonc` usa `keep_vars:true` y NO contiene `ORS_API_KEY`; no introducir claves en GitHub. Se había visto en una captura de Cloudflare como Variable visible; conviene rotar y configurar como Secret sin copiarlas a chat.

## Revisión premium R3 y dominio inmutable (10/10/2026)

**Petición explícita del usuario:** conservar permanentemente **https://traslados-web.marcelof-gx.workers.dev/** como link de clientes y actualizar la versión premium más completa **en esa ruta**, nunca publicarla en otro subdominio ni convertir GitHub Pages en producción.

**Observación de captura 01:34:** aparece una selección de horario extensa con «Recogida lo antes posible» y estado Mapa en tarjeta adicional. El nuevo `GuestRoutePlanner` previo al login no modifica esa pantalla autenticada automáticamente: era el `Booking` original. Se trabajó también ese flujo de cliente identificado.

**Implementado en main, versión R3:**
- `PickupModePicker` ahora es compacto, suave, petróleo/champagne. «Ahora / En 10 min / Programar», consejo breve, WhatsApp y explicaciones opcionales. `DriverPickupEta compact` se incluye **dentro de la misma tarjeta**, eliminando duplicación de paneles enormes, sin cambiar la seguridad GPS ni confirmación del viaje.
- `src/routes/index.tsx` imprime en el HTML `data-web-release="workers-2026-10-10-r3"` y en el footer «Web principal · Workers R3», para distinguir código desplegado de screenshots antiguas.
- `wrangler.jsonc` conserva `"name":"traslados-web"`, `PASSKEY_PUBLIC_ORIGIN=https://traslados-web.marcelof-gx.workers.dev`, `keep_vars:true`.
- El workflow manual ahora comprueba **ANTES** de desplegar que el nombre y origen son los exactos, que no se pierden vars/secrets y que ORS_API_KEY no se incluye en `wrangler.jsonc`; **DESPUÉS** comprueba la marca R3, el motor ORS y tarifa de referencia. No hace redirección ni crea un Worker alternativo.
- **CI final confirmado [38024838373](https://github.com/marcelofgx-ctrl/traslados-web/actions/runs/38024838373) SUCCESS en 2 jobs** (Bun 1.2.15/1.3.4, tests, TypeScript y build Workers) en commit `4d4152e1ff0b6d10a57169cf3c6ea06eda29cd6a`. No se encontraron runs de publicación manual en la lista reciente de Actions.

**Estado de publicación:** aún **NO verificado/desplegado** R3. [Ejecutar el workflow existente](https://github.com/marcelofgx-ctrl/traslados-web/actions/workflows/publicar-cloudflare-manual.yml) desde la cuenta autorizada eligiendo `Run workflow → main`; requiere GitHub Secrets `CLOUDFLARE_API_TOKEN` y `CLOUDFLARE_ACCOUNT_ID`. El conector actual no tiene la acción de `workflow_dispatch` ni acceso a secretos. No intentar sortearlo; el propietario debe iniciar esa ejecución. Después verificar en el mismo enlace del sitio que aparezca footer Workers R3, la cotización de A→B previa a login y la tarjeta de ETA compacta autenticada.


## Publicación controlada

Workflow [`publicar-cloudflare-manual.yml`](https://github.com/marcelofgx-ctrl/traslados-web/blob/main/.github/workflows/publicar-cloudflare-manual.yml) tiene **solo** `workflow_dispatch` y requiere `CLOUDFLARE_API_TOKEN` y `CLOUDFLARE_ACCOUNT_ID` en GitHub Secrets. Nunca asumir que existen; CI verde en `traslados-web-ci.yml` NO es despliegue. No hay herramienta de Cloudflare conectada en esta conversación para activar el despliegue remotamente.

Antes de publicar ejecuta pruebas de agenda, cliente, rutas, seguridad y TypeScript, compila con Bun y usa `wrangler deploy`. Después confirma SSR de la portada y la ruta de control ORS con km/min/tarifa. Si faltan credenciales, detener el proceso sin exponer secretos y pedir configurar GitHub Secrets desde la interfaz de GitHub.

**NO declarar la última versión de Workers publicada hasta que el run manual dé SUCCESS y una lectura del Workers público muestre el nuevo estado.** Una compilación exitosa únicamente confirma que el código listo para publicar no tiene fallos de build.

## Próximas prioridades

1. Confirmar CI del último commit y lanzar el workflow manual con credenciales disponibles. Si faltan, guiar al usuario por Cloudflare/GitHub, sin copiar secretos al chat.
2. Publicar la nueva portada en Workers y verificarla en Samsung. Confirmar la tarjeta de disponibilidad y lectura de Mapa.
3. **REALIZADO en main y CI:** A/B, paradas, estimación antes del login y borrador conservado. Pendiente QA real de usuario en navegador Samsung tras publicar el Worker principal.
4. Prueba consentida de punta a punta Conductor→Pasajero con reserva y presupuesto final.
5. Tras la validación, difundir exclusivamente la URL Workers como pública; dejar Pages como entorno de prueba o redirigir con plan para PWA instalada.

**Contexto maestro transversal:** https://github.com/marcelofgx-ctrl/traslados-android/blob/main/docs/CONTEXTO_MAESTRO_PROYECTOS.md

## GPS asistido en el formulario (10/10/2026)

**Motivo:** al pedir la ubicación en Samsung Android la PWA auxiliar mostró el bloqueo de permisos por aplicaciones superpuestas. El cliente no debe quedar atrapado en un bucle «Reintentar» ni recibir un mensaje genérico.

- **IMPLEMENTADO EN CÓDIGO** en `src/components/UyLocationPicker.tsx`: error de permiso (1), GPS no disponible (2), timeout (3), tarjeta de ayuda visual petróleo/champagne con instrucciones para Chrome/Android, botones **Volver a intentar** y **Escribir dirección**. El navegador solicita el permiso únicamente tras pulsación; ningún frontend puede habilitarlo automáticamente ni ignorar la protección anti-superposición. Se corrigió el estado de carga cuando llegan coordenadas fuera de Uruguay.
- **CI / seguridad:** `tests/location-permission.test.ts` se ejecuta tanto en `traslados-web-ci.yml` como en `publicar-cloudflare-manual.yml`; CI [38026179460](https://github.com/marcelofgx-ctrl/traslados-web/actions/runs/38026179460) **SUCCESS (2 jobs)** para esa primera revisión. Revisar CI del último commit posterior antes de desplegar.
- **PARIDAD:** la PWA auxiliar `traslados-android/web-pasajero/` recibió ayuda equivalente y cache v14; CI + Pages SUCCESS. No confundir esa publicación con la del Worker.
- **PUBLICACIÓN WORKERS NO CONFIRMADA**: preservar URL `https://traslados-web.marcelof-gx.workers.dev/`; el conector GitHub actual carece de `workflow_dispatch`. Debe ejecutarse el [workflow manual existente](https://github.com/marcelofgx-ctrl/traslados-web/actions/workflows/publicar-cloudflare-manual.yml) desde GitHub, sin alterar credenciales ni `keep_vars`. Verificar luego el navegador Samsung; CI no prueba concesión real de GPS.

## Identidad pública sin plataformas de desarrollo — corte 10/10/2026

**Decisión:** el pasajero solo debe reconocer **Traslados**, sin links públicos hacia GitHub, GitHub Actions, documentación de desarrollo o nombres comerciales de proveedores técnicos. No hacer redirección del enlace oficial a la PWA secundaria porque mostraría `github.io` en la barra de direcciones. **Publicar directamente la experiencia premium mediante el Worker existente**, preservando la URL canónica aprobada.

- **Implementado en código (revisión interna R4):** `src/routes/index.tsx` muestra «Atención personal · Uruguay» en vez de «Web principal · Workers R3», elimina del pie el acceso legado Conductor y conserva la referencia interna neutra `data-app-release="traslados-2026-10-10-r4"`. `CustomerShareTools.tsx` indica «sitio oficial de Traslados» en QR; `BookingQuickSummary.tsx` explica el cálculo de manera comercial, sin mostrar nombres de proveedores. Se preserva la atribución legal cartográfica © OpenStreetMap contributors.
- **Pruebas:** `tests/public-branding.test.ts` y el test canónico evitan regresiones; `traslados-web-ci.yml` y `publicar-cloudflare-manual.yml` verifican R4. GitHub Actions [38060418736](https://github.com/marcelofgx-ctrl/traslados-web/actions/runs/38060418736) **SUCCESS** después de los cambios, con 2 jobs. Las ejecuciones fallidas intermedias corresponden a la transición del marcador R3→R4; no usar esas revisiones intermedias.
- **PUBLICACIÓN:** **pendiente** de `Run workflow → main` en el [workflow manual canónico](https://github.com/marcelofgx-ctrl/traslados-web/actions/workflows/publicar-cloudflare-manual.yml). La verificación de versión tras deploy ahora exige R4, no R3. No se creó nuevo Worker, no se movió la dirección, no se cambiaron secretos, backend ni reservas.
- **Límite técnico de confidencialidad:** el host acordado `traslados-web.marcelof-gx.workers.dev` contiene el nombre de la plataforma en su sufijo. Para una dirección completamente de marca se requiere configurar **un dominio propio** en el mismo Worker y compartirlo como enlace principal cuando el titular lo autorice; mantener el enlace antiguo operativo. El inspector de navegador puede mostrar llamadas a proveedores y atribuciones legales, por lo que **no prometer ocultamiento técnico absoluto** mediante una mera sustitución de textos.
- La PWA GitHub Pages se conserva auxiliar y recibió limpieza de enlaces de desarrollo en su instalación, pero **no se debe distribuir su URL como dirección de atención al cliente**.
