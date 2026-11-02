import base64
import hashlib
import hmac
import json
import os
import re
import time
import urllib.parse
import urllib.request

from flask import Flask, jsonify, make_response, redirect, request
from vercel.blob import sync as blob

app = Flask(__name__)

CONTENT_PATH = "waschi/site-content.json"
VOICE_PATH = "waschi/discord-voice-state-v1.json"
SESSION_COOKIE = "waschi_session"
NEWS_ADMIN = "berndw"
DEFAULT_CALENDAR_ADMINS = ["cathalon1989", "berndw", "schluffyfelixnowa"]

def clean(value, limit=2000):
    return re.sub(r"\s+", " ", str(value or "")).strip()[:limit]

def default_content():
    return {
        "version": 1,
        "calendar": [
            {"id":"holiday-2026-newyear","date":"2026-01-01","title":"Neujahr","category":"holiday","description":"Gesetzlicher Feiertag in Deutschland."},
            {"id":"holiday-2026-good-friday","date":"2026-04-03","title":"Karfreitag","category":"holiday","description":"Gesetzlicher Feiertag in Nordrhein-Westfalen."},
            {"id":"holiday-2026-easter-monday","date":"2026-04-06","title":"Ostermontag","category":"holiday","description":"Gesetzlicher Feiertag in Nordrhein-Westfalen."},
            {"id":"holiday-2026-labor","date":"2026-05-01","title":"Tag der Arbeit","category":"holiday","description":"Gesetzlicher Feiertag in Deutschland."},
            {"id":"holiday-2026-ascension","date":"2026-05-14","title":"Christi Himmelfahrt","category":"holiday","description":"Gesetzlicher Feiertag in Nordrhein-Westfalen."},
            {"id":"holiday-2026-whit-monday","date":"2026-05-25","title":"Pfingstmontag","category":"holiday","description":"Gesetzlicher Feiertag in Nordrhein-Westfalen."},
            {"id":"holiday-2026-corpus-christi","date":"2026-06-04","title":"Fronleichnam","category":"holiday","description":"Gesetzlicher Feiertag in Nordrhein-Westfalen."},
            {"id":"holiday-2026-unity","date":"2026-10-03","title":"Tag der Deutschen Einheit","category":"holiday","description":"Gesetzlicher Feiertag in Deutschland."},
            {"id":"wow-2026-hallows-end","date":"2026-10-19","endDate":"2026-11-02","title":"Schlotternächte","category":"wow","description":"WoW-Feiertag vom 19. Oktober bis 2. November 2026.","link":"https://www.wowhead.com/guide/world-events/holidays/hallows-end"},
            {"id":"holiday-2026-all-saints","date":"2026-11-01","title":"Allerheiligen","category":"holiday","description":"Gesetzlicher Feiertag in Nordrhein-Westfalen."},
            {"id":"wow-2026-day-dead","date":"2026-11-01","endDate":"2026-11-03","title":"Tag der Toten","category":"wow","description":"WoW-Feiertag vom 1. bis 3. November 2026.","link":"https://www.wowhead.com/events"},
            {"id":"wow-2026-anniversary","date":"2026-11-17","endDate":"2026-12-08","title":"WoW – 22. Jubiläum","category":"wow","description":"World of Warcraft feiert sein 22. Jubiläum vom 17. November bis 8. Dezember 2026.","link":"https://www.wowhead.com/events"},
            {"id":"wow-2026-pilgrim","date":"2026-11-22","endDate":"2026-11-29","title":"Pilgerfreuden","category":"wow","description":"WoW-Feiertag vom 22. bis 29. November 2026.","link":"https://www.wowhead.com/events"},
            {"id":"wow-2026-winter-veil","date":"2026-12-15","endDate":"2027-01-02","title":"Winterhauchfest","category":"wow","description":"WoW-Feiertag vom 15. Dezember 2026 bis 2. Januar 2027.","link":"https://www.wowhead.com/events"},
            {"id":"holiday-2026-christmas1","date":"2026-12-25","title":"1. Weihnachtstag","category":"holiday","description":"Gesetzlicher Feiertag in Deutschland."},
            {"id":"holiday-2026-christmas2","date":"2026-12-26","title":"2. Weihnachtstag","category":"holiday","description":"Gesetzlicher Feiertag in Deutschland."}
        ],
        "news": [
            {"id":"bis-tool-01112026","date":"2026-11-01","title":"BiS-Tool: Download & mobile Nutzung","summary":"Das Waschi-BiS-Tool gibt es nun auch im Downloadbereich als lokale Datei. Gleichzeitig wurde die Webversion für Smartphones überarbeitet.","body":"Das Waschi-BiS-Tool wurde weiter verbessert: Ihr könnt es jetzt auch als lokale Datei herunterladen und die Webversion wurde für die Nutzung auf Smartphones angepasst.","published":True},
            {"id":"charakterzuordnung-01112026","date":"2026-11-01","title":"Charaktere ihren Spielern zugeordnet","summary":"Fast alle Gildencharaktere sind inzwischen den richtigen Spielern zugeordnet. Wer sein Profil ergänzen möchte, kann sich bei Lentor im Discord melden.","body":"Fast alle Gildencharaktere sind inzwischen den richtigen Spielern zugeordnet. Wenn ihr euch auf eurem Spielerprofil zusätzlich mit einem Foto und einem kleinen persönlichen Text verewigen möchtet, meldet euch einfach bei Lentor im Discord.","published":True},
            {"id":"hp-patch-01112026","date":"2026-11-01","title":"Homepage-Patch: Fehler behoben","summary":"Bei den letzten Arbeiten an Waschi.fun wurden mehrere Fehler entdeckt und behoben. Falls euch noch etwas auffällt, meldet euch bitte.","body":"Bei den letzten Arbeiten an Waschi.fun wurden mehrere Fehler entdeckt und behoben. Gleichzeitig wurden verschiedene Bereiche der Homepage technisch und optisch nachgebessert.","published":True},
            {"id":"bislisten-online","date":"2026-06-26","title":"Die BiS-Listen sind online","summary":"Unser BiS-Tool ist verfügbar. Hier erklären wir, wie ihr die Listen nutzt.","body":"Ab sofort steht unser BiS-Tool auf Waschi.fun zur Verfügung.","published":True}
        ],
        "permissions":{"calendarAdmins":DEFAULT_CALENDAR_ADMINS[:]},
        "updatedAt":int(time.time())
    }

def load_content():
    fallback = default_content()
    try:
        result = blob.get_blob(CONTENT_PATH, access="private")
        data = json.loads(result.body.decode("utf-8"))
        if not isinstance(data, dict):
            return fallback
        data.setdefault("calendar", fallback["calendar"])
        data.setdefault("news", fallback["news"])
        data.setdefault("permissions", {"calendarAdmins": DEFAULT_CALENDAR_ADMINS[:]})
        return data
    except Exception:
        try:
            save_content(fallback)
        except Exception:
            pass
        return fallback

def save_content(data):
    data["updatedAt"] = int(time.time())
    raw = json.dumps(data, ensure_ascii=False, separators=(",",":")).encode("utf-8")
    blob.put_blob(CONTENT_PATH, raw, access="private", content_type="application/json", allow_overwrite=True, cache_control_max_age=0)

def secret():
    raw = os.environ.get("WASCHI_SESSION_SECRET","").strip() or os.environ.get("BLOB_READ_WRITE_TOKEN","").strip()
    if not raw:
        raise RuntimeError("Session secret fehlt")
    return raw.encode("utf-8")

def b64e(raw):
    return base64.urlsafe_b64encode(raw).decode("ascii").rstrip("=")

def b64d(value):
    return base64.urlsafe_b64decode(value + "=" * (-len(value) % 4))

def sign(payload):
    raw = json.dumps(payload, ensure_ascii=False, separators=(",",":")).encode("utf-8")
    sig = hmac.new(secret(), raw, hashlib.sha256).digest()
    return b64e(raw) + "." + b64e(sig)

def verify(token):
    try:
        a,b = str(token or "").split(".",1)
        raw = b64d(a)
        got = b64d(b)
        want = hmac.new(secret(), raw, hashlib.sha256).digest()
        if not hmac.compare_digest(got,want):
            return None
        data = json.loads(raw.decode("utf-8"))
        if int(data.get("exp") or 0) < int(time.time()):
            return None
        return data
    except Exception:
        return None

def current_user():
    return verify(request.cookies.get(SESSION_COOKIE,""))

def permissions(user=None, content=None):
    user = user or current_user()
    content = content or load_content()
    username = str((user or {}).get("username") or "").strip().lower()
    can_news = bool(user and username == NEWS_ADMIN)
    admins = [str(x).strip().lower() for x in ((content.get("permissions") or {}).get("calendarAdmins") or []) if str(x).strip()]
    can_calendar = bool(user and (can_news or username in admins))
    return {"authenticated":bool(user),"canNews":can_news,"canCalendar":can_calendar,"calendarAdmins":admins}

def require(kind):
    user = current_user()
    content = load_content()
    perms = permissions(user,content)
    if not user:
        return None,content,perms,(jsonify({"ok":False,"error":"Nicht angemeldet"}),401)
    if kind=="news" and not perms["canNews"]:
        return user,content,perms,(jsonify({"ok":False,"error":"Nur Lentor (berndw) darf Aktuelles bearbeiten."}),403)
    if kind=="calendar" and not perms["canCalendar"]:
        return user,content,perms,(jsonify({"ok":False,"error":"Keine Kalender-Berechtigung."}),403)
    return user,content,perms,None

def make_id(prefix,title=""):
    seed=f"{time.time_ns()}:{os.urandom(12).hex()}:{title}".encode()
    return prefix+"-"+hashlib.sha256(seed).hexdigest()[:16]

def discord_profile(code):
    client_id=os.environ.get("DISCORD_CLIENT_ID","").strip()
    client_secret=os.environ.get("DISCORD_CLIENT_SECRET","").strip()
    redirect_uri=os.environ.get("DISCORD_REDIRECT_URI","https://waschi.fun/api/site-auth/callback").strip()
    body=urllib.parse.urlencode({"client_id":client_id,"client_secret":client_secret,"grant_type":"authorization_code","code":code,"redirect_uri":redirect_uri}).encode()
    req=urllib.request.Request("https://discord.com/api/v10/oauth2/token",data=body,headers={"Content-Type":"application/x-www-form-urlencoded","User-Agent":"Waschi.fun"})
    with urllib.request.urlopen(req,timeout=20) as r:
        token=json.loads(r.read().decode())
    access_token=str(token.get("access_token") or "")
    if not access_token:
        raise RuntimeError("Discord Zugriffstoken fehlt")
    req=urllib.request.Request("https://discord.com/api/v10/users/@me",headers={"Authorization":"Bearer "+access_token,"User-Agent":"Waschi.fun"})
    with urllib.request.urlopen(req,timeout=20) as r:
        return json.loads(r.read().decode())


def discord_json(url, token=""):
    headers={"User-Agent":"Waschi.fun/1.0"}
    if token:
        headers["Authorization"]="Bot "+token
    req=urllib.request.Request(url,headers=headers)
    with urllib.request.urlopen(req,timeout=12) as r:
        return json.loads(r.read().decode("utf-8"))

def resolve_server_display_name(guild_id, widget_username):
    username=str(widget_username or "").strip()
    if not username:
        return ""
    # Known guild-side display name requested by the site owner.
    aliases={"berndw":"Waschi-Lentor"}
    bot_token=os.environ.get("DISCORD_BOT_TOKEN","").strip()
    if bot_token:
        try:
            q=urllib.parse.quote(username)
            rows=discord_json(f"https://discord.com/api/v10/guilds/{guild_id}/members/search?query={q}&limit=20",bot_token)
            for member in rows if isinstance(rows,list) else []:
                user=member.get("user") or {}
                candidate=str(user.get("username") or "")
                if candidate.lower()==username.lower():
                    return str(member.get("nick") or user.get("global_name") or candidate or username)
        except Exception:
            pass
    return aliases.get(username.lower(),username)


def discord_request(method, url, token, payload=None):
    headers={"User-Agent":"Waschi.fun/1.0","Authorization":"Bot "+token}
    data=None
    if payload is not None:
        data=json.dumps(payload,separators=(",",":")).encode("utf-8")
        headers["Content-Type"]="application/json"
    req=urllib.request.Request(url,data=data,headers=headers,method=method)
    with urllib.request.urlopen(req,timeout=15) as r:
        raw=r.read()
        if not raw:
            return None
        return json.loads(raw.decode("utf-8"))

def sync_discord_role_visibility_once():
    marker_path="waschi/discord-role-sync-gilde-opfer-v1.json"
    try:
        marker=blob.get_blob(marker_path,access="private")
        if marker and marker.body:
            return {"ok":True,"alreadyDone":True}
    except Exception:
        pass

    token=os.environ.get("DISCORD_BOT_TOKEN","").strip()
    invite_code=os.environ.get("DISCORD_INVITE_CODE","KvstQWvYmC").strip()
    if not token:
        return {"ok":False,"error":"DISCORD_BOT_TOKEN fehlt"}

    invite=discord_json("https://discord.com/api/v10/invites/"+urllib.parse.quote(invite_code)+"?with_counts=true")
    guild_id=str((invite.get("guild") or {}).get("id") or "")
    if not guild_id:
        return {"ok":False,"error":"Discord-Server konnte nicht ermittelt werden"}

    roles=discord_json(f"https://discord.com/api/v10/guilds/{guild_id}/roles",token)
    source=next((r for r in roles if str(r.get("name") or "").strip().lower()=="gilde"),None)
    target=next((r for r in roles if str(r.get("name") or "").strip().lower()=="opfer"),None)
    if not source or not target:
        return {"ok":False,"error":"Rolle Gilde oder Opfer wurde nicht gefunden"}

    # Nur Berechtigungen spiegeln; Name, Farbe, Reihenfolge und Mitglieder bleiben unverändert.
    discord_request("PATCH",f"https://discord.com/api/v10/guilds/{guild_id}/roles/{target['id']}",token,{
        "permissions":str(source.get("permissions") or "0")
    })

    channels=discord_json(f"https://discord.com/api/v10/guilds/{guild_id}/channels",token)
    changed=0
    removed=0
    source_id=str(source["id"])
    target_id=str(target["id"])

    for channel in channels if isinstance(channels,list) else []:
        cid=str(channel.get("id") or "")
        if not cid:
            continue
        overwrites=channel.get("permission_overwrites") or []
        src=next((o for o in overwrites if str(o.get("id"))==source_id and int(o.get("type",0))==0),None)
        dst=next((o for o in overwrites if str(o.get("id"))==target_id and int(o.get("type",0))==0),None)
        if src:
            allow=str(src.get("allow") or "0")
            deny=str(src.get("deny") or "0")
            if not dst or str(dst.get("allow") or "0")!=allow or str(dst.get("deny") or "0")!=deny:
                discord_request("PUT",f"https://discord.com/api/v10/channels/{cid}/permissions/{target_id}",token,{
                    "type":0,"allow":allow,"deny":deny
                })
                changed+=1
        elif dst:
            discord_request("DELETE",f"https://discord.com/api/v10/channels/{cid}/permissions/{target_id}",token)
            removed+=1

    result={
        "ok":True,
        "guildId":guild_id,
        "sourceRole":"Gilde",
        "targetRole":"Opfer",
        "channelsUpdated":changed,
        "obsoleteOverridesRemoved":removed,
        "completedAt":int(time.time())
    }
    blob.put_blob(marker_path,json.dumps(result,separators=(",",":")).encode("utf-8"),
                  access="private",content_type="application/json",
                  allow_overwrite=True,cache_control_max_age=0)
    return result

def load_voice_snapshot(max_age=90):
    try:
        result=blob.get_blob(VOICE_PATH,access="private")
        data=json.loads(result.body.decode("utf-8"))
        updated=int(data.get("updatedAt") or 0)
        if not updated or int(time.time())-updated>max_age:
            return {"available":False,"stale":True,"voiceMembers":0,"channels":[]}
        channels=[]
        for channel in data.get("channels") or []:
            name=clean(channel.get("name"),100)
            members=[]
            for member in channel.get("members") or []:
                members.append({
                    "id":str(member.get("id") or ""),
                    "name":clean(member.get("name"),100),
                    "username":clean(member.get("username"),100),
                    "avatar":str(member.get("avatar") or "")[:500]
                })
            if name and members:
                channels.append({"id":str(channel.get("id") or ""),"name":name,"members":members[:25]})
        return {
            "available":True,
            "stale":False,
            "updatedAt":updated,
            "voiceMembers":int(data.get("voiceMembers") or sum(len(c["members"]) for c in channels)),
            "channels":channels[:20]
        }
    except Exception:
        return {"available":False,"stale":False,"voiceMembers":0,"channels":[]}


def discord_bot_guild(token):
    configured_id=os.environ.get("DISCORD_GUILD_ID","").strip()
    guilds=discord_json("https://discord.com/api/v10/users/@me/guilds",token)
    if not isinstance(guilds,list) or not guilds:
        raise RuntimeError("Der Waschi-Bot ist mit keinem Discord-Server verbunden")
    if configured_id:
        found=next((g for g in guilds if str(g.get("id") or "")==configured_id),None)
        if found:
            return found
    found=next((g for g in guilds if str(g.get("name") or "").strip().lower()=="waschi"),None)
    return found or guilds[0]

@app.get("/api/discord-online")
def discord_online():
    voice=load_voice_snapshot(max_age=120)
    if voice.get("available"):
        return jsonify({
            "ok":True,
            "source":"altare-gateway",
            "server":"Waschi",
            "online":None,
            "total":None,
            "members":[],
            "memberListAvailable":False,
            "voiceAvailable":True,
            "voiceStale":False,
            "voiceMembers":int(voice.get("voiceMembers") or 0),
            "voiceChannels":voice.get("channels") or [],
            "voiceUpdatedAt":voice.get("updatedAt"),
            "botAlwaysOn":True,
            "statusText":"Voice-Kanäle live über den Waschi-Bot auf Altare"
        })

    return jsonify({
        "ok":True,
        "source":"altare-gateway",
        "server":"Waschi",
        "online":None,
        "total":None,
        "members":[],
        "memberListAvailable":False,
        "voiceAvailable":False,
        "voiceStale":bool(voice.get("stale")),
        "voiceMembers":0,
        "voiceChannels":[],
        "botAlwaysOn":True,
        "statusText":"Waschi-Bot auf Altare verbunden; Voice-Snapshot derzeit nicht aktuell"
    })

@app.get("/api/site-auth/login")
def auth_login():
    cid=os.environ.get("DISCORD_CLIENT_ID","").strip()
    csecret=os.environ.get("DISCORD_CLIENT_SECRET","").strip()
    if not cid or not csecret:
        return redirect("/calendar/?auth=setup")
    nxt=request.args.get("next","/calendar/")
    if not nxt.startswith("/"):
        nxt="/calendar/"
    state=sign({"next":nxt,"exp":int(time.time())+600})
    redirect_uri=os.environ.get("DISCORD_REDIRECT_URI","https://waschi.fun/api/site-auth/callback").strip()
    q=urllib.parse.urlencode({"client_id":cid,"response_type":"code","redirect_uri":redirect_uri,"scope":"identify","state":state})
    return redirect("https://discord.com/oauth2/authorize?"+q)

@app.get("/api/site-auth/callback")
def auth_callback():
    state=verify(request.args.get("state",""))
    if not state:
        return redirect("/calendar/?auth=state")
    try:
        p=discord_profile(request.args.get("code",""))
        session={"id":str(p.get("id") or ""),"username":str(p.get("username") or ""),"globalName":str(p.get("global_name") or ""),"exp":int(time.time())+7*24*3600}
        resp=make_response(redirect(state.get("next") or "/calendar/"))
        resp.set_cookie(SESSION_COOKIE,sign(session),max_age=7*24*3600,secure=True,httponly=True,samesite="Lax",path="/")
        return resp
    except Exception:
        return redirect("/calendar/?auth=failed")

@app.get("/api/site-auth/status")
def auth_status():
    user=current_user()
    content=load_content()
    perms=permissions(user,content)
    pub=None if not user else {"id":user.get("id"),"username":user.get("username"),"globalName":user.get("globalName")}
    return jsonify({"ok":True,"configured":bool(os.environ.get("DISCORD_CLIENT_ID") and os.environ.get("DISCORD_CLIENT_SECRET")),"user":pub,**perms})

@app.post("/api/site-auth/logout")
def auth_logout():
    resp=make_response(jsonify({"ok":True}))
    resp.delete_cookie(SESSION_COOKIE,path="/")
    return resp

@app.get("/api/site-content")
def content_get():
    content=load_content()
    news=[n for n in content.get("news",[]) if n.get("published",True)]
    news.sort(key=lambda n:(str(n.get("date") or ""),str(n.get("createdAt") or "")),reverse=True)
    calendar=list(content.get("calendar",[]))
    calendar.sort(key=lambda e:(str(e.get("date") or ""),str(e.get("time") or "")))
    return jsonify({"ok":True,"calendar":calendar,"news":news,"updatedAt":content.get("updatedAt")})

@app.post("/api/site-calendar")
def calendar_save():
    user,content,perms,error=require("calendar")
    if error:return error
    data=request.get_json(silent=True) or {}
    event_id=clean(data.get("id"),100)
    rows=content.setdefault("calendar",[])
    row=next((x for x in rows if str(x.get("id"))==event_id),None) if event_id else None
    if row is None:
        row={"id":make_id("event",data.get("title")),"createdAt":int(time.time()),"createdBy":user.get("username")}
        rows.append(row)
    row.update({"title":clean(data.get("title"),160),"date":clean(data.get("date"),10),"endDate":clean(data.get("endDate"),10),"time":clean(data.get("time"),5),"endTime":clean(data.get("endTime"),5),"category":clean(data.get("category") or "waschi",30),"description":clean(data.get("description"),3000),"link":clean(data.get("link"),500),"updatedAt":int(time.time()),"updatedBy":user.get("username")})
    if not row["title"] or not re.fullmatch(r"\d{4}-\d{2}-\d{2}",row["date"]):
        return jsonify({"ok":False,"error":"Titel und gültiges Datum sind erforderlich."}),400
    save_content(content)
    return jsonify({"ok":True,"event":row})

@app.delete("/api/site-calendar")
def calendar_delete():
    user,content,perms,error=require("calendar")
    if error:return error
    event_id=clean(request.args.get("id"),100)
    before=len(content.get("calendar",[]))
    content["calendar"]=[x for x in content.get("calendar",[]) if str(x.get("id"))!=event_id]
    if len(content["calendar"])==before:
        return jsonify({"ok":False,"error":"Termin nicht gefunden"}),404
    save_content(content)
    return jsonify({"ok":True})

@app.post("/api/site-news")
def news_save():
    user,content,perms,error=require("news")
    if error:return error
    data=request.get_json(silent=True) or {}
    news_id=clean(data.get("id"),100)
    rows=content.setdefault("news",[])
    row=next((x for x in rows if str(x.get("id"))==news_id),None) if news_id else None
    if row is None:
        row={"id":make_id("news",data.get("title")),"createdAt":int(time.time()),"createdBy":user.get("username")}
        rows.append(row)
    row.update({"title":clean(data.get("title"),180),"date":clean(data.get("date"),10),"summary":clean(data.get("summary"),700),"body":clean(data.get("body"),8000),"published":bool(data.get("published",True)),"updatedAt":int(time.time()),"updatedBy":user.get("username")})
    if not row["title"] or not re.fullmatch(r"\d{4}-\d{2}-\d{2}",row["date"]):
        return jsonify({"ok":False,"error":"Titel und gültiges Datum sind erforderlich."}),400
    save_content(content)
    return jsonify({"ok":True,"news":row})

@app.delete("/api/site-news")
def news_delete():
    user,content,perms,error=require("news")
    if error:return error
    news_id=clean(request.args.get("id"),100)
    content["news"]=[x for x in content.get("news",[]) if str(x.get("id"))!=news_id]
    save_content(content)
    return jsonify({"ok":True})

@app.post("/api/site-calendar-admins")
def calendar_admins():
    user,content,perms,error=require("news")
    if error:return error
    data=request.get_json(silent=True) or {}
    admins=[]
    for value in data.get("admins") or []:
        v=clean(value,80).lower()
        if v and v not in admins:
            admins.append(v)
    if "berndw" not in admins:
        admins.insert(0,"berndw")
    content.setdefault("permissions",{})["calendarAdmins"]=admins[:30]
    save_content(content)
    return jsonify({"ok":True,"calendarAdmins":admins[:30]})

@app.get("/api/health")
def health():
    return jsonify({"ok":True,"service":"waschi-site-admin"})
