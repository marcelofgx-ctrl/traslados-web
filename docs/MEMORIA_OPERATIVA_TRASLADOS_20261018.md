# Memoria operativa privada — Traslados (18/10/2026)

## Estado y alcance
Implementación v1 en proyecto Supabase **Traslados** (ID técnico `zetaudvvutlouiqxopvg`), esquema privado `project_ops`; migración aplicada en DB como **`20261018105550_project_ops_work_memory_v1`**; SQL fuente: [migración](../supabase/migrations/20261018_project_ops_work_memory_v1.sql).

La memoria ayuda al asistente a reanudar tareas entre sesiones **solo si se consulta explícitamente**. No equivale a la memoria nativa de ChatGPT, no se ejecuta automáticamente, no es un proceso en segundo plano y no reemplaza la verificación de GitHub. Git y los servicios desplegados determinan qué está implementado/publicado; la memoria es un índice de trabajo, no autoridad de producción.

**No se cambian tablas, políticas ni datos operativos de pasajeros, conductores, reservas, GPS o facturación.** No usar otro proyecto Supabase.

## Contrato de almacenamiento

- `project_ops.work_memory`: una entrada vigente por clave estable `memory_key`; categoría, título, estado, prioridad P0/P1/P2/P3, resumen, próxima acción, enlaces al repo y evidencia en JSONB. `revision` aumenta automáticamente; `verified_at` indica **último contraste con fuente externa**, no QA Samsung.
- `project_ops.work_memory_events`: registro automático **append-only** de cada INSERT/UPDATE con fotografía anterior/posterior y fecha. DELETE y modificaciones de eventos son rechazados por triggers.
- Seguridad: esquema fuera del API pública, RLS habilitado sin políticas de acceso externo, `USAGE` y privilegios de tablas/secuencias/funciones revocados de `PUBLIC`, `anon`, `authenticated` y `service_role`. Solo herramientas/admin DB confiables.
- No guardar contraseñas, tokens, PIN, emails, coordenadas, direcciones reales, capturas privadas, ni copia textual de grandes conversaciones. Enlazar documentación pública, PR, commit y workflow.
- No añadir polling/Realtime/lecturas desde web pública, PWA ni APK. **Costo en ruta de usuario: 0 consultas adicionales**. Las consultas de continuidad corren por separado al iniciar/cerrar un trabajo.

## Protocolo obligatorio de cada sesión (lectura corta)

1. Identificar el proyecto **Traslados** y consultar por SQL **solo** el índice de reglas, P0 y dependencias abiertas:

```sql
select memory_key,category,title,status,priority,summary,next_action,
       source_repo,source_ref,source_url,revision,verified_at
from project_ops.work_memory
where status in ('active','open','in_qa','blocked','implemented')
order by priority nulls last,updated_at desc
limit 30;
```

2. Contrastar **cada clave material** con la fuente real: GitHub HEAD, PR, CI y sus SHA, release, Pages/Worker, migraciones aplicadas y dispositivo Samsung. **Nunca convertir estado de memoria en afirmación de actualidad.**
3. Antes de editar, leer `docs/METODOLOGIA_PERMANENTE_TRASLADOS.md` y `docs/REGISTRO_DE_REGRESIONES_TRASLADOS.md` del repositorio Android. G0 → G6: reproducir, contrato, prueba roja/verde, QA integración, publicar solo tras puertas cumplidas.
4. Guardar únicamente novedades verificables; actualizar `verified_at` al contrastar fuente, indicar qué QA física sigue pendiente y registrar el SHA exacto.
5. Si un hecho está reemplazado, usar `status='superseded'` o `historical`; nunca borrar su fila ni bitácora. Las nuevas sesiones deben seguir pudiendo revisar la historia.

## Lectura puntual y escritura segura

```sql
select memory_key,summary,next_action,revision,details
from project_ops.work_memory
where memory_key='regression:dir-001';

-- Ejemplo conceptual de actualización condicionada por revisión.
-- Sustituir el valor de revision por el que se leyó.
update project_ops.work_memory
set summary = 'Resumen verificado y actualizado',
    next_action = 'Validación pendiente',
    verified_at = now()
where memory_key='regression:dir-001' and revision=1
returning memory_key,revision;

select operation,before_value,after_value,recorded_at
from project_ops.work_memory_events
where memory_key='regression:dir-001'
order by event_id desc limit 10;
```

**Atención:** el ejemplo de UPDATE no debe ejecutarse literalmente; revisar `revision` evita pisar un cambio de otra sesión. Un `UPDATE` que devuelve cero filas exige volver a consultar, no forzar escrituras.

## Inicialización verificada 18/10/2026

Semillas sin datos personales: 12 entradas (arquitectura, metodología, conservación, cadenas de PR, DIR-001, STATUS-001, GPS-001, MON-001, AUTH-001, CACHE-001 y continuidad). Se comprobó: 12 filas, 13 eventos al realizar una actualización de `handoff:20261018` (v1→v2); roles públicos sin acceso; RLS habilitado; bloqueos de borrado activos. No se borraron ni modificaron datos de producción.

Los avisos `rls_enabled_no_policy` para estas dos tablas son intencionales: nadie de la aplicación debe poder consultarlas. El auditor de Supabase también informa advertencias en RPC existentes; evaluarlas por separado, sin alterar autorizaciones antiguas sin análisis de impacto.

## Traspaso / sincronización

Al cerrar una intervención: documentar PR/branch/SHA, tests, despliegue, QA física real/no real, siguiente acción y riesgo. Si no se puede acceder a Supabase, GitHub continúa como respaldo canónico. Cuando Supabase vuelva a estar disponible, reconciliarlo contra Git; jamás asumir que el índice se actualizó solo.

**No automatizar escritura de memoria con CI de producción**, ni insertar solicitudes artificiales. Una automatización futura solo tras diseñar autenticación interna y revisión de impacto.
