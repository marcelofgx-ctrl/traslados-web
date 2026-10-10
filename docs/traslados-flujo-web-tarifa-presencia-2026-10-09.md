# Traslados — flujo de reservas, referencia por km y llegada del conductor

Corte: 09/10/2026 (Uruguay). Coordinación: https://github.com/marcelofgx-ctrl/traslados-android/blob/main/docs/CONTEXTO_MAESTRO_PROYECTOS.md

## Verificación operacional posterior (09/10/2026)

**Diagnóstico HTTP DE PRODUCCIÓN VERIFICADO en GitHub Actions:** smoke público de Pages run 38011099526, job 114091038144: la PWA v4 pasó checks de HTML/JS, índice 22.499 lugares y recurso precio; pero la llamada a Cloudflare GET /api/public/route-estimate devolvió **HTTP 503**, JSON **reason: not_configured**, available=false. Por tanto **ORS_API_KEY no está configurada/visible para el Worker actual**. SIN ESTA CREDENCIAL el motor por calles y su tarifa referencial NO funcionan en producción, aunque el código nuevo esté compilado y la web PWA desplegada. No mostrar $320 como si lo calculó el servidor antes de corregirlo. El endpoint utiliza el host vigente api.heigit.org.

Se habilitó despliegue MANUAL y controlado del Worker en GitHub Actions: .github/workflows/publicar-cloudflare-manual.yml, commit 4365d412. No despliega con cada push; requiere secretos GitHub CLOUDFLARE_API_TOKEN y CLOUDFLARE_ACCOUNT_ID si se opta por esa vía. Alternativamente configurar ORS_API_KEY en Cloudflare Workers & Pages > Worker traslados-web > Settings > Variables and Secrets > Add > Secret, guardar/deploy, y desplegar el código actualizado mediante Wrangler / vía de publicación existente. La tasa 40 se puede cambiar en el Worker con FARE_REFERENCE_UYU_PER_KM (texto no secreto). No solicitar que se peguen credenciales al chat ni subirlas a GitHub.

**Clasificación actual:** Pages PWA v4 PUBLICADA y smoke VALIDADO; Cloudflare web build CI SUCCESS; precio en Worker IMPLEMENTADO EN CÓDIGO, NO ACTIVO EN PRODUCCIÓN; GPS comercial / ETA conductor NO IMPLEMENTADOS.

## ACTUALIZACIÓN VIVA 10/10/2026 — IMPLEMENTADO, NO ACTIVADO HASTA OPT-IN

- Supabase operativo `zetaudvvutlouiqxopvg` cuenta con `driver_live_presence` privado y funciones `mapa_presence_consent_v1`, `mapa_presence_ping_v1`, `driver_pickup_eta_context_v1` (solo service_role; RLS impide que anon vea coordenadas). No hay una posición de conductor en producción hasta que el usuario autorice GPS en la APK de Mapa R24.5.
- Edge Function `pickup-eta` ACTIVA y protegida mediante token válido de sesión de Cliente, 3 consultas/min y 20/h por cliente. Respuesta únicamente km y minutos redondeados y condición sujeto a aprobación, jamás lat/lon. Prueba negativa en [Actions 38019205391](https://github.com/marcelofgx-ctrl/traslados-web/actions/runs/38019205391) SUCCESS, sin token válido respondió HTTP 401. Se utiliza ORS ya configurado en el Worker solo entre servidores.
- PWA pública `web-pasajero/` v12 consulta ETA cuando el pasajero inicia sesión, selecciona origen y «Ahora» / «En 10 min». Funcionalidad de urgencia sigue como **consulta** y no crea reserva bajo `lead_time_min=30` minutos. Pages y PWA CI SUCCESS [38019114673](https://github.com/marcelofgx-ctrl/traslados-android/actions/runs/38019114673).
- Web Premium: componente [DriverPickupEta.tsx](../src/components/DriverPickupEta.tsx), incluido en `src/routes/index.tsx`. GitHub Actions CI [38019205391](https://github.com/marcelofgx-ctrl/traslados-web/actions/runs/38019205391) SUCCESS, **NO se desplegó el Worker actualizado**. Necesita despliegue manual autenticado en Cloudflare. No confundir CI con publicación.
- Cliente Android nativo 11.5-R11 firmada, run [38019069484](https://github.com/marcelofgx-ctrl/traslados-android/actions/runs/38019069484) SUCCESS; diálogo de ETA en botones Ahora/+10 sin invocar reserva inválida. Mapa Trayectos R24.5 versionCode 47, release firmada tras corrección nombre del artefacto [38019254898](https://github.com/marcelofgx-ctrl/traslados-android/actions/runs/38019254898); parche posterior «apagado local sin conexión» compilándose en Actions [38019431505](https://github.com/marcelofgx-ctrl/traslados-android/actions/runs/38019431505).
- El flujo Samsung real **no está probado aún**; hasta que el conductor autorice compartir la disponibilidad en Mapa y realice conducción con GPS reciente no se expondrá ETA, intencionalmente.

**Documentación detallada canónica:** [Mapa GPS/recogidas](https://github.com/marcelofgx-ctrl/traslados-android/blob/main/docs/DISPO_AUTOMATICA_Y_ETA_RECOGIDA.md).

## Política de precio de referencia (implementada en código; publicación Cloudflare a verificar)

El motor de rutas existente es GET /api/public/route-estimate, en traslados-web. Usa openrouteservice para kilómetros por CALLES y minutos, no distancia aérea. Su respuesta ahora incluye referenceFareUyu si ORS ofrece una ruta válida. La variable de entorno interna FARE_REFERENCE_UYU_PER_KM configura la referencia, por defecto 40 UYU por km. Así, 8 km = $320; 43 km = $1720. Se redondea al múltiplo de 10 UYU; no incluye peajes, esperas, extras, nocturnidad, ni viaje del conductor hasta el origen. No muestra cifras si faltan rutas reales o si el parámetro de tarifa es inválido.

La referencia NO es presupuesto vinculante ni un cargo. Conductor dentro de Mapa revisa y envía el importe definitivo mediante RPC de presupuesto ya existente, y el pasajero responde desde Mis traslados.

Archivos modificados en web: src/lib/road-route.ts, src/routes/api/public/route-estimate.ts, src/components/BookingQuickSummary.tsx, src/components/RoutePreview.tsx, tests/geo-route.test.ts. En GitHub Pages PWA (repositorio Android): web-pasajero/app.js, styles.css, index.html, sw.js y el smoke público. A/B primero, visualización inmediata km/min/precio orientativo y su repetición en la pantalla de revisión, solo si Worker realmente entrega los datos.

IMPORTANTE: el CI del repositorio Web solo compila y verifica el Worker de forma LOCAL; no publica automáticamente la actualización a Cloudflare. Hasta que se despliegue el Worker y exista ORS_API_KEY, la PWA puede mostrar A confirmar. No confundir CI verde con distancia/importe comprobado en producción. La caché de rutas puede permanecer unos 10 minutos después de ajustar tarifa.

## Retoma posterior — reserva Premium más compacta

En commit [a876eae](https://github.com/marcelofgx-ctrl/traslados-web/commit/a876eae31f11da95903e81cb0b3e00fd3b8f6222) se sustituyeron las dos tarjetas repetidas de mapa/itinerario en `src/routes/index.tsx` por un desplegable **«Ver mapa detallado del recorrido»** que carga el mapa solo al abrir. Una vez escogidos A y B desaparece el marco/título redundante del panel exterior de Recorrido; queda una sola ficha A/B con km, minutos y precio de referencia, más el área de paradas desplegable. Se preserva enlace a Google Maps. **GitHub Actions** [38011297730](https://github.com/marcelofgx-ctrl/traslados-web/actions/runs/38011297730) **SUCCESS** para ambas versiones de Bun en la compilación/verificación. **No fue desplegado Cloudflare**, por lo que aún no equivale a validación visual en producción.

## Recorrido completo real y próximo

1. Portada: Reservar / Calcular distancia sin registro / Mis traslados. Son distintas la PWA Pages y Web Premium Cloudflare.
2. Selección A→B: geobúsqueda Uruguay por calle y número, locales/puntos OSM, aeropuertos; editar/invertir, paradas plegadas.
3. Ruta: km y minutos por CALLES (A→B), referencia UYU, Google Maps. Si ORS no responde, alternativa Maps honesta, sin cifras inventadas.
4. Modalidad: Ahora / En 10 minutos / Programar. PWA admite solicitudes pendientes para hora próxima; Web Premium ofrece WhatsApp para urgente; todavía NO hay ETA real comercial.
5. Agenda: horarios registrados de Traslados y chequeo de conflictos en Supabase; NO deduce disponibilidad por ausencia de reservas (puede estar haciendo Uber o Cabify).
6. Datos: pasajeros, contacto, vuelo/equipaje/indicaciones, datos para tercero plegados; Premium exige inicio de sesión para reservar y PWA permite invitado.
7. Revisión: compacto A/B + km/min + referencia UYU, fecha/hora, pasajeros, presupuesto final A CONFIRMAR, editar y enviar solicitud.
8. Solicitud: se crea en Supabase único zetaudvvutlouiqxopvg (PENDIENTE); Conductor integrado puede verla mientras monitor opera; sin FCM garantizado.
9. Presupuesto final: conductor gestiona disponibilidad, extras, importe, y ENVÍA LA OFERTA desde Mapa. No es automáticamente igual a referencia.
10. Cliente: ve presupuesto y puede aceptarlo o rechazarlo, con estado real e historial; falta QA completo de sesión invitado vs cuenta.
11. Viaje: confirmada, en viaje, finalizada, o cancelada; control por conductor y registro en backend. Historial y repetir trayecto disponibles de forma desigual entre interfaces.

## Recogida: distancia Conductor→A y ETA — pendiente, NO publicado

La ruta A→B no se confunde con el desplazamiento conductor→A. Existen puntos GPS en Mapa, pero su almacenamiento no autoriza tratarlos automáticamente como ubicación comercial pública. Se requiere:

- Consentimiento explícito en Mapa, desactivado por defecto, más botón Disponible / Ocupado / Pausado / Fuera de servicio. Los viajes de Uber/Cabify requieren estado manual independiente de agenda.
- Vinculación de UN móvil y conductor autorizado vía PIN y dispositivo, sin permitir que el ID de registro de Mapa se autoproclame conductor.
- Publicación autenticada en tabla PRIVADA: lat/lon/precisión y antigüedad; caducar a los 90 segundos de inactividad.
- Worker calcula ruta conductor→A por carretera en el servidor; entrega al pasajero SOLO estado, km, ETA y antigüedad de lectura (sin lat/lon).
- Para «En 10 minutos», permitir solicitud únicamente si libre y ETA + margen <=10 minutos, revalidando conflictos. La reserva nunca se confirma automáticamente. Si falta GPS/ORS: «Disponibilidad inmediata no confirmada» + programar/WhatsApp.
- Prueba Samsung obligatoria: servicio segundo plano, batería, sin señal, Uber/Cabify, pantalla bloqueada, cierre de jornada, permisos y precios sin datos inventados.

## Mejoras prioritarias detectadas

P0: activar/publicar Worker Cloudflare si corresponde; comprobar ORS_API_KEY; un único test de reserva E2E autorizado, sin duplicar datos; probar cambios visuales en Samsung.
P1: construir presencia segura, distancia de conductor→origen y ETA de recogida; añadir estado manual al Mapa; no rastreo público.
P2: compactar A/B, colocar km/min/precio en primer pliegue, editar/invertir/ruta en una línea, mantener extras y datos secundarios plegados.
P3: armonizar login/invitados y decisiones de presupuesto entre Pages, Web Premium y APK nativa; mejorar «Mi viaje», historial y repetir.
P4: configurable desde pantalla privada de Conductor (ahora solo variable interna Worker), y futuras reglas mínimo, peaje, espera, nocturno, descuento previo acuerdo comercial.
P5: notificaciones reales FCM seguras, sin prometerlas antes de configurar servidor/tokens, y política de reintentos/doble toque de reserva.

Clasificación: código tarifa implementado y pruebas CI a observar; publicación Cloudflare no confirmada; GPS/ETA conductor→A todavía PROYECTADOS; E2E con teléfono no comprobado. No borrar datos de cliente, reservas o sonidos.
