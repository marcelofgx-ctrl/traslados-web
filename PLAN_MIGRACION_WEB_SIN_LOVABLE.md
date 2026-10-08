# Traslados Web — continuación autónoma, sin Lovable (08/10/2026)

## Estado verificado

- Web existente Lovable: Ride Bookings, project id `37e5ea75-667b-4c05-b55b-52dddb9e82f3`; primer cambio Lovable en commit `5da2c393efcc7aa3d89895278d83af6dc48c15a3`.
- Esta rama `web-traslados-rescate-20261008` es un **rescate del código fuente**, separado de `main` de la APK.
- 112 archivos de texto originales respaldados: React, Tailwind, TanStack Start, hooks, UI, rutas, SQL legacy y módulos nuevos. Otros archivos de documentación y workflow añadidos en esta rama.
- Faltan recursos binarios `public/favicon.png`, `public/icons/*.png` y `public/downloads/TrasladosConductor-v8.apk`. Recuperar de la web publicada o sustituir con assets propios.
- No hay `.env`: se excluyó a propósito. Nunca copiar claves secretas. Usar secretos/variables de despliegue; cliente web usa **solo** la clave publicable.
- **Compilación independiente de Lovable verificada:** GitHub Actions run `37792286193` (08/10/2026), SUCCESS, tras eliminar `@lovable.dev/vite-tanstack-config` de package.json y usar plugin Vite oficial de Cloudflare (`@cloudflare/vite-plugin@1.63.0`, `wrangler@4.148.0`). Artefacto `web-traslados-cloudflare` publicado por Actions; esto valida BUILD, NO comportamiento en navegador ni despliegue.
- `vite.config.ts` y `package.json` en esta rama **ya son autónomos** de Lovable y construyen con Cloudflare Workers. Quedan por migrar referencias legacy a Lovable runtime/backend en los componentes, configurar variables reales y verificar funcionamiento desplegado.
- **Backend de producción correcto:** Supabase `zetaudvvutlouiqxopvg`. La web legacy apuntaba a **otra** base (`xetklwcxebcpnkrdrmaa`). Los nuevos módulos `src/lib/operativa/*` ya preparan conexión a la operativa real, pero TODAVÍA NO están conectados a la UI.
- En base real, migración v12 fue aplicada con éxito: tabla `reservation_stops`, campos de persona que viaja, RPCs `customer_create_reservation_v12` y `customer_list_reservations_v12`. Conteo tras migración: 12 reservas existentes, 1 cliente, 0 paradas. Prueba con token inválido rechazada. No se hicieron reservas ficticias.
- Formato 24 h: existe `src/components/TimeSelect24.tsx`, pero aún no reemplazó todos los selectores.
- IDE Uruguay: existe `src/lib/uy-geo.ts`, pero aún no reemplazó al buscador legacy. Nominatim público no debe usarse como autocompletador comercial.
- Atención: el backend actual `customer_register(phone, PIN)` **NO VERIFICA QUE SE POSEA EL NÚMERO** (sin SMS OTP); antes de habilitar el registro público e historial sensible, diseñar verificación real contra abuso de registro y recuperación de cuenta.

## Arquitectura destino

1. Repositorio GitHub separado: `marcelofgx-ctrl/traslados-web` (crear vacío en GitHub; esta conexión permite crear archivos, pero no crear repos nuevos). Importar esta rama como main del nuevo repo.
2. Frontend premium React + Tailwind; TanStack Start si conviene mantener SSR, con Vite independiente.
3. Cloudflare Workers para TanStack Start (documentación: https://developers.cloudflare.com/workers/framework-guides/web-apps/tanstack-start/); preview por commit antes del paso a producción. Alternativa SPA estática si se trasladan servidor y notificaciones a Supabase Edge Functions.
4. Supabase real `zetaudvvutlouiqxopvg` como fuente única de reservas y clientes. Cuidar RLS, políticas, transporte de tokens, evitar secretos en frontend, evitar exponer identidad por teléfono sin verificación.
5. Conductor/Mapa consume misma base; evolucionar Android solo con compilación APK y pruebas propias. No fusionar APK Conductor y Mapa todavía: está en evaluación.

## Funciones solicitadas y pendientes de UI completa

1. Horario en 24 horas HH:mm para todo (entrada, confirmación, historial, Conductor).
2. Buscador de direcciones exclusivamente Uruguay, Montevideo/Canelones arriba y otros 17 en selector; búsqueda tolerante y rápida usando IDE Uruguay; mapa como respaldo; sin geocodificaciones inventadas.
3. Origen + lista de paradas intermedias reordenables + destino; guardar orden en backend RPC v12; asegurar que Android pueda leer las paradas.
4. Landing premium cálida y elegante: petróleo/grafito, tonos marfil, dorado suave, microtexturas, transiciones y UI móvil impecable.
5. Login cliente por teléfono; para producción verificar realmente la posesión (SMS/WhatsApp OTP si se configura proveedor). Historial por mes > semana desplegables, próximos, repetir trayecto.
6. Reserva para tercero: nombre y celular de pasajero viajante (opcional); propietario de la reserva conserva historial.
7. Confirmación real y disponibilidad, no éxito visual simulado. Validar choques de agenda con duración de rutas multi-parada; no pasar duraciones falsas.
8. Mapa/Conductor como módulo futuro a decidir, sin romper funciones existentes.

## Lista de salida a producción

- [ ] Migrar a repo GitHub exclusivo para la web.
- [ ] Recuperar iconos/assets y rediseñar si necesario.
- [x] Compilación en GitHub Actions sin créditos Lovable (`37792286193`, SUCCESS). Pendiente revisión de TypeScript, tests y validación en navegador.
- [x] Reemplazar configuración Lovable por Cloudflare Vite plugin + wrangler; **pendiente configurar variables del hosting**.
- [ ] Construir y probar todas las pantallas nuevas.
- [ ] Configurar verificación real de identidad (no solo teléfono+PIN).
- [ ] Asegurar que al reservar paradas se guarda de modo atómico; pruebas con cuentas autorizadas.
- [ ] Comprobar vista conductor de paradas y notificaciones reales.
- [ ] Previsualizar en Cloudflare. Probar Android móvil, teclado, gestos, horario, historial, logout.
- [ ] Publicar mediante corte controlado de dominio; no sustituir web actual antes de pruebas.

## Enlaces de validación

- Desarrollo: https://github.com/marcelofgx-ctrl/traslados-android/tree/web-traslados-desarrollo
- Compilación independiente SUCCESS: https://github.com/marcelofgx-ctrl/traslados-android/actions/runs/37792286193
- Rescate histórico: https://github.com/marcelofgx-ctrl/traslados-android/tree/web-traslados-rescate-20261008

## Alcance económico orientativo

- Editar y conservar código en GitHub sin créditos de Lovable.
- Cloudflare Workers Free: cuotas gratuitas según documentación vigente, no garantía de costo cero a todo volumen.
- Supabase: cuotas del plan, SMS/verificaciones externas pueden ser pagos por uso.
