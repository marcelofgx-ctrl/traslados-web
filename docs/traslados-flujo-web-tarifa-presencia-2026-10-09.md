# Traslados — flujo de reservas, referencia por km y llegada del conductor

Corte: 09/10/2026 (Uruguay). Coordinación: https://github.com/marcelofgx-ctrl/traslados-android/blob/main/docs/CONTEXTO_MAESTRO_PROYECTOS.md

## Política de precio de referencia (implementada en código; publicación Cloudflare a verificar)

El motor de rutas existente es GET /api/public/route-estimate, en traslados-web. Usa openrouteservice para kilómetros por CALLES y minutos, no distancia aérea. Su respuesta ahora incluye referenceFareUyu si ORS ofrece una ruta válida. La variable de entorno interna FARE_REFERENCE_UYU_PER_KM configura la referencia, por defecto 40 UYU por km. Así, 8 km = $320; 43 km = $1720. Se redondea al múltiplo de 10 UYU; no incluye peajes, esperas, extras, nocturnidad, ni viaje del conductor hasta el origen. No muestra cifras si faltan rutas reales o si el parámetro de tarifa es inválido.

La referencia NO es presupuesto vinculante ni un cargo. Conductor dentro de Mapa revisa y envía el importe definitivo mediante RPC de presupuesto ya existente, y el pasajero responde desde Mis traslados.

Archivos modificados en web: src/lib/road-route.ts, src/routes/api/public/route-estimate.ts, src/components/BookingQuickSummary.tsx, src/components/RoutePreview.tsx, tests/geo-route.test.ts. En GitHub Pages PWA (repositorio Android): web-pasajero/app.js, styles.css, index.html, sw.js y el smoke público. A/B primero, visualización inmediata km/min/precio orientativo y su repetición en la pantalla de revisión, solo si Worker realmente entrega los datos.

IMPORTANTE: el CI del repositorio Web solo compila y verifica el Worker de forma LOCAL; no publica automáticamente la actualización a Cloudflare. Hasta que se despliegue el Worker y exista ORS_API_KEY, la PWA puede mostrar A confirmar. No confundir CI verde con distancia/importe comprobado en producción. La caché de rutas puede permanecer unos 10 minutos después de ajustar tarifa.

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
