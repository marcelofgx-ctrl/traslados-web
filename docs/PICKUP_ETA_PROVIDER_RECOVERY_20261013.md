# Recogida — proveedor ORS resiliente (13/10/2026)

## Diagnóstico de producción (solo lectura)
- Captura Samsung 12/10 23:54: presencia correcta, pero recogida sin ETA por `route_unavailable`; los 12,1 km / 17 min corresponden a ORIGEN→DESTINO del pasajero, **no** a distancia conductor→origen.
- Supabase `pickup-eta` v5 recibió POST 200 y validó llamadas a `driver_pickup_eta_context_v1`. HTTP 200 no demuestra ruta exitosa, pues Edge devuelve también errores funcionales dentro del JSON.
- Worker `/api/public/route-estimate` depende de ORS; una prueba GitHub CI del 12/10 17:48 confirmó ruta ORS real de control 19,5km/28min. No afirmar que la clave esté siempre ausente. La caché `route_reposition_cache` tiene 19 filas ROAD; 0 nuevos en las 24 horas comprobadas y por su búsqueda estricta de 5 decimales no cubre GPS móvil arbitrario.
- Error de presupuesto de tiempo detectado en código: ORS puede esperar 7 segundos y **después** cache hasta 3,5 segundos (10,5 segundos teóricos). Edge `pickup-eta` espera solo **7,5 segundos** por respuesta vial, por lo que podía abortar antes de la recuperación.
- Segundo error determinista: `parseOrsGeojson` redondeaba distancias válidas **menores a 50 metros** a `0.0 km`; Edge rechazaba después esa distancia por su contrato de ruta verificada positiva.

## Cambio limitado al Worker de Cloudflare
- ORS mantiene ruta real obligatoria, respuesta GeoJSON verificada, sin proveedores demo OSRM ni estimaciones Haversine.
- Presupuesto acotado: máximo **5,2 segundos** ORS, recuperación hasta **1,2 segundos** de caché ROAD verificada; margen antes de timeout Edge 7,5s.
- Ante **HTTP 5xx o error de red inmediato**, una sola reconsulta si queda presupuesto de tiempo. No repetir por **429** (cuota), 401/403 (credenciales) o 404/422/400 (sin ruta).
- Observabilidad backend `verified-road-provider`: únicamente categoría de fallo / código HTTP / número de intentos. **Nunca** coordenadas del conductor, rutas, tokens, claves ni puntos del usuario.
- Para ORS con 0 < metros < 50, conservar 0,1 km como resolución mínima de una ruta real positiva. Sin datos de ORS no se fabrica distancia.
- La tarifa de referencia no debe demorar una ETA ya verificada: consulta con 600 ms independientes.
- Sin cambios de GPS, cuota SQL, reservas, PIN, tarifas, APK, PWA, botón de envío ni proveedor original.

## Validación y despliegue
1. Ejecutar tests `tests/ors-road-resilience.test.ts` y suite de seguridad con Bun 1.2/1.3, TypeScript y Workers local; verificar reportes de live endpoint sin exponer coordenadas privadas.
2. **Publicación es manual y separada por diseño:** workflow `Publicar Traslados Web en Cloudflare (manual)`. El CI de PR **no publica**, por lo tanto una PR aprobada no equivale a despliegue.
3. Tras la publicación ejecutar pruebas con recorridos viales públicos y una prueba privada en Samsung **sin copiar GPS del conductor a logs ni clientes**; verificar fuente `openrouteservice` o `supabase_route_cache`. Revisar logs del Worker si continúa `route_unavailable`.
4. Ante ORS efectivamente indisponible y sin caché, el sistema debe mostrar honestamente que no hay ETA. Sigue pendiente visibilidad del resultado de proveedor en la consola Cloudflare.

## Reversión
Revertir commit del Worker y ejecutar el workflow manual nuevamente. Supabase Edge v5 y versiones de APK permanecen idénticas.
