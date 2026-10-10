# Traslados con Reserva — plan de expansión comercial y producto

**Corte:** 10/10/2026 · **Estado:** plan de trabajo; no confundir propuestas con convenios firmados ni funcionalidades ya desplegadas.

## Propuesta de valor

Servicio de traslados privados y programados con **atención personal, movilidad eléctrica, coordinación anticipada y presupuestos confirmados por el conductor**. La misma interfaz premium de Cliente debe utilizarse desde navegador, PWA y APK Android. La URL oficial de atención al cliente es exclusivamente **https://traslados-web.marcelof-gx.workers.dev/**; GitHub Pages permanece auxiliar. No exponer herramientas ni enlaces técnicos al cliente; no inventar calificaciones ni disponibilidad.

## Canales prioritarios

| Canal | Servicio inicial | Captación de bajo costo | CTA disponible en la web premium |
| --- | --- | --- | --- |
| Empresas / estudios / oficinas | Traslados a reuniones, aeropuerto y visitas | Visita o mensaje personalizado a responsables administrativos y RR. HH. | «Solicitar propuesta» con consulta por WhatsApp |
| Hoteles, alojamientos y anfitriones | Traslados de huéspedes al aeropuerto, eventos y visitas | Contacto con administradores de alojamientos y recepciones | «Proponer colaboración» por WhatsApp |
| Clientes habituales | Compromisos regulares, turnos y trayectos recurrentes | Ofrecer continuidad al finalizar un viaje satisfactorio | «Consultar viajes frecuentes» por WhatsApp |
| Recomendaciones | Nuevo pasajero referido por cliente satisfecho | Compartir el enlace oficial con mensaje y parámetro `?via=recomendacion` | «Recomendar Traslados» / compartir nativo Android |
| Trayectos largos | Interdepartamentales sujetos a coordinación | SEO local y contacto con agencias o viajeros | Formulario de reserva existente, agenda y presupuesto |

**Área inicial comercial:** Montevideo–Canelones, zonas reales de operación y oferta; otras regiones **previa consulta** y evaluación de legalidad, disponibilidad, autonomía y retorno. No abrir una red multidriver ni anunciar cobertura garantizada sin capacidad verificada.

## Embudo medible — sin comprar publicidad por ahora

1. **Descubrimiento:** tarjeta QR y WhatsApp remiten a la URL propia de Traslados. SEO de servicios para Montevideo, Canelones, aeropuerto y rutas programadas.
2. **Interés:** página premium explica proceso y muestra disponibilidad de Mapa solo bajo condiciones verdaderas; el usuario puede explorar kilómetros y precio orientativo si existe ruta calculada.
3. **Consulta:** reserva autenticada o WhatsApp de empresas, alojamientos y clientes habituales. Los contactos de terceros no se recopilan en formularios falsos.
4. **Propuesta:** el conductor valida agenda, recorrido y tarifa definitiva; no se confirma automáticamente una reserva ni precio inexistente.
5. **Repetición:** historial «Mis traslados», volver a reservar y compartir después del servicio.
6. **Recomendación:** promoción orgánica sin prometer descuento, bonus ni sistema de seguimiento que aún no exista.

### Indicadores semanales para anotar desde la operación real

- Cantidad de consultas por cada canal (empresa, alojamiento, recurrente, referido, directo).
- Consultas convertidas en **reservas confirmadas**, no solo visitas a la web.
- Kilómetros facturables vs kilómetros hasta el pasajero y regreso.
- Ingreso cobrado por hora efectiva y por kilómetro recorrido; costes de energía/peajes de cada recorrido.
- Repetición de clientes, presupuesto aceptado o rechazado y motivo.
- Horas realmente disponibles para cumplir nuevos compromisos con un solo conductor.

**Precaución:** el parámetro `via` del enlace de referido sirve como identificación en la URL pero **no equivale a una métrica almacenada en Supabase**. Implementar medición real más adelante solo con protección de datos y autorización.

## Modelo de crecimiento por etapas

**Etapa 1 — estabilidad (ahora):** una URL oficial, una interfaz premium y APK Cliente firmada; probar en un Samsung real permisos GPS, selección de direcciones, distancias, presupuestos y envío de una solicitud de prueba consentida. Probar notificaciones sin prometer push nativo aún. No invertir en campañas hasta que el alta y la reserva funcionen.

**Etapa 2 — demanda (próximas semanas):** preparar una tarjeta comercial con QR y contacto; contactar unos pocos negocios de confianza por categoría; desarrollar respuestas rápidas profesionales y una matriz de presupuestos para viajes frecuentes; revisar semanalmente la rentabilidad. No comunicar convenios hasta tener aceptación real.

**Etapa 3 — escala controlada:** evaluar automatizar presupuestos corporativos, solicitudes recurrentes, cupones con reglas auditables, dashboard de leads y seguimiento de recomendación. Una ampliación a varios conductores requiere diseño explícito de permisos, asignación, seguros, facturación y cumplimiento normativo.

## Mensajes comerciales útiles

**Empresas:** «Traslados con Reserva coordina traslados privados y programados para reuniones, visitas y aeropuertos. Trabajamos con itinerarios claros, confirmación personal y presupuesto previo. ¿Te sirve que evaluemos los recorridos que necesitás con frecuencia?»

**Alojamientos:** «Ofrecemos un contacto directo para coordinar traslados programados de huéspedes, particularmente en Montevideo y Canelones. Podemos conversar sobre llegadas y salidas, horarios y necesidades del alojamiento, siempre sujetos a confirmación.»

**Cliente habitual:** «Si este traslado te resultó cómodo, podés guardar Traslados en tu celular para los próximos viajes, reservar con anticipación o compartir nuestro contacto con quien pueda necesitarlo.»

## Reglas de calidad y privacidad

- El servicio sigue siendo **de un solo conductor**, sin fingir flota o disponibilidad 24/7.
- Tarifas de referencia no equivalen a precio final; solo confirmadas tienen validez operativa.
- No usar GPS privado del conductor en consultas públicas, salvo política ya establecida de presencia y ETA autenticada.
- La APK y la web tienen la misma experiencia **al cargar la URL oficial**, pero necesitan red; la APK no es un clon con datos offline.
- Las notificaciones nativas de la APK premium WebView no están acreditadas; no afirmarlas hasta pruebas de integración.
- No pedir datos sensibles innecesarios ni compartir credenciales Cloudflare en WhatsApp o ChatGPT.
- Antes de escalar geográficamente revisar habilitaciones, seguros, permisos y capacidad real del servicio.

## Dependencia operativa pendiente

El flujo automatizado de despliegue Workers pasó compilación, pruebas y generación de rutas, pero no pudo publicar por **ausencia de `CLOUDFLARE_API_TOKEN` entre los secretos de GitHub Actions** (run 38074192866). Hay que agregar el token con permisos adecuados — y validar `CLOUDFLARE_ACCOUNT_ID` — en los secretos del repositorio **sin enviarlos al chat**. Recién entonces ejecutar el flujo controlado de publicación y QA real. GitHub Pages / APK no reemplazan la identidad del Worker oficial.
