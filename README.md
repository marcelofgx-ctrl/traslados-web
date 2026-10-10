# Traslados Web

> **CONTEXTO MAESTRO COMPARTIDO — LEER ANTES DE RETOMAR:** https://github.com/marcelofgx-ctrl/traslados-android/blob/main/docs/CONTEXTO_MAESTRO_PROYECTOS.md
>
> Documento vivo de coordinación de **Mapa Trayectos / Conductor integrado / Cliente APK / GitHub Pages-PWA / esta web Cloudflare / Supabase**. Incluye enlaces correctos, estado de compilación y publicación, pendientes, privacidad GPS y convención de actualización. La información histórica de este README puede estar desactualizada; verificar siempre `main`, Actions y producción. **Actualizar el contexto maestro al terminar cada intervención importante**, especialmente si afecta a ambos repositorios.

Web premium de reservas, agenda e historial de traslados en Uruguay.

**Repositorio principal de la web:** https://github.com/marcelofgx-ctrl/traslados-web  
**APK Android:** https://github.com/marcelofgx-ctrl/traslados-android  
**Base de datos operativa:** Supabase `zetaudvvutlouiqxopvg`.

## Estado (8 de octubre de 2026)

El código fue recuperado de Lovable, trasladado íntegramente a este repositorio y desacoplado del paquete `@lovable.dev/vite-tanstack-config`. El build utiliza las herramientas oficiales de **Cloudflare Workers**, **TanStack Start**, **Vite**, **React** y **Tailwind CSS**. El diseño petróleo/grafito/dorado se conserva en `src/styles.css` y en los componentes.

**Estado actualizado el 08/10:** La página `/` ahora contiene portada premium, acceso con PIN para clientes existentes, buscador IDE Uruguay por departamento, selección en mapa, paradas reordenables, reserva para terceros, historial agrupado por mes/semana y repetición de itinerarios. El formulario principal llama las RPCs de Supabase operativo, no el backend Lovable. Las paradas se copian además a comentarios para que las APK antiguas del conductor puedan leerlas mientras se actualizan.

**Verificaciones:** GitHub Actions `37815099518` verde en Bun 1.2.15 y 1.3.4: TypeScript, build Cloudflare y prueba HTTP local de la portada (200 con texto comprobado).

**Pendiente de producción:** NO tenemos URL de Cloudflare confirmada; no se han probado sesiones reales, alta de cliente, navegación móvil real, una reserva completa con paradas, entrega al conductor ni seguridad de recuperación de PIN. La web no debe publicitarse como lista para clientes aún.

**Alta pública de nuevos clientes:** se mantiene deshabilitada hasta configurar verificación del número mediante un proveedor OTP; acceso existente por teléfono/PIN. No inventar envío SMS. Las rutas legacy `/conductor` y `/seguimiento` conservan su anterior Supabase, pendiente migración.

### Desarrollo local

Requiere Bun 1.3 o compatible.

```bash
bun install
bun run dev
bun run build
```

La compilación de CI usa claves ficticias para el backend legacy solo para verificar el empaquetado. Para ejecutar el sitio con datos reales configurar las variables de entorno autorizadas en Cloudflare, **nunca** subir claves secretas. La clave `sb_publishable_*` es pública; la `service_role` no lo es.

### Publicación

Objetivo: alojar con Cloudflare Workers, sin necesidad de créditos de Lovable. El archivo `wrangler.jsonc` y `vite.config.ts` ya utilizan los plugins oficiales. Crear primero un despliegue de prueba y validar rutas SSR, formularios y notificaciones antes de vincular dominio público.

### Funcionalidades comprometidas

- Horario 24 horas `HH:mm` en el nuevo formulario; panel legacy Conductor pendiente.
- Selector de departamentos: Montevideo/Canelones fijos + los otros 17 del Uruguay.
- Autocompletado de direcciones exclusivamente Uruguay con datos de la IDE, y elección de punto en mapa como respaldo.
- Origen, varias paradas intermedias reordenables y destino final, guardados en Supabase.
- Clientes existentes vía PIN (sin SMS), historial agrupado por mes/semana, repetir viaje, viajes futuros y estados reales. Verificación real del número pendiente.
- Reservas para terceros con datos de pasajero.
- Estética premium en todas las pantallas.
- Compatibilidad posterior con APK Conductor y posible integración con APK Mapa, decisión aún no tomada.

### Backend y seguridad

La migración **v12** ya se aplicó en la base operativa Supabase `zetaudvvutlouiqxopvg`, agregando `reservation_stops` y RPCs `customer_create_reservation_v12` / `customer_list_reservations_v12` sin borrar reservas previas. **Las APK todavía no leen esas paradas estructuradas; la web actual agrega información de paradas a comentarios mientras tanto.**

El login existente del backend usa teléfono+PIN, **no verifica la posesión del número**; antes de abrir el registro al público se debe completar un flujo de verificación real, protección contra abuso y recuperación de acceso (SMS/WhatsApp OTP mediante proveedor). No simular OTP.

### Archivos faltantes

El nuevo `public/icon.svg` es funcional y está referenciado en el manifest; faltan todavía los recursos PNG de la antigua PWA y la APK antigua v8 de `public/downloads/`.

Detalles y trabajo pendiente en [PLAN_MIGRACION_WEB_SIN_LOVABLE.md](PLAN_MIGRACION_WEB_SIN_LOVABLE.md).

La rama `main` de este repositorio pertenece exclusivamente a la web. Se puede seguir programando aquí sin afectar el repositorio Android.

## Historial premium del cliente (v15, octubre 2026)

La portada móvil mantiene la identidad petróleo/dorado con cabecera y hero más compactos. La pantalla «Mis traslados» ahora separa próximos e historial, con búsqueda por reserva/código/origen/destino/pasajero/paradas; filtros combinables por año, mes, estado y períodos 7/30/90 días o rango personalizado; agrupación plegable **año → mes → semana → detalle de viaje**; desplegar/plegar todo; resumen de recuentos y exportación CSV de las filas filtradas (UTF‑8 para Excel, evitando inyección de fórmulas). Cada detalle muestra paradas, presupuesto y observaciones cuando existen. Permite repetir el itinerario, responder presupuestos pendientes y cancelar solamente estados autorizados, con confirmación y actualización desde Supabase.

La sección comercial incorpora compartir por el sistema del teléfono, copiar el enlace, descargar contacto .vcf y ayuda para crear acceso directo Android. El selector horario requiere seleccionar hora antes de minutos para evitar una reserva a medianoche involuntaria.

**Verificación:** pruebas en GitHub Actions con ambos Bun, TypeScript estricto, render HTTP 200 de la portada y tests unitarios de filtros/seguridad. **Pendiente:** verificar la última publicación de Cloudflare, comprobar en un celular real con cuenta de prueba las operaciones de presupuestos/cancelación y la passkey; el build verde no demuestra que ya esté desplegado ni valida integración punta a punta. No anunciar disponibilidad comercial hasta esas pruebas.


## Buscador de lugares de Uruguay (v16.3)

La web ahora combina **tres fuentes** para los campos origen y destino:

1. **Índice nacional de POIs OSM (sin API key):** `public/data/uy-pois.json`, generado automáticamente por `scripts/build-uy-pois.py` a partir del extracto de Geofabrik Uruguay. Primera extracción verificada: 22.499 lugares, incluyendo Punta Carretas Shopping, Plaza Italia Shopping Outlet y Shopping Tres Cruces. El índice se descarga una vez y se mantiene en caché durante la sesión.
2. **IDE Uruguay** para calles y números, por una consulta nacional directa (sin filtrar resultados por Montevideo o Canelones).
3. **Geoapify opcional** para reforzar cobertura de empresas y lugares, activado únicamente cuando el secret `GEOAPIFY_API_KEY` está configurado en Cloudflare.

Las sugerencias se fusionan en paralelo, con coincidencia de palabras por prefijo, tolerancia de tildes y plural: `Punta Carreta Shopping` encuentra `Punta Carretas Shopping`. El área geográfica es siempre Uruguay. Las ubicaciones de comercios se deben confirmar en el mapa cuando el punto de recogida exacto importe, pues el centro de un edificio no siempre corresponde a la entrada.

El flujo de GitHub Actions `.github/workflows/uy-pois-index.yml` actualiza el índice cada lunes. La descarga del extracto es un proceso batch en GitHub, no se consulta a servidores comunitarios por cada búsqueda del cliente.

**Licencia y atribución:** el índice deriva de © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright), bajo la licencia [ODbL](https://opendatacommons.org/licenses/odbl/1-0/). En la interfaz se atribuye esta fuente cuando se muestran los resultados OSM. Se debe respetar ODbL y los requisitos de atribución al redistribuir/modificar la base.

**Pendiente:** verificar en el celular la publicación de Cloudflare y la selección de origen/destino reales. Los datos de OSM, aunque extensos, pueden omitir locales recién inaugurados; mantener la combinación con IDE y el proveedor opcional es importante.
