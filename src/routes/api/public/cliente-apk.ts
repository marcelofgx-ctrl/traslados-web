import { createFileRoute } from "@tanstack/react-router";

/**
 * Descarga pública con identidad Traslados.
 * El APK REAL es el Cliente v11.5-R12 firmado, publicado por CI en el sitio
 * auxiliar. El pasajero descarga exclusivamente desde el origen Workers
 * y no ve GitHub ni conoce herramientas de construcción.
 *
 * Esta ruta nunca recibe una URL externa indicada por el usuario (no SSRF).
 */
const VERIFIED_CLIENTE_APK =
  "https://marcelofgx-ctrl.github.io/traslados-android/web-pasajero/downloads/traslados-cliente-premium-v12.apk";
const FILE_NAME="Traslados_Cliente_Premium_v12_RELEASE.apk";
const TYPE="application/vnd.android.package-archive";

function unavailable() {
  return Response.json({available:false,reason:"installer_not_available"},{
    status:503,headers:{"Cache-Control":"no-store","X-Content-Type-Options":"nosniff"}
  });
}

async function transferClienteApk(method:"GET"|"HEAD") {
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),12000);
  try {
    const source=await fetch(VERIFIED_CLIENTE_APK,{
      method,signal:controller.signal,redirect:"follow",
      headers:{"Accept":TYPE+", application/octet-stream"},
    });
    if(!source.ok)return unavailable();
    const mime=(source.headers.get("Content-Type")??"").toLowerCase();
    const length=Number(source.headers.get("Content-Length")??"0");
    // Never serve a 404 HTML page renamed to .apk or a truncated artifact.
    if(/text\/html|application\/json|text\/plain/.test(mime) || (length>0&&length<10000))
      return unavailable();
    const headers:Record<string,string>={
      "Content-Type":TYPE,
      "Content-Disposition":'attachment; filename="'+FILE_NAME+'"',
      "X-Content-Type-Options":"nosniff",
      "Cache-Control":"public, max-age=300, s-maxage=300",
      "X-Robots-Tag":"noindex",
    };
    if(length>0)headers["Content-Length"]=String(length);
    return new Response(method==="HEAD"?null:source.body,{status:200,headers});
  }catch{
    return unavailable();
  }finally{
    clearTimeout(timeout);
  }
}

export const Route=createFileRoute("/api/public/cliente-apk")({
  server:{
    handlers:{
      GET:async()=>transferClienteApk("GET"),
      HEAD:async()=>transferClienteApk("HEAD"),
    },
  },
});
