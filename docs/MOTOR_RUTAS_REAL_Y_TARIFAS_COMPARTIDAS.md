# Motor de rutas real y tarifas compartidas — 09/10/2026

## Objetivo y arquitectura en producción
El pasajero elige A → B (+ paradas) y visualiza **distancia por carretera**, **duración estimada** y **precio orientativo**; el Conductor de Mapa confirma el presupuesto definitivo. Dos frontends comparten el Supabase real `zetaudvvutlouiqxopvg`: la Web Premium Cloudflare y la PWA GitHub Pages.

### 1. Rutas reales — dos fuentes, sin datos inventados

**Primario:** `src/routes/api/public/route-estimate.ts` usa HeiGIT OpenRouteService mediante `ORS_API_KEY` secreta del Worker y devuelve `available:true`, `distanceKm`, `durationMin`, `geometry`, `source:"openrouteservice"`. La Web Premium y la PWA consultan ese endpoint. Es una ruta por calles; no se usa la distancia en línea recta para calcular tarifas.

**Respaldo seguro, ya aplicado a Supabase:** `public.public_cached_route_preview_v1(p_points jsonb)`, SECURITY DEFINER, grants solamente anon/authenticated/service_role y SELECT interno sobre `route_reposition_cache`. Usa ÚNICAMENTE segmentos `method='ROAD'`, con coordenadas redondeadas a cinco decimales y vigencia de siete días. Hasta 10 puntos, valida que sean uruguayos, no revela datos personales y NO hace consultas de enrutamiento externas. Devuelve `source:"supabase_route_cache"`, distancia y duración, `geometry:[]`, fecha de cálculo y tarifa orientativa. Las rutas cacheadas derivan del motor interno `availability_reposition_v11_4` que consulta OSRM; `ESTIMATED` (aproximación Haversine) se excluye.

**Limitación importante:** la caché tenía 16 rutas verificadas al comprobarla. No reemplaza un proveedor de cálculo para cualquier A/B. Si la ruta no está cacheada y no funciona ORS, mostrar `—`/«A confirmar» y enlace Google Maps, sin kilómetros ni precios inventados. La caché respalda solo las rutas realmente existentes y comprobables.

No se debe invocar `availability_reposition_v11_4` directamente desde web pública ni usar el servidor OSRM **de demostración** como backend comercial ilimitado. Puede no ofrecer garantías de continuidad y sus condiciones restringen el uso. La RPC caché solo lee registros ya producidos.

### 2. Política única de precios, parametrizable por Conductor

La columna `driver_settings.reference_rate_uyu_per_km numeric(8,2)` tiene valor inicial **40 UYU/km**, con validación entre $1 y $1000. Dos funciones públicas bajo SECURITY DEFINER:

- `public_reference_quote_v1(p_distance_km)`: devuelve **solo** el importe orientativo con redondeo a decenas y `finalQuoteRequired:true`; no devuelve PIN ni actualiza reservas.
- `driver_set_reference_rate_v1(p_pin,p_rate)` y `driver_get_reference_rate_v1(p_pin)`: autentican con `driver_pin_valid` para editar/ver la tarifa interna. No se expone ninguna modificación sin PIN.

Pruebas SQL de producción ya ejecutadas, sin crear reservas: 8 km → $320; 43 km → $1.720; ruta cacheada 18,1 km / 25 min → $720, etiqueta `supabase_route_cache`. Valores de pruebas, **NO** tiempos ni kilómetros del pasajero de la captura. Peajes/esperas/nocturnidad/extras fuera de la referencia. Las cotizaciones finales siguen gestionadas por `driver_send_quote_v10_7` y aceptadas por cliente mediante RPC existentes; no se alteraron.

### 3. Frontends

- **Premium Cloudflare:** `src/lib/verified-road-cache.ts` realiza el acceso read-only al RPC. El Worker consulta ORS primario, luego caché verificada; solicita precio a `public_reference_quote_v1` al tener km reales. Se actualizó `BookingQuickSummary.tsx` con diseño compacto petróleo/champagne: A/B y ediciones destacadas, km/min en dos métricas, valor orientativo grande, etiqueta de procedencia y Google Maps discreto. `RoutePreview.tsx` informa la fuente correcta; no vende la separación en línea recta como km por calles. CI `traslados-web` compilado con TS estricto y tests; nueva publicación de Cloudflare aún **NO probada**.
- **PWA GitHub Pages:** `web-pasajero/app.js` mantiene consulta principal a Cloudflare y, ante indisponibilidad, consulta directamente la RPC de caché ya publicada en Supabase con la **clave publicable**, no un secreto. El resumen compacto mantiene fuente de ruta y precio solo cuando está realmente verificado. Service worker `traslados-cliente-pwa-v10`, JS `app.js?v=10` en `index.html`, smoke actualizado. `web-pasajero/tests/booking-summary-smoke.cjs` prueba fallback real simulado 18,1 km/25min/$720 y ORS 8km/14min/$320, sin llamadas reales ni crear reservas.
- **Conductor Android:** en `conductor/MainActivity.java` el botón de **TARIFAS** abre el nuevo campo «PRECIO ORIENTATIVO EN LA WEB». La tarifa remota se sincroniza bajo PIN y el botón de actualizar escribe la base; los presets privados continúan editándose y guardándose por separado. `conductor/Api.java` agrega RPCs correspondientes. Código/versiones: independiente **11.5-R2 / code 124** y Mapa Trayectos integrado **0.1-R24.4 / code 46** (ambas compilaciones/release se comprueban en Actions). La configuración ya es real en DB; su uso en Samsung sigue pendiente de QA físico.

### 4. Aún bloqueado por credencial/proveedor

La consulta remota anterior a `https://traslados-web.marcelof-gx.workers.dev/api/public/route-estimate` devolvió `503 reason:not_configured`. Para calcular rutas A/B arbitrarias se requiere cargar **ORS_API_KEY** como secret en Cloudflare **y desplegar Worker**. El archivo `publicar-cloudflare-manual.yml` permite una publicación autorizada con secretos `CLOUDFLARE_API_TOKEN` y `CLOUDFLARE_ACCOUNT_ID` en GitHub Actions. **CI verde no despliega el Worker**. No publicar claves en repositorios/chat.

El cálculo **Conductor → origen A**, disponibilidad **Ahora / En 10 min**, GPS en vivo consentido y ETA comercial todavía NO funcionan. La PWA urgente usa consulta WhatsApp, no crea reservas falsas (Supabase reserva programada exige lead_time_min=30 por defecto). No se compartieron coordenadas del conductor, ni se hicieron viajes de prueba.

### 5. Migraciones y pruebas

Migraciones aplicadas realmente a `zetaudvvutlouiqxopvg`:
- `20261010010101_public_cached_route_preview_v1.sql` (función segura; después dos correcciones versionadas).
- `20261010011200_reference_fare_policy_v1.sql` (tarifa y funciones).
- `20261010011500_cached_route_fare_enrichment_v1.sql` (respuesta de caché con precio).
- `20261010012000_driver_get_reference_rate_v1.sql`.

Tests negativos verificados por SQL: coordenadas fuera de Uruguay → `invalid_points`; trayecto no cacheado → `cache_miss`; tarifa con kilómetros negativos → `invalid_distance`. Tests Web `verified-road-cache.test.ts` rechazan métodos distintos de `ROAD`. Builds Android, Pages y Cloudflare deben verificarse individualmente antes de marcar una entrega como instalable.

## Próximos pasos
1. Comprobar compilaciones firmadas en Actions y artefactos R24.4 / 11.5-R2.
2. Confirmar publicación pública PWA v10 y smoke anon RPC real.
3. Para km y precio de cualquier A/B, obtener y configurar la clave ORS en Cloudflare sin compartirla; desplegar la Web Premium.
4. Probar en Samsung el trayecto «Roque Sáenz Peña 1711 → Aeropuerto de Carrasco», incluido precio, teclado, contraste y presupuesto final.
5. Luego, opt-in GPS / disponibilidad del conductor (Uber/Cabify) → km y ETA hasta origen con privacidad, sin posiciones crudas públicas.
