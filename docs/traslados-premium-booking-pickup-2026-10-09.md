# Traslados Premium — rediseño integral de reservas y recogidas inmediatas
Fecha: 09/10/2026 · Estado: implementación parcial verificada por código; GPS en vivo pendiente.

## 1. Contrato visual: móvil primero

Identidad: petróleo oscuro #0d252b, verde grafito #14363b, dorado claro de alto contraste #e8c789, texto principal marfil #f8efdf. Texturas suaves; sin amarillo/marrón apagado sobre negro. Secciones con contraste suficiente, botones táctiles de al menos 44 px, scroll corto y títulos sencillos.

### Pantalla A — Portada
- **Primer pliegue**: título legible, Reservar, Calcular recorrido y Mis traslados.
- Aclarar siempre diferencias entre presupuesto pendiente, tarifa aprobada y tiempos aproximados.
- El acceso público a «Calcular kilómetros» nunca exige cuenta.
- Optimizar el tamaño de la cabecera y evitar que elementos flotantes tapen botones.

### Pantalla B — Reserva
1. **Recorrido**: mostrar origen no elegido con su buscador; al elegirlo, contraer a una fila editable; abrir destino automáticamente. Al elegir ambos, sustituir por **una única tarjeta resumen** con direcciones destacadas.
2. **Paradas**: plegadas por defecto, contador al lado, controles para ordenar/eliminar dentro del desplegable.
3. **Resumen**: kilómetros reales por calles y minutos de conducción, o «Ver en Google Maps» cuando no hay proveedor. No usar distancia aérea como trayecto.
4. **Modalidad**: «Ahora», «En 10 min», «Programar». Las dos primeras dependen de la telemetría y de confirmar libre/ocupado.
5. **Horario programado**: días desplazables + horas con scroll vertical; solo mostrar opciones admitidas por la agenda. Revalidación en el envío.
6. **Pasajeros y observaciones**: compactos; los datos adicionales solo se despliegan si el usuario los necesita.
7. **Mapa**: contraído por defecto; al abrir muestra ruta por calles únicamente cuando el motor la calculó. Botón Maps incluso plegado.
8. **CTA**: confirmar la solicitud, nunca prometer reserva sin aceptación.

### Pantalla C — Revisar y enviar
- Una tarjeta pequeña con ORIGEN → DESTINO, km, tiempo, fecha, hora y pasajeros.
- Detalles secundarios en acordeón.
- Botones Editar y Enviar separados, sin superposición con cabecera ni botón flotante.
- Errores claros, sin nombres técnicos como HORARIO_NO_DISPONIBLE.

### Pantalla D — Mis traslados
- Próximos e Historial, año/mes/semana plegables, filtros por estado, fecha y texto, exportación.
- Estado del presupuesto y evolución real de la reserva. No sugerir que el conductor está cerca solo porque la solicitud fue aceptada.
- CTA «Repetir recorrido» precarga origen, destino y paradas.

## 2. Recogida inmediata — contrato funcional

### Entrada
El usuario selecciona origen y destino. «Ahora» significa primera recogida posible; «En 10 min» significa fecha objetivo **no garantizada**. Puede cambiar a programado.

### Fuente autorizada
APK Mapa publica solo mientras el conductor otorgue consentimiento; GPS desde TrackingService y estado de jornada, pausas y viaje en curso. Además, debe existir **estado manual disponible/ocupado** para indicar viajes de Uber/Cabify y descansos. No basta con que no haya reservas en Supabase.

### Servidor y seguridad
- Dispositivo de Mapa vinculado expresamente al conductor único; nunca aceptar telemetría pública de un ID auto-registrado sin vincular.
- RPC autenticada o endpoint de Worker con credencial rotatoria; no guardar secreto de servicio en APK.
- Guardar lat/lon y precisión solo en tabla privada. No exponer lat/lon en JSON público, URLs, cachés ni logs. Restricción de acceso por rol.
- Telemetría de 15–30 s si el GPS está activo y se consiente, a estudiar por batería/datos. GPS con precisión aceptable (p. ej. <=100 m).
- Marcar no disponible si >90 s sin actualización o si está pausado, ocupado o sin jornada.
- Calcular conductor→origen con proveedor de rutas por carretera para ETA/km; sin motor habilitado, no mostrar kilómetros aéreos como ruta. Controlar cuotas y abusos.
- Respuesta mínima al cliente: AVAILABLE con km, ETA, edad de lectura; BUSY/OFFLINE/UNKNOWN sin coordenadas. No ofrecer seguimiento exacto público.
- Actualización del cliente cada 30–60 s cuando está visible; límite de consultas por sesión/IP, sin GPS en query público.
- Un trayecto «En 10 min» se ofrece solo si ETA estimada + margen operativo <=10 min **y** conductor libre y consiente. Si no, sugerir primera hora estimada sin garantía.
- Reserva inmediata pendiente de aceptación; bloqueo atómico del horario para evitar dobles asignaciones y doble validación del servidor.

### Estados UI
- GPS fresco + libre + motor de rutas: «Disponible · a X km · aprox. Y min para recogerte» y «Actualizado hace Z s».
- Libre sin ruta: «Podemos consultar la recogida; distancia por carretera temporalmente indisponible».
- Ocupado: «Conductor ocupado; podés programar otra hora».
- GPS viejo, apagado o jornada cerrada: «Disponibilidad inmediata no confirmada», alternativa de WhatsApp o programar.
- Nunca mostrar posiciones precisas en mapa público.

### Dependencias hoy no terminadas
1. El registro GPS en APK Mapa existe, pero el envío de posición en vivo y libre/ocupado a Supabase no está conectado.
2. El motor ORS por carretera está preparado, pero requiere un secreto `ORS_API_KEY` en Cloudflare para funcionar dentro de la web.
3. Se necesita vincular de forma segura el dispositivo de Mapa; un dispositivo que se registra solo no puede autoproclamarse conductor público.
4. La reserva urgente requiere una RPC específica que compruebe anticipación, conflictos y confirme el modo «lo antes posible».
5. Probar en Android real, con jornadas cerradas/pausas/ocupado, pérdida de GPS, rechazo y cambios de ubicación.

## 3. Checklist por prioridad

### Alta — reservar sin errores
- [x] Unificar motor de kilómetros en simulación y reserva con caché compartida.
- [x] Contraer Origen y Destino al seleccionarlos.
- [x] Mostrar resumen compacto de km/min o enlace Google Maps.
- [x] Replegar paradas y mapa por defecto.
- [x] Elegir modo ahora/10/programado de forma visible, sin hacer promesas falsas.
- [ ] Completar integración real de GPS/estado en Mapa y Supabase.
- [ ] Completar estimador seguro de conductor→origen sin filtrar coordenadas.
- [ ] Implementar solicitud inmediata en RPC con validación atómica.

### Media — UX y apariencia
- [x] Subir contraste del subtítulo dorado en Android y mejorar botones premium.
- [ ] Medir visualmente Samsung Browser/Chrome, alturas y superposiciones con burbuja.
- [ ] Simplificar notas y datos de terceros en acordeón.
- [ ] Mostrar carga y recuperación al fallar motor de rutas.

### QA de aceptación
- [ ] Simular Montevideo→Punta Carretas Shopping y verificar km por calles cuando ORS esté activo.
- [ ] Confirmar resultados con motor de búsqueda de nombres y direcciones.
- [ ] Capturas móviles 360–420 px y scroll en reserva/revisión/historial.
- [ ] En 10 min con ETA 5 min libre: permitir solicitar; ETA 15 min: no ofrecer recogida en 10 min.
- [ ] Viaje Uber/Cabify no informado a Supabase: bloquear «Disponible» mediante estado manual.
- [ ] Apagar GPS y cerrar jornada: presencia caduca y se ocultan cifras de recogida.
- [ ] Compilar web + CI, comprobar publicación Cloudflare y una solicitud real de punta a punta.
