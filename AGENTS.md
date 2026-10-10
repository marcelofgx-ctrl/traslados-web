<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->
# Decisión de producto (10/10/2026) — leer antes de cambiar la web
El usuario designó **https://marcelofgx-ctrl.github.io/traslados-android/web-pasajero/** como su web de pasajeros definitiva. Este repositorio Cloudflare se mantiene para APIs (rutas, km, minutos, tarifa orientativa, integración) y una interfaz heredada, NO para reemplazar el diseño elegido de GitHub Pages. La APK Android Cliente v13 usa esa PWA. No mezclar ni invertir las dos URLs en nuevos cambios. Preservar endpoints `/api/*`, `keep_vars: true`, firma APK y reservas Supabase. No tocar visual de Pages sin pedido del usuario.

