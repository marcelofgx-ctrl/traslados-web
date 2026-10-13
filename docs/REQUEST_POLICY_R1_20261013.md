# Traslados · Horario habitual, solicitudes y jornada activa

## Contrato
- Conductor configura **horarios habituales y días** mediante PIN. No son una prohibición salvo que desactive expresamente la recepción de solicitudes fuera de ese horario.
- **Programadas:** cualquier fecha y hora FUTURA cuando `enabled=true` y `allow_scheduled_any_time=true` (predeterminado); el pasajero solo SOLICITA. Una solicitud puede estar pendiente incluso si hay otro viaje: Conductor debe revisar la agenda, proponer presupuesto y el pasajero aceptar. Confirmación comprueba conflictos/reubicación/viajes/bloqueos, NO rechaza solo por salir del horario habitual. Nunca se aceptan solapamientos de reservas confirmadas.
- **Inmediatas:** la jornada/GPS/disponibilidad reales gobiernan; `allow_live_outside_hours=true` permite actividad fuera de horarios/días habituales. `false` limita a franja y días configurados. La jornada inactiva, en pausa, ubicación no válida u ocupación siguen anulando disponibilidad.
- El interruptor anterior `enabled` de ajustes rige solicitudes **programadas**, nunca fuerza jornada a estar activa ni permite ignorar GPS.
- Recogidas `now/10` conservan su fecha/hora del servidor, no las restringe `schedule_request_policy_v1` (trigger solo para `schedule`).
- Inserción invitado `create_reservation` y cliente registrado `customer_create_reservation_v12` pasan por el MISMO trigger de política; la ruta registrada usa `v11_4` sin bloquear simple consulta pendiente. Vista registrada obtiene `requestable` independientemente de `available`.
- El RPC de Conductor `driver_list_reservations_v3` ahora incluye paradas autorizadas en orden, para representar y navegar trayecto completo, sin revelar coordenadas del conductor al pasajero.
- Ajustes nuevos en `driver_set_availability_settings_v12` garantizan atomicidad y retrocompatibilidad con R5; R5 puede continuar guardando ajustes anteriores sin resetear los flags.

## Verificaciones obligatorias
CI, ejecutar script de migración en transacción de test revertida y luego aplicar una sola vez; probar solicitudes programadas de invitado/cliente fuera de franja, falsas opciones de confirmación, jornadas fuera de franja y conflictos. No insertar viajes permanentes en producción para test. No enviar SMS ni presupuestos reales. PWA y APK Conductor requieren build separado para mostrar controles; no declarar terminada sin ambos despliegues.
