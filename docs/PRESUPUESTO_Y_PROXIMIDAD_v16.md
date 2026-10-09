# Traslados — presupuesto de referencia y proximidad (09/10/2026)

## Alcance y estado real

Se diseñó la vista previa cliente, preservando las reservas y presupuestos definitivos del conductor. La UI llama `customer_trip_preview_v16` únicamente si origen/destino tienen coordenadas y muestra datos **solo cuando existen y son fiables**. Si la RPC no está instalada, no bloquea las reservas existentes.

**NO se ha aplicado la migración SQL v16 ni se ha configurado un proveedor vial de producción.** La función actual `availability_reposition_v11_4` en Supabase consulta, cuando no hay caché, `router.project-osrm.org` (servidor de demostración) y usa Haversine corregido en caso de fallo. No debe ampliarse su uso comercial sin reemplazarlo por un proveedor de rutas autorizado/capacidad propia. La v16 deja `enabled=false` de fábrica para impedir tráfico nuevo o presupuestos incorrectos.

## Precio inicial propuesto, modificable

- Precio por km: **UYU 42**, tarifa mínima **UYU 350**. Valor orientativo inicial, no final y **no autorizado como tarifa comercial hasta tu revisión**.
- En el viaje Cabify de 43 km con UYU 1.395 líquidos y 24% de comisión, serían unos UYU 1.836 de bruto (42,69/km). La comisión puede variar, revisar desglose.
- Tras configurar routing vial real, la UI usa exclusivamente rutas con `method=ROAD`, suma paradas en orden y calcula `max(mínimo, distancia × tarifa)`. Peajes, esperas, retorno y aproximación extra NO se incluyen automáticamente: el conductor decide el presupuesto.
- La cotización definitiva vigente usa las RPCs `driver_send_quote_v10_7` y `customer_quote_decision_v11_4`, sin cambios.

## GPS y privacidad

- La APK Mapa/Conductor debe llamar a `driver_report_presence_v16` con PIN y consentimiento explícito solo con jornada abierta, estado libre y GPS permitido. Cuando jornada se cierra o comienza un viaje debe enviar `false`; las actualizaciones caducan a los 90 segundos si pierde conectividad.
- La web cliente jamás recibe la coordenada del conductor: únicamente distancia en km y ETA en minutos, y solo para reservas dentro de las 2 próximas horas. El backend solo ofrece presencia fresca si además pudo obtener una ruta vial real.
- **No se implementó aún el envío GPS desde la APK**. La web no debería anunciar cercanía hasta conectarlo y probarlo.

## Checklist para activarlo sin costos nuevos

1. Elegir y probar un motor de rutas con uso comercial autorizado sin tarifa por petición (p.ej. OSRM/Valhalla propio sobre infraestructura disponible). No usar servidores públicos demo como servicio de producción.
2. Desplegar/validar la migración aditiva `supabase/migrations/20261009_driver_preview_v16.sql` **solo en proyecto** `zetaudvvutlouiqxopvg`, previa revisión. No tocar base Lovable.
3. Ajustar tarifa de referencia desde RPC protegida por PIN; activar `enabled=true` solo tras confirmar que las rutas se calculan realmente.
4. Incorporar GPS opt-in desde Mapa/Conductor (cadencia recomendada 30–45 s, solo jornada abierta y libre) y pruebas de privacidad, salida, app en segundo plano y vencimiento.
5. Probar itinerario simple y con paradas, choques de horario, corte de conectividad, costo cero (sin proveedores facturables), presupuesto del conductor y aceptación por el cliente.

El commit de frontend solo prepara interfaces y mantiene compatibilidad. **No se inventan valores ni se activan cobros.**
