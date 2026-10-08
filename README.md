# Traslados Web

Web premium de reservas, agenda e historial de traslados en Uruguay.

**Repositorio principal de la web:** https://github.com/marcelofgx-ctrl/traslados-web  
**APK Android:** https://github.com/marcelofgx-ctrl/traslados-android  
**Base de datos operativa:** Supabase `zetaudvvutlouiqxopvg`.

## Estado (8 de octubre de 2026)

El código fue recuperado de Lovable, trasladado íntegramente a este repositorio y desacoplado del paquete `@lovable.dev/vite-tanstack-config`. El build utiliza las herramientas oficiales de **Cloudflare Workers**, **TanStack Start**, **Vite**, **React** y **Tailwind CSS**. El diseño petróleo/grafito/dorado se conserva en `src/styles.css` y en los componentes.

**No es todavía una nueva versión funcional desplegada.** Actualmente las rutas de la web siguen siendo mayoritariamente legacy, conectadas con su Supabase original. Los módulos de conexión a Supabase operativo, búsqueda IDE Uruguay y selector horario de 24 horas están presentes pero **todavía deben integrarse a las pantallas**. No confundir build verde con prueba funcional de reserva.

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

- Horario 24 horas `HH:mm` en toda la web.
- Selector de departamentos: Montevideo/Canelones fijos + los otros 17 del Uruguay.
- Autocompletado de direcciones exclusivamente Uruguay con datos de la IDE, y elección de punto en mapa como respaldo.
- Origen, varias paradas intermedias reordenables y destino final, guardados en Supabase.
- Clientes con identidad verificada, historial agrupado por mes/semana, repetir viaje, viajes futuros y estados reales.
- Reservas para terceros con datos de pasajero.
- Estética premium en todas las pantallas.
- Compatibilidad posterior con APK Conductor y posible integración con APK Mapa, decisión aún no tomada.

### Backend y seguridad

La migración **v12** ya se aplicó en la base operativa Supabase `zetaudvvutlouiqxopvg`, agregando `reservation_stops` y RPCs `customer_create_reservation_v12` / `customer_list_reservations_v12` sin borrar reservas previas. **Las APK todavía no leen esas paradas.**

El login existente del backend usa teléfono+PIN, **no verifica la posesión del número**; antes de abrir el registro al público se debe completar un flujo de verificación real, protección contra abuso y recuperación de acceso (SMS/WhatsApp OTP mediante proveedor). No simular OTP.

### Archivos faltantes

La exportación no incluyó iconos binarios de `public/favicon.png` ni `public/icons/`, y omitió la APK vieja v8 de `public/downloads/`. Recuperarlos o regenerarlos antes de abrir la web a clientes.

Detalles y trabajo pendiente en [PLAN_MIGRACION_WEB_SIN_LOVABLE.md](PLAN_MIGRACION_WEB_SIN_LOVABLE.md).

La rama `main` de este repositorio pertenece exclusivamente a la web. Se puede seguir programando aquí sin afectar el repositorio Android.
