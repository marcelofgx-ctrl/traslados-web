#!/usr/bin/env python3
"""QA smoke of already-deployed pickup-eta v9. OPTIONS + INVALID session only.
No real reservation, no real customer token, no driver coordinates, no booking writes.
No API secrets or Supabase credentials required. This runs in GitHub Actions.
"""
import json
from datetime import datetime, timezone
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError

URL = "https://zetaudvvutlouiqxopvg.supabase.co/functions/v1/pickup-eta"
PREVIEW = "https://quicktrip-live-qa-only-20261027-59j1a946w-marcelofgx-1927.vercel.app"
PREVIOUS = "https://quicktrip-live-qa-only-20261027-marcelofgx-1927.vercel.app"
GITHUB = "https://marcelofgx-ctrl.github.io"
FORBIDDEN = "https://untrusted-smoke.vercel.app"
results = []
def send(method, origin, payload=None, preflight=False):
    headers = {"Origin": origin}
    if preflight:
        headers["Access-Control-Request-Method"] = "POST"
        headers["Access-Control-Request-Headers"] = "apikey,authorization,content-type,x-client-info"
    if payload is not None:
        headers["Content-Type"] = "application/json"
    body = json.dumps(payload).encode() if payload is not None else None
    req = Request(URL, data=body, method=method, headers=headers)
    try:
        with urlopen(req, timeout=20) as r:
            return r.status, dict(r.headers), r.read(4096)
    except HTTPError as e:
        return e.code, dict(e.headers), e.read(4096)
def check(title, method, origin, expected_status, cors, payload=None, preflight=False, reason=None):
    status, headers, content = send(method, origin, payload, preflight)
    h = {k.lower():v for k,v in headers.items()}
    returned_origin = h.get("access-control-allow-origin")
    parsed = json.loads(content)
    ok = (status == expected_status and returned_origin == cors and
          isinstance(parsed,dict) and
          all(k not in parsed for k in ("driverLat","driverLng",
          "coarseDriverLat","coarseDriverLng","serviceDriverLat",
          "serviceDriverLng","geometry","route","latitude","longitude")))
    if reason is not None:
        ok = ok and parsed.get("reason") == reason and parsed.get("available") is False
    if preflight and cors is not None:
        ok = ok and "POST" in h.get("access-control-allow-methods","") and "OPTIONS" in h.get("access-control-allow-methods","") and "x-client-info" in h.get("access-control-allow-headers","")
    results.append({"test":title,"http":status,"cors_allowed":returned_origin==origin,
                    "json_reason":parsed.get("reason"),"passed":ok})
    print(("PASS" if ok else "FAIL")+" "+title+": HTTP "+str(status)+" CORS "+str(returned_origin==origin)+" reason "+str(parsed.get("reason")))
    return ok
try:
    # OPTIONS has no customer data and never reaches the DB.
    check("preview_samsung_preflight","OPTIONS",PREVIEW,200,PREVIEW,preflight=True)
    check("existing_github_pages_preflight","OPTIONS",GITHUB,200,GITHUB,preflight=True)
    check("existing_qa_preview_preflight","OPTIONS",PREVIOUS,200,PREVIOUS,preflight=True)
    check("untrusted_preview_rejected","OPTIONS",FORBIDDEN,403,None,preflight=True,reason="forbidden")
    # Deliberately invalid synthetic tokens: session validation without touching
    # bookings or accessing a real driver position. No password, API key or GPS.
    p = {"sessionToken":"invalid-short-token",
         "originLat":-34.82,"originLng":-56.05}
    check("invalid_session_rejected_pre_db","POST",PREVIEW,401,PREVIEW,
          payload=p,reason="login_required")
    p["sessionToken"]="nonexistent-qa-session-only-"+"9"*48
    check("invalid_session_rejected_by_db","POST",PREVIEW,401,PREVIEW,
          payload=p,reason="login_required")
    # Empty/invalid geographic input fails before backend fetch.
    check("guest_invalid_origin_rejected","POST",PREVIEW,400,PREVIEW,
          payload={"originLat":0,"originLng":0},reason="invalid_origin")
except (OSError,URLError,ValueError) as e:
    results.append({"test":"runtime_connectivity","passed":False,"error_type":type(e).__name__})
    print("FAIL runtime request: "+type(e).__name__)
finally:
    out=Path("artifacts/qa-pickup-eta-runtime")
    out.mkdir(parents=True,exist_ok=True)
    (out/"smoke-evidence.json").write_text(json.dumps({
       "function":"pickup-eta","expected_version":9,
       "executedAt":datetime.now(timezone.utc).isoformat(),
       "method":"OPTIONS and invalid-session POST only",
       "realReservationsCreated":0,"credentialsUsed":False,
       "tests":results},indent=2)+"\n")
if len(results)!=7 or any(not x["passed"] for x in results):
    raise SystemExit(1)
