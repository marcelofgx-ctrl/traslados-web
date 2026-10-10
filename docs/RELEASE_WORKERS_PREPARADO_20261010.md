# Traslados — publicación preparada de la web principal Workers

**Estado verificado:** listo en GitHub `main` y CI SUCCESS. **NO PUBLICADO EN WORKERS AÚN.**

## Objetivo y código validado

- Sitio oficial a actualizar: https://traslados-web.marcelof-gx.workers.dev/
- Repositorio fuente: `marcelofgx-ctrl/traslados-web`
- Último commit **de código** aprobado: [`6872670ea3ee6ef1b261b9db780e431a7a75e305`](https://github.com/marcelofgx-ctrl/traslados-web/commit/6872670ea3ee6ef1b261b9db780e431a7a75e305)
- Compilación validada: [Actions #38023721789](https://github.com/marcelofgx-ctrl/traslados-web/actions/runs/38023721789) — **2 jobs SUCCESS**, Bun 1.2.15 y Bun 1.3.4; pruebas, TypeScript, Worker/TanStack build y smoke local.
- Artefacto compilado `traslados-web-cloudflare` disponible en los artefactos del run.
- Proceso de despliegue preexistente: [Publicar Traslados Web en Cloudflare (manual)](https://github.com/marcelofgx-ctrl/traslados-web/actions/workflows/publicar-cloudflare-manual.yml).

## Nueva experiencia que será visible una vez desplegada

1. **Visitante sin cuenta:** tocar «Reservar» abre `GuestRoutePlanner` y permite elegir origen y destino con el buscador Uruguay y hasta ocho paradas.
2. **Estimación inmediata:** utiliza el motor seguro `/api/public/route-estimate` de este mismo Worker. Distancia por carretera, minutos y tarifa de referencia se muestran sin autenticación cuando el motor devuelve una ruta; de otro modo se informa que la cotización está pendiente. Las paradas sin completar impiden mostrar un precio incompleto.
3. **Acceso después del cálculo:** «Continuar para solicitar» guarda borrador A/B/paradas en React y `sessionStorage` por hasta dos horas, luego muestra acceso/registro.
4. **Tras iniciar sesión:** `Booking` restablece las direcciones y paradas del borrador. La agenda, revisión y creación de la solicitud requieren un token de cliente válido. No existe reserva anónima ni cobro en el paso de cálculo.
5. **Portada premium:** `DriverLiveStatus` muestra disponible/no disponible según el heartbeat de Mapa, sin exponer coordenadas y sin requerir login, con refresco al regresar a la pestaña.
6. **Llegada del conductor:** los kilómetros y minutos específicos de posición del conductor → origen continúan protegidos por sesión; no confundirlos con los km/min del recorrido del cliente A → B, que sí son públicos. No se activó un endpoint de triangulación pública de GPS.
7. **Infraestructura:** Supabase, Cloudflare ORS, Conductor y Cliente Android no se alteran mediante la publicación de esta web. GitHub Pages permanece únicamente como PWA auxiliar.

## Acción pendiente del propietario para publicar

En el enlace de **Publicar Traslados Web en Cloudflare (manual)**, seleccionar **Run workflow → branch main → Run workflow**.

Se requieren dos secretos de Actions para este repositorio (de existir, no cambiarlos):
- `CLOUDFLARE_API_TOKEN` (token de API con permisos de Workers Scripts Edit para la cuenta correspondiente).
- `CLOUDFLARE_ACCOUNT_ID` (identificador de cuenta; no es contraseña).

Los secretos se agregan exclusivamente en **GitHub → repositorio traslados-web → Settings → Secrets and variables → Actions**. No enviar tokens al chat ni escribirlos en `wrangler.jsonc`; `keep_vars:true` está presente y preserva variables y secretos remotos del Worker. La clave ORS debe permanecer **Secret** en Cloudflare, nunca variable de texto en un commit.

El workflow incluye pruebas previas, compilación, comprobación de credenciales sin imprimirlas, `wrangler deploy`, y comprobaciones HTTP del HTML de portada y del motor de rutas/tarifa en producción. Si faltan los secretos, el proceso aborta **antes de desplegar**. CI verde no equivale a producción.

## Verificación posterior obligatoria

En Samsung abrir de forma privada https://traslados-web.marcelof-gx.workers.dev/ y validar:
1. Portada premium, texto de disponibilidad de Mapa y botón **Reservar**.
2. Elegir A/B sin sesión y visualizar km/min de carretera y precio de referencia real.
3. Agregar una parada sin completar: el precio no puede omitirla; completar o eliminarla para obtener la estimación válida.
4. Pulsar continuar, autenticarse, verificar que origen, destino y paradas no se perdieron y **sin crear reservas de prueba innecesarias**.
5. Comprobar el botón Programar, disponibilidad según agenda e historial de un usuario real autorizado.
6. Verificar que el Worker conserva ORS e integraciones, y que la antigua PWA GitHub Pages no se publicita como sitio principal.

**Limitación de esta sesión:** el conector GitHub disponible permite escrituras y lectura de CI, pero no tiene una acción para iniciar `workflow_dispatch`; tampoco está conectado Cloudflare. No declarar `Deploy SUCCESS` ni «web ya actualizada» hasta confirmarlo.
