#!/usr/bin/env python3
import argparse
import io
import base64
import json
import mimetypes
import os
import re
import threading
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import webbrowser
import zlib
import zipfile
from pathlib import Path

HOST = '127.0.0.1'
PORT = 8765
ROOT = Path(__file__).resolve().parents[1]
DASHBOARD = ROOT / 'index.html'
BLIZZARD_CONFIG = ROOT / 'blizzard_api_config.json'
GLOBAL_CONFIG_DIR = Path(os.environ.get('APPDATA') or (Path.home() / '.config')) / 'WoW_BiS_Dashboard'
GLOBAL_BLIZZARD_CONFIG = GLOBAL_CONFIG_DIR / 'blizzard_api_config.json'
GLOBAL_CONFIG_DISABLED = GLOBAL_CONFIG_DIR / 'credentials_disabled'
BLIZZARD_TOKEN = {'access_token': '', 'expires_at': 0.0, 'client_id': ''}
BLIZZARD_TOKEN_LOCK = threading.Lock()
USER_AGENT = 'Mozilla/5.0 (Waschi.fun WoW BiS Dashboard Web API)'
RIO_FIELDS = 'gear,mythic_plus_scores_by_season:current,mythic_plus_recent_runs,mythic_plus_best_runs:all,mythic_plus_alternate_runs,mythic_plus_highest_level_runs,mythic_plus_weekly_highest_level_runs,mythic_plus_previous_weekly_highest_level_runs'

EQUIPMENT_CACHE = {}
ITEM_DATA_CACHE = {}
ITEM_MEDIA_CACHE = {}
REMOTE_IMAGE_CACHE = {}
CHARACTER_MEDIA_CACHE = {}
API_CACHE_LOCK = threading.Lock()


def fetch(url, timeout=25):
    req = urllib.request.Request(url, headers={'User-Agent': USER_AGENT, 'Accept': 'application/json,text/plain,text/html,*/*'})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read(), dict(r.headers), r.status


def fetch_json(url, timeout=25):
    raw, headers, status = fetch(url, timeout)
    return json.loads(raw.decode('utf-8')), headers, status


def fetch_json_request(req, timeout=25):
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read().decode('utf-8')), dict(r.headers), r.status



def _visible_text(raw):
    text = str(raw or '')
    text = re.sub(r'(?is)<script[^>]*>.*?</script>', ' ', text)
    text = re.sub(r'(?is)<style[^>]*>.*?</style>', ' ', text)
    text = re.sub(r'(?s)<[^>]+>', ' ', text)
    replacements = {'&nbsp;':' ', '&#160;':' ', '&amp;':'&', '&quot;':'"', '&#39;':"'", '&lt;':'<', '&gt;':'>'}
    for a,b in replacements.items():
        text=text.replace(a,b)
    return re.sub(r'\s+', ' ', text).strip()


def _find_percent_near_label(text, label_pattern):
    num=r'(\d{1,3}(?:[\.,]\d{1,3})?)\s*%'
    patterns=[rf'{num}\s*[:\-–—]?\s*(?:{label_pattern})\b', rf'\b(?:{label_pattern})\s*[:\-–—]?\s*{num}']
    vals=[]
    for pat in patterns:
        for m in re.finditer(pat,text,re.I):
            try:
                v=float(m.group(1).replace(',','.'))
                if 0 <= v <= 200: vals.append(v)
            except (TypeError,ValueError):
                pass
    if not vals:
        return None
    return vals[0]


def _parse_public_armory_stats(raw):
    text=_visible_text(raw)
    labels={
        'crit':r'(?:Kritische\s+Trefferchance|Kritische\s+Trefferwertung|Kritischer\s+Trefferwert|Kritischer\s+Treffer|Critical\s+Strike(?:\s+Chance)?)',
        'haste':r'(?:Tempo|Haste)',
        'mastery':r'(?:Meisterschaft|Mastery)',
        'versatility':r'(?:Vielseitigkeit|Versatility)'
    }
    out={k:_find_percent_near_label(text,v) for k,v in labels.items()}
    # Die öffentliche Charakterseite liefert einzelne Sekundärwerte teilweise
    # asynchron bzw. nicht in jeder Ansicht vollständig. Ein fehlender Wert darf
    # deshalb nicht mehr den Abgleich aller anderen, vorhandenen Werte verwerfen.
    return out if any(isinstance(v,(int,float)) for v in out.values()) else None


def fetch_public_armory_stats(region, realm, name):
    region=str(region or 'eu').lower().strip()
    locale='de-de' if region=='eu' else 'en-us'
    realm_slug=re.sub(r"[’'\s]+",'-',str(realm or '').strip().lower())
    name_slug=str(name or '').strip().lower()
    page=f'https://worldofwarcraft.blizzard.com/{locale}/character/{urllib.parse.quote(region)}/{urllib.parse.quote(realm_slug)}/{urllib.parse.quote(name_slug)}'
    for url,source in ((page,'Blizzard Charakterseite'),('https://r.jina.ai/'+page,'Blizzard Charakterseite · Reader')):
        try:
            raw,_,_=fetch(url,timeout=12)
            parsed=_parse_public_armory_stats(raw.decode('utf-8','replace'))
            if parsed:
                return parsed, source, page
        except Exception:
            pass
    return None, '', page


def reconcile_display_stats(api_stats, armory_stats):
    result=dict(api_stats or {})
    compared={}
    if not armory_stats:
        return result,compared
    for key in ('crit','haste','mastery','versatility'):
        av=armory_stats.get(key)
        bv=result.get(key)
        if not isinstance(av,(int,float)):
            continue
        # Die Character Statistics API liefert die präzisen Prozentwerte. Die
        # öffentliche Charakterseite rundet diese Werte teilweise stark und darf
        # deshalb einen vorhandenen API-Wert niemals überschreiben.
        if not isinstance(bv,(int,float)):
            result[key]=float(av)
            compared[key]={'api':bv,'armory':float(av),'delta':None,'fallback':True}
        elif abs(float(av)-float(bv))>=0.05:
            compared[key]={'api':float(bv),'armory':float(av),'delta':round(float(av)-float(bv),3),'fallback':False}
    return result,compared


def _read_blizzard_config_file(path):
    try:
        data = json.loads(Path(path).read_text(encoding='utf-8'))
        client_id = str(data.get('client_id') or '').strip()
        client_secret = str(data.get('client_secret') or '').strip()
        if client_id and client_secret:
            return {'client_id': client_id, 'client_secret': client_secret}
    except Exception:
        pass
    return None


def _write_blizzard_config_file(path, data):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + '.tmp')
    tmp.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding='utf-8')
    try:
        os.chmod(tmp, 0o600)
    except OSError:
        pass
    tmp.replace(path)
    try:
        os.chmod(path, 0o600)
    except OSError:
        pass


def _config_candidates():
    candidates = [GLOBAL_BLIZZARD_CONFIG, BLIZZARD_CONFIG]
    if GLOBAL_CONFIG_DISABLED.exists():
        return candidates
    # Older downloaded dashboard versions usually sit next to the current folder.
    # Reuse their local credentials once and migrate them into the per-user config.
    for parent in (ROOT.parent, ROOT.parent.parent):
        try:
            for candidate in parent.glob('WoW_MythicPlus_BiS_Dashboard*/blizzard_api_config.json'):
                if candidate not in candidates:
                    candidates.append(candidate)
        except Exception:
            pass
    return candidates


def load_blizzard_config():
    client_id = os.environ.get('BLIZZARD_CLIENT_ID', '').strip()
    client_secret = os.environ.get('BLIZZARD_CLIENT_SECRET', '').strip()
    source = 'Umgebungsvariablen' if client_id and client_secret else ''
    if not (client_id and client_secret):
        for path in _config_candidates():
            data = _read_blizzard_config_file(path)
            if not data:
                continue
            client_id, client_secret = data['client_id'], data['client_secret']
            source = 'globale lokale Konfiguration' if Path(path) == GLOBAL_BLIZZARD_CONFIG else 'lokale Konfigurationsdatei'
            if Path(path) != GLOBAL_BLIZZARD_CONFIG:
                try:
                    _write_blizzard_config_file(GLOBAL_BLIZZARD_CONFIG, data)
                    source += ' (automatisch übernommen)'
                except Exception:
                    pass
            break
    return {'client_id': client_id, 'client_secret': client_secret, 'source': source}


def save_blizzard_config(client_id, client_secret):
    data = {'client_id': str(client_id).strip(), 'client_secret': str(client_secret).strip()}
    if not data['client_id'] or not data['client_secret']:
        raise ValueError('Client ID und Client Secret muessen gesetzt sein')
    # Store globally so later dashboard versions can reuse the setup, plus a local copy
    # for portability of the current installation.
    _write_blizzard_config_file(GLOBAL_BLIZZARD_CONFIG, data)
    _write_blizzard_config_file(BLIZZARD_CONFIG, data)
    try:
        GLOBAL_CONFIG_DISABLED.unlink(missing_ok=True)
    except TypeError:
        if GLOBAL_CONFIG_DISABLED.exists():
            GLOBAL_CONFIG_DISABLED.unlink()
    with BLIZZARD_TOKEN_LOCK:
        BLIZZARD_TOKEN.update({'access_token': '', 'expires_at': 0.0, 'client_id': ''})


def clear_blizzard_config():
    for path in (BLIZZARD_CONFIG, GLOBAL_BLIZZARD_CONFIG):
        try:
            Path(path).unlink(missing_ok=True)
        except TypeError:
            if Path(path).exists():
                Path(path).unlink()
    try:
        GLOBAL_CONFIG_DIR.mkdir(parents=True, exist_ok=True)
        GLOBAL_CONFIG_DISABLED.write_text('disabled', encoding='utf-8')
    except Exception:
        pass
    with BLIZZARD_TOKEN_LOCK:
        BLIZZARD_TOKEN.update({'access_token': '', 'expires_at': 0.0, 'client_id': ''})


def blizzard_access_token(force=False):
    cfg = load_blizzard_config()
    client_id, client_secret = cfg['client_id'], cfg['client_secret']
    if not client_id or not client_secret:
        raise RuntimeError('Blizzard API ist noch nicht eingerichtet')
    now = time.time()
    with BLIZZARD_TOKEN_LOCK:
        if (not force and BLIZZARD_TOKEN.get('access_token') and
                BLIZZARD_TOKEN.get('client_id') == client_id and
                float(BLIZZARD_TOKEN.get('expires_at') or 0) > now + 60):
            return BLIZZARD_TOKEN['access_token']
        form = urllib.parse.urlencode({'grant_type': 'client_credentials'}).encode('ascii')
        basic = base64.b64encode(f'{client_id}:{client_secret}'.encode('utf-8')).decode('ascii')
        req = urllib.request.Request(
            'https://oauth.battle.net/token', data=form, method='POST',
            headers={
                'Authorization': 'Basic ' + basic,
                'Content-Type': 'application/x-www-form-urlencoded',
                'Accept': 'application/json',
                'User-Agent': USER_AGENT,
            })
        try:
            data, _, _ = fetch_json_request(req, timeout=20)
        except urllib.error.HTTPError as e:
            detail = ''
            try:
                detail = e.read().decode('utf-8', errors='replace').strip()
            except Exception:
                pass
            if e.code == 401:
                raise RuntimeError('HTTP 401: Battle.net hat die API Client ID oder das API Client Secret abgelehnt. Bitte keine normalen Battle.net-Logindaten verwenden und beide Werte ohne Leerzeichen erneut aus dem Developer-Portal kopieren.') from e
            raise RuntimeError(f'Battle.net OAuth HTTP {e.code}' + (f': {detail}' if detail else '')) from e
        token = str(data.get('access_token') or '')
        if not token:
            raise RuntimeError('Battle.net hat kein Access Token geliefert')
        expires = max(120, int(data.get('expires_in') or 0))
        BLIZZARD_TOKEN.update({'access_token': token, 'expires_at': now + expires, 'client_id': client_id})
        return token


def _number(data, *path):
    cur = data
    for key in path:
        if not isinstance(cur, dict) or key not in cur:
            return None
        cur = cur[key]
    try:
        value = float(cur)
        return value if value >= 0 else None
    except (TypeError, ValueError):
        return None


STAT_KEYS = ('crit', 'haste', 'mastery', 'versatility', 'leech', 'avoidance', 'speed')
STAT_TEXT_PATTERNS = {
    'crit': ('critical strike', 'critical strike rating', 'crit'),
    'haste': ('haste', 'haste rating'),
    'mastery': ('mastery', 'mastery rating'),
    'versatility': ('versatility', 'versatility rating'),
    'leech': ('leech', 'lifesteal'),
    'avoidance': ('avoidance',),
    'speed': ('speed', 'movement speed'),
}
STAT_TYPE_MAP = {
    'CRIT_RATING': 'crit', 'CRITICAL_STRIKE': 'crit', 'CRITICAL_STRIKE_RATING': 'crit',
    'HASTE_RATING': 'haste', 'HASTE': 'haste',
    'MASTERY_RATING': 'mastery', 'MASTERY': 'mastery',
    'VERSATILITY': 'versatility', 'VERSATILITY_RATING': 'versatility',
    'LIFESTEAL': 'leech', 'LIFESTEAL_RATING': 'leech', 'LEECH': 'leech', 'LEECH_RATING': 'leech',
    'AVOIDANCE': 'avoidance', 'AVOIDANCE_RATING': 'avoidance',
    'SPEED': 'speed', 'SPEED_RATING': 'speed',
}


def _normalized_rating(node):
    if not isinstance(node, dict):
        return None
    # Blizzard introduced rating_normalized for rated stats in 2025. Prefer it,
    # because the historical rating field can overflow on some characters.
    for key in ('rating_normalized', 'rating'):
        try:
            v = float(node.get(key))
            if v >= 0:
                return v
        except (TypeError, ValueError):
            pass
    return None


def _stat_rating_snapshot(data, character_class='', spec=''):
    mode = _combat_stat_mode(character_class, spec)
    result = {
        'crit': _normalized_rating(data.get(f'{mode}_crit')),
        'haste': _normalized_rating(data.get(f'{mode}_haste')),
        'mastery': _normalized_rating(data.get('mastery')),
        'versatility': _number(data, 'versatility'),
        'leech': _normalized_rating(data.get('lifesteal')),
        'avoidance': _normalized_rating(data.get('avoidance')),
        'speed': _normalized_rating(data.get('speed')),
    }
    if result['crit'] is None:
        result['crit'] = next((v for v in (_normalized_rating(data.get('melee_crit')), _normalized_rating(data.get('ranged_crit')), _normalized_rating(data.get('spell_crit'))) if v is not None), None)
    if result['haste'] is None:
        result['haste'] = next((v for v in (_normalized_rating(data.get('melee_haste')), _normalized_rating(data.get('ranged_haste')), _normalized_rating(data.get('spell_haste'))) if v is not None), None)
    return result


def _stat_rating_bonus_snapshot(data, character_class='', spec=''):
    mode = _combat_stat_mode(character_class, spec)
    result = {
        'crit': _number(data, f'{mode}_crit', 'rating_bonus'),
        'haste': _number(data, f'{mode}_haste', 'rating_bonus'),
        'mastery': _number(data, 'mastery', 'rating_bonus'),
        'versatility': _number(data, 'versatility_damage_done_bonus'),
        'leech': _number(data, 'lifesteal', 'rating_bonus'),
        'avoidance': _number(data, 'avoidance', 'rating_bonus'),
        'speed': _number(data, 'speed', 'rating_bonus'),
    }
    if result['crit'] is None:
        result['crit'] = next((v for v in (_number(data, 'melee_crit', 'rating_bonus'), _number(data, 'ranged_crit', 'rating_bonus'), _number(data, 'spell_crit', 'rating_bonus')) if v is not None), None)
    if result['haste'] is None:
        result['haste'] = next((v for v in (_number(data, 'melee_haste', 'rating_bonus'), _number(data, 'ranged_haste', 'rating_bonus'), _number(data, 'spell_haste', 'rating_bonus')) if v is not None), None)
    return result


def _stat_key_from_type(stat):
    if not isinstance(stat, dict):
        return None
    t = stat.get('type')
    if isinstance(t, dict):
        raw = str(t.get('type') or t.get('name') or '')
    else:
        raw = str(t or '')
    key = re.sub(r'[^A-Z0-9]+', '_', raw.upper()).strip('_')
    if key in STAT_TYPE_MAP:
        return STAT_TYPE_MAP[key]
    name = ''
    if isinstance(t, dict):
        name = str(t.get('name') or '')
    text = f'{raw} {name}'.lower()
    for k, aliases in STAT_TEXT_PATTERNS.items():
        if any(alias in text for alias in aliases):
            return k
    return None


def _equipment_base_ratings(equipment):
    totals = {k: 0.0 for k in STAT_KEYS}
    for item in (equipment or {}).get('equipped_items') or []:
        for stat in item.get('stats') or []:
            key = _stat_key_from_type(stat)
            if not key:
                continue
            try:
                val = float(stat.get('value'))
            except (TypeError, ValueError):
                continue
            if val > 0:
                totals[key] += val
    return totals


def _number_token(text):
    text = str(text or '').replace('\u202f', '').replace('\xa0', '').strip()
    # Equipment is requested in en_US, so commas are thousands separators.
    text = text.replace(',', '')
    try:
        return float(text)
    except ValueError:
        return None


def _bonuses_from_text(text):
    text = str(text or '')
    found = {k: 0.0 for k in STAT_KEYS}
    if not text:
        return found
    # Supports strings like "+315 Haste", "+147 Critical Strike and +49 Mastery"
    # and localized fallback aliases if Blizzard happens to return them.
    aliases = {
        'crit': r'(?:Critical\s+Strike(?:\s+Rating)?|Crit(?:ical)?|Kritische\s+Trefferwertung|Krit)',
        'haste': r'(?:Haste(?:\s+Rating)?|Tempo)',
        'mastery': r'(?:Mastery(?:\s+Rating)?|Meisterschaft)',
        'versatility': r'(?:Versatility(?:\s+Rating)?|Vielseitigkeit)',
        'leech': r'(?:Leech|Lifesteal|Lebensraub)',
        'avoidance': r'(?:Avoidance|Vermeidung)',
        'speed': r'(?:Movement\s+Speed|Speed|Geschwindigkeit)',
    }
    for key, alias in aliases.items():
        pat = re.compile(r'([+-]?\d[\d,]*(?:\.\d+)?)\s*%?\s*' + alias, re.I)
        for m in pat.finditer(text):
            value = _number_token(m.group(1))
            if value is None or value <= 0:
                continue
            # A literal percent bonus is already a percentage effect and not rating.
            # Current gems/armor enchants expose ratings, but we keep percentage effects separate.
            segment = text[m.start(1):m.end()]
            if '%' in segment:
                continue
            found[key] += value
    return found


def _equipment_enhancement_bonuses(equipment):
    totals = {k: 0.0 for k in STAT_KEYS}
    details = []
    enchant_count = 0
    gem_count = 0
    for item in (equipment or {}).get('equipped_items') or []:
        slot = ((item.get('slot') or {}).get('name') or (item.get('slot') or {}).get('type') or '')
        item_name = item.get('name') or f"Item {((item.get('item') or {}).get('id') or '')}".strip()
        for ench in item.get('enchantments') or []:
            chunks = [ench.get('display_string') or '']
            spell = ench.get('spell') or {}
            if isinstance(spell, dict):
                chunks.append(spell.get('description') or '')
                spell_obj = spell.get('spell') or {}
                if isinstance(spell_obj, dict):
                    chunks.append(spell_obj.get('name') or '')
            src = ench.get('source_item') or {}
            if isinstance(src, dict):
                chunks.append(src.get('name') or '')
            text = ' | '.join(x for x in chunks if x)
            bonus = _bonuses_from_text(text)
            if any(v > 0 for v in bonus.values()):
                enchant_count += 1
                for k, v in bonus.items():
                    totals[k] += v
                details.append({'kind': 'Verzauberung', 'slot': slot, 'item': item_name, 'text': ench.get('display_string') or text, 'ratings': {k: v for k, v in bonus.items() if v > 0}})
        for sock in item.get('sockets') or []:
            chunks = [sock.get('display_string') or '']
            gem = sock.get('item') or {}
            if isinstance(gem, dict):
                chunks.append(gem.get('name') or '')
            text = ' | '.join(x for x in chunks if x)
            bonus = _bonuses_from_text(text)
            if any(v > 0 for v in bonus.values()):
                gem_count += 1
                for k, v in bonus.items():
                    totals[k] += v
                details.append({'kind': 'Edelstein', 'slot': slot, 'item': item_name, 'text': sock.get('display_string') or text, 'ratings': {k: v for k, v in bonus.items() if v > 0}})
    return totals, details, enchant_count, gem_count


def _dr_output(pre_dr_percent):
    # Retail secondary-stat rating DR. The penalty is progressive and applies only
    # to the part of the rating-derived stat that lies in the respective bracket.
    x = max(0.0, float(pre_dr_percent or 0.0))
    brackets = ((30.0, 1.00), (39.0, 0.90), (47.0, 0.80), (54.0, 0.70), (66.0, 0.60), (126.0, 0.50))
    out = 0.0
    prev = 0.0
    for limit, mult in brackets:
        if x <= prev:
            break
        part = min(x, limit) - prev
        if part > 0:
            out += part * mult
        prev = limit
    return out


def _infer_rating_per_percent(rating, rating_bonus):
    try:
        rating = float(rating)
        rating_bonus = float(rating_bonus)
    except (TypeError, ValueError):
        return None
    if rating <= 0 or rating_bonus <= 0:
        return None
    # Solve _dr_output(rating / scale) == rating_bonus. This automatically follows
    # the character's current level/stat conversion without hardcoding Midnight constants.
    lo, hi = 0.01, 10000.0
    for _ in range(80):
        mid = (lo + hi) / 2.0
        out = _dr_output(rating / mid)
        if out > rating_bonus:
            lo = mid
        else:
            hi = mid
    return (lo + hi) / 2.0


def _added_percent_from_rating(current_rating, current_bonus, added_rating, secondary=True):
    try:
        r = float(current_rating)
        b = float(current_bonus)
        a = float(added_rating)
    except (TypeError, ValueError):
        return 0.0
    if a <= 0:
        return 0.0
    if r > 0 and b > 0:
        if secondary:
            scale = _infer_rating_per_percent(r, b)
            if scale and scale > 0:
                return max(0.0, _dr_output((r + a) / scale) - _dr_output(r / scale))
        return max(0.0, a * (b / r))
    # Conservative fallback: no reliable conversion available, so do not invent a percent.
    return 0.0


def _apply_missing_equipment_bonuses(raw_stats, normalized, equipment, character_class='', spec=''):
    api_ratings = _stat_rating_snapshot(raw_stats, character_class, spec)
    api_rating_bonuses = _stat_rating_bonus_snapshot(raw_stats, character_class, spec)
    base_ratings = _equipment_base_ratings(equipment)
    enhancements, details, enchant_count, gem_count = _equipment_enhancement_bonuses(equipment)
    applied_ratings = {k: 0.0 for k in STAT_KEYS}
    applied_percent = {k: 0.0 for k in STAT_KEYS}
    inclusion = {}
    for key in STAT_KEYS:
        bonus = float(enhancements.get(key) or 0.0)
        if bonus <= 0:
            inclusion[key] = 'keine Boni erkannt'
            continue
        api_rating = api_ratings.get(key)
        base_rating = float(base_ratings.get(key) or 0.0)
        if api_rating is None:
            # Without Blizzard's rating we cannot safely decide whether a bonus is already included.
            inclusion[key] = 'nicht prüfbar'
            continue
        already_beyond_base = max(0.0, float(api_rating) - base_rating)
        missing_rating = max(0.0, bonus - already_beyond_base)
        # Small rounding differences must not cause a phantom correction.
        if missing_rating <= max(1.0, bonus * 0.03):
            inclusion[key] = 'bereits in Blizzard-Statistik enthalten'
            continue
        pct = _added_percent_from_rating(api_rating, api_rating_bonuses.get(key), missing_rating, secondary=key in ('crit', 'haste', 'mastery', 'versatility'))
        if pct <= 0:
            inclusion[key] = 'Bonus erkannt, Umrechnung nicht sicher möglich'
            continue
        normalized[key] = float(normalized.get(key) or 0.0) + pct
        applied_ratings[key] = missing_rating
        applied_percent[key] = pct
        inclusion[key] = 'fehlender Ausrüstungsbonus ergänzt'
    return {
        'stats': normalized,
        'equipmentBaseRatings': base_ratings,
        'enhancementRatings': enhancements,
        'appliedRatings': applied_ratings,
        'appliedPercent': applied_percent,
        'inclusion': inclusion,
        'details': details,
        'enchantCount': enchant_count,
        'gemCount': gem_count,
    }


def _equipment_tooltip_details(equipment):
    """Return a rich, browser-safe per-slot snapshot from Blizzard Character Equipment."""
    out = []
    for item in (equipment or {}).get('equipped_items') or []:
        slot = item.get('slot') or {}
        item_ref = item.get('item') or {}
        quality = item.get('quality') or {}
        level = item.get('level') or {}
        inv = item.get('inventory_type') or {}
        armor = item.get('armor') or {}
        req = item.get('requirements') or {}
        req_level = req.get('level') or {}
        durability = item.get('durability') or {}

        stats = []
        for st in item.get('stats') or []:
            typ = st.get('type') or {}
            display = _localized_text(st.get('display') or st.get('display_string'))
            stat_name = _localized_text(typ) or _localized_text(st.get('name'))
            value = st.get('value')
            if not display and value is not None and stat_name:
                try:
                    display = f"+{int(value):,} {stat_name}".replace(',', '.')
                except Exception:
                    display = f"+{value} {stat_name}"
            stats.append({
                'type': typ.get('type') if isinstance(typ, dict) else str(typ or ''),
                'name': stat_name,
                'value': value,
                'display': display,
                'isNegated': bool(st.get('is_negated')),
                'isEquipBonus': bool(st.get('is_equip_bonus')),
            })

        enchants = []
        for ench in item.get('enchantments') or []:
            src = ench.get('source_item') or {}
            spell = ench.get('spell') or {}
            spell_ref = spell.get('spell') if isinstance(spell, dict) else {}
            display = _localized_text(ench.get('display_string') or ench.get('display') or spell.get('description') if isinstance(spell, dict) else '')
            if not display:
                display = _localized_text(src) or _localized_text(spell_ref) or _localized_text(spell)
            enchants.append({
                'display': display,
                'itemId': src.get('id') if isinstance(src, dict) else None,
                'enchantmentId': ench.get('enchantment_id') or ench.get('id'),
                'name': _localized_text(src) or _localized_text(spell_ref),
            })

        sockets = []
        for sock in item.get('sockets') or []:
            gem = sock.get('item') or {}
            stype = sock.get('socket_type') or {}
            display = _localized_text(sock.get('display_string') or sock.get('display'))
            gem_name = _localized_text(gem)
            if not display:
                display = gem_name or ('Leerer ' + (_localized_text(stype) or 'Sockel'))
            sockets.append({
                'display': display,
                'itemId': gem.get('id') if isinstance(gem, dict) else None,
                'name': gem_name,
                'socketType': _localized_text(stype),
            })

        effects = []
        for spell_entry in item.get('spells') or item.get('effects') or []:
            spell = spell_entry.get('spell') if isinstance(spell_entry, dict) else None
            description = _localized_text(spell_entry.get('description') if isinstance(spell_entry, dict) else '')
            spell_name = _localized_text(spell)
            display = description or _localized_text(spell_entry.get('display_string') if isinstance(spell_entry, dict) else '') or spell_name
            if display:
                effects.append({'name': spell_name, 'description': description, 'display': display})

        armor_display = ''
        if isinstance(armor, dict):
            armor_display = _localized_text(armor.get('display'))
            if not armor_display and armor.get('value') is not None:
                armor_display = str(armor.get('value'))

        durability_display = ''
        if isinstance(durability, dict):
            durability_display = _localized_text(durability.get('display'))
            dcur, dmax = durability.get('value'), durability.get('max')
            if not durability_display and dcur is not None and dmax is not None:
                durability_display = f'Haltbarkeit {dcur} / {dmax}'

        weapon = item.get('weapon') or {}
        weapon_lines = []
        if isinstance(weapon, dict):
            damage = weapon.get('damage') or {}
            if isinstance(damage, dict):
                dmin, dmax = damage.get('min_value'), damage.get('max_value')
                if dmin is not None and dmax is not None:
                    weapon_lines.append(f'{dmin}–{dmax} Schaden')
                elif _localized_text(damage.get('display_string') or damage.get('display')):
                    weapon_lines.append(_localized_text(damage.get('display_string') or damage.get('display')))
            speed = weapon.get('attack_speed') or weapon.get('speed')
            if isinstance(speed, dict):
                speed = speed.get('value') or speed.get('display_string')
            if speed not in (None, ''):
                weapon_lines.append(f'Tempo {speed}')
            dps = weapon.get('dps')
            if isinstance(dps, dict):
                dps = dps.get('value') or dps.get('display_string')
            if dps not in (None, ''):
                weapon_lines.append(f'{dps} Schaden pro Sekunde')

        item_set = item.get('set') or {}
        set_name = ''
        set_effects = []
        if isinstance(item_set, dict):
            set_name = _localized_text(item_set.get('item_set') or item_set.get('name'))
            for effect in item_set.get('effects') or []:
                text = _localized_text(effect.get('display_string') if isinstance(effect, dict) else effect) or _localized_text(effect)
                if text:
                    set_effects.append({'display': text, 'requiredCount': effect.get('required_count') if isinstance(effect, dict) else None})

        transmog = item.get('transmog') or {}
        transmog_name = _localized_text(transmog.get('display_string') if isinstance(transmog, dict) else '') or _localized_text(transmog)
        context = item.get('context')
        if isinstance(context, dict):
            context = _localized_text(context)

        out.append({
            'slotType': slot.get('type') if isinstance(slot, dict) else '',
            'slotName': _localized_text(slot),
            'itemId': item_ref.get('id') if isinstance(item_ref, dict) else None,
            'name': _localized_text(item.get('name')),
            'qualityType': quality.get('type') if isinstance(quality, dict) else '',
            'qualityName': _localized_text(quality),
            'itemLevel': level.get('value') if isinstance(level, dict) else None,
            'inventoryType': _localized_text(inv),
            'subclassName': _localized_text(item.get('item_subclass')),
            'binding': _localized_text(item.get('binding')),
            'uniqueEquipped': _localized_text(item.get('unique_equipped')),
            'stats': stats,
            'enchantments': enchants,
            'sockets': sockets,
            'effects': effects,
            'armorDisplay': armor_display,
            'durabilityDisplay': durability_display,
            'requiredLevel': req_level.get('value') if isinstance(req_level, dict) else None,
            'weaponLines': weapon_lines,
            'setName': set_name,
            'setEffects': set_effects,
            'transmog': transmog_name,
            'context': context or '',
            'bonusIds': [int(x) for x in item.get('bonus_list') or [] if str(x).isdigit()],
            'modifiedAppearanceId': item.get('modified_appearance_id'),
            'fullTooltip': False,
        })
    return out


def _blizzard_profile_get(region, path_realm, path_name, endpoint, token, locale='en_US'):
    params = urllib.parse.urlencode({'namespace': f'profile-{region}', 'locale': locale})
    url = f'https://{region}.api.blizzard.com/profile/wow/character/{path_realm}/{path_name}/{endpoint}?{params}'
    req = urllib.request.Request(url, headers={
        'Authorization': 'Bearer ' + token,
        'Accept': 'application/json',
        'User-Agent': USER_AGENT,
    })
    try:
        data, _, _ = fetch_json_request(req, timeout=20)
    except urllib.error.HTTPError as e:
        if e.code == 401:
            token = blizzard_access_token(force=True)
            req.headers['Authorization'] = 'Bearer ' + token
            data, _, _ = fetch_json_request(req, timeout=20)
        else:
            raise
    return data, url


def _combat_stat_mode(character_class='', spec=''):
    cls = str(character_class or '').strip().lower()
    sp = str(spec or '').strip().lower()
    if 'hunter' in cls or 'jäger' in cls or 'jaeger' in cls:
        return 'ranged'
    spell_specs = ('arcane','fire','frost','holy','discipline','shadow','restoration','balance','elemental','mistweaver','affliction','demonology','destruction','devastation','preservation','augmentation',
                   'arkan','feuer','frost','heilig','disziplin','schatten','wiederherstellung','gleichgewicht','elementar','nebelwirker','gebrechen','dämonologie','daemonologie','zerstörung','zerstoerung','verheerung','bewahrung','verstärkung','verstaerkung')
    if any(x in sp for x in spell_specs):
        return 'spell'
    if any(x in cls for x in ('mage','magier','priest','priester','warlock','hexenmeister','evoker','rufer')):
        return 'spell'
    return 'melee'


def normalize_blizzard_stats(data, character_class='', spec=''):
    mode = _combat_stat_mode(character_class, spec)
    crit = _number(data, f'{mode}_crit', 'value')
    haste = _number(data, f'{mode}_haste', 'value')
    # Defensive fallback if a specialization/provider omits the preferred combat bucket.
    if crit is None:
        crit = next((v for v in (_number(data, 'melee_crit', 'value'), _number(data, 'ranged_crit', 'value'), _number(data, 'spell_crit', 'value')) if v is not None), None)
    if haste is None:
        haste = next((v for v in (_number(data, 'melee_haste', 'value'), _number(data, 'ranged_haste', 'value'), _number(data, 'spell_haste', 'value')) if v is not None), None)
    mastery = _number(data, 'mastery', 'value')
    versatility = _number(data, 'versatility_damage_done_bonus')
    lifesteal = _number(data, 'lifesteal', 'rating_bonus')
    avoidance = _number(data, 'avoidance', 'rating_bonus')
    speed = _number(data, 'speed', 'rating_bonus')
    return {
        'crit': crit, 'haste': haste, 'mastery': mastery, 'versatility': versatility,
        'leech': lifesteal, 'avoidance': avoidance, 'speed': speed,
    }


def fetch_blizzard_character_stats(region, realm, name, character_class='', spec=''):
    region = str(region or 'eu').strip().lower()
    if region not in {'eu', 'us', 'kr', 'tw'}:
        region = 'eu'
    realm = str(realm or '').strip().lower()
    name = str(name or '').strip().lower()
    if not realm or not name:
        raise ValueError('Realm oder Charaktername fehlt')
    token = blizzard_access_token()
    path_realm = urllib.parse.quote(realm, safe='-')
    path_name = urllib.parse.quote(name, safe='-')
    # Request statistics plus equipment. Equipment is deliberately requested in en_US so
    # enchant/gem stat strings can be parsed consistently independent of dashboard language.
    data, stats_url = _blizzard_profile_get(region, path_realm, path_name, 'statistics', token, locale='en_US')
    equipment, equipment_url = _blizzard_profile_get(region, path_realm, path_name, 'equipment', token, locale='en_US')
    stats = normalize_blizzard_stats(data, character_class, spec)
    missing = [k for k, v in stats.items() if v is None]
    if missing:
        raise RuntimeError('Blizzard-Antwort ohne vollstaendige Werte: ' + ', '.join(missing))
    correction = _apply_missing_equipment_bonuses(data, stats, equipment, character_class, spec)
    return correction['stats'], stats_url, _combat_stat_mode(character_class, spec), correction, equipment_url, _equipment_tooltip_details(equipment)



def fetch_blizzard_character_media(region, realm, name, locale='de_DE'):
    region = str(region or 'eu').strip().lower()
    if region not in {'eu', 'us', 'kr', 'tw'}:
        region = 'eu'
    realm = str(realm or '').strip().lower()
    name = str(name or '').strip().lower()
    if not realm or not name:
        raise ValueError('Realm oder Charaktername fehlt')
    key = (region, realm, name, locale)
    cached = _cache_get(CHARACTER_MEDIA_CACHE, key, 300)
    if cached is not None:
        return cached
    token = blizzard_access_token()
    path_realm = urllib.parse.quote(realm, safe='-')
    path_name = urllib.parse.quote(name, safe='-')
    media, endpoint = _blizzard_profile_get(region, path_realm, path_name, 'character-media', token, locale=locale)
    assets = []
    for asset in media.get('assets') or []:
        if not isinstance(asset, dict):
            continue
        key_name = str(asset.get('key') or '').strip().lower()
        value = str(asset.get('value') or '').strip()
        if value:
            assets.append({'key': key_name, 'value': value})
    # Prefer the transparent full-body render, then the full render, inset and avatar.
    priority = {'main-raw': 0, 'main': 1, 'inset': 2, 'avatar': 3}
    assets.sort(key=lambda x: priority.get(x.get('key'), 9))
    return _cache_put(CHARACTER_MEDIA_CACHE, key, ({'assets': assets}, endpoint))

def dashboard_data():
    s = DASHBOARD.read_text(encoding='utf-8')
    marker = 'window.WOW_DASHBOARD_DATA = '
    pos = s.find(marker)
    if pos < 0:
        raise RuntimeError('Dashboard-Datenblock nicht gefunden')
    tail = s[pos + len(marker):].lstrip()
    obj, _ = json.JSONDecoder().raw_decode(tail)
    return obj


def decode_keystone(import_string, spec_id):
    m = re.search(r'KeystoneLoot:v3,([A-Za-z0-9+/=_-]+)', str(import_string))
    if not m:
        raise RuntimeError('KeystoneLoot-v3-Importstring fehlt')
    token = m.group(1).replace('-', '+').replace('_', '/')
    token += '=' * ((4 - len(token) % 4) % 4)
    packed = base64.b64decode(token)
    decoded = zlib.decompress(packed).decode('utf-8')
    obj = json.loads(decoded)
    items = obj.get(str(spec_id))
    if not isinstance(items, list):
        items = next((v for v in obj.values() if isinstance(v, list)), None)
    if not isinstance(items, list):
        raise RuntimeError('Keine BiS-Daten im KeystoneLoot-Import gefunden')
    items = [dict(x) for x in items]
    if str(spec_id) == '66' and isinstance(obj.get('70'), list) and obj['70']:
        extra = dict(obj['70'][0])
        extra['slot'] = 'trinket1'
        items.append(extra)
    return items



DASHBOARD_SLOT_TYPES = {
    'head': 'HEAD', 'neck': 'NECK', 'shoulder': 'SHOULDER', 'back': 'BACK', 'chest': 'CHEST',
    'wrist': 'WRIST', 'hands': 'HANDS', 'waist': 'WAIST', 'legs': 'LEGS', 'feet': 'FEET',
    'finger1': 'FINGER_1', 'finger2': 'FINGER_2', 'trinket1': 'TRINKET_1', 'trinket2': 'TRINKET_2',
    'mainhand': 'MAIN_HAND', 'offhand': 'OFF_HAND',
}


def _cache_get(store, key, ttl):
    with API_CACHE_LOCK:
        entry = store.get(key)
        if entry and time.time() - float(entry[0]) <= ttl:
            return entry[1]
        if entry:
            store.pop(key, None)
    return None


def _cache_put(store, key, value):
    with API_CACHE_LOCK:
        store[key] = (time.time(), value)
    return value


def _localized_text(value):
    if value is None:
        return ''
    if isinstance(value, str):
        return value.strip()
    if isinstance(value, (int, float)):
        return str(value)
    if isinstance(value, dict):
        for key in ('display_string', 'name', 'description', 'text'):
            text = _localized_text(value.get(key))
            if text:
                return text
        for key in ('spell', 'item', 'display'):
            text = _localized_text(value.get(key))
            if text:
                return text
    if isinstance(value, list):
        for part in value:
            text = _localized_text(part)
            if text:
                return text
    return ''


def _blizzard_game_data_get(region, endpoint, token, locale='de_DE'):
    params = urllib.parse.urlencode({'namespace': f'static-{region}', 'locale': locale})
    url = f'https://{region}.api.blizzard.com/data/wow/{endpoint}?{params}'
    req = urllib.request.Request(url, headers={
        'Authorization': 'Bearer ' + token,
        'Accept': 'application/json',
        'User-Agent': USER_AGENT,
    })
    try:
        data, _, _ = fetch_json_request(req, timeout=20)
    except urllib.error.HTTPError as e:
        if e.code == 401:
            token = blizzard_access_token(force=True)
            req.headers['Authorization'] = 'Bearer ' + token
            data, _, _ = fetch_json_request(req, timeout=20)
        else:
            raise
    return data, url


def fetch_blizzard_equipment(region, realm, name, locale='de_DE'):
    region = str(region or 'eu').strip().lower()
    if region not in {'eu', 'us', 'kr', 'tw'}:
        region = 'eu'
    realm = str(realm or '').strip().lower()
    name = str(name or '').strip().lower()
    if not realm or not name:
        raise ValueError('Realm oder Charaktername fehlt')
    key = (region, realm, name, locale)
    cached = _cache_get(EQUIPMENT_CACHE, key, 90)
    if cached is not None:
        return cached
    token = blizzard_access_token()
    path_realm = urllib.parse.quote(realm, safe='-')
    path_name = urllib.parse.quote(name, safe='-')
    equipment, endpoint = _blizzard_profile_get(region, path_realm, path_name, 'equipment', token, locale=locale)
    return _cache_put(EQUIPMENT_CACHE, key, (equipment, endpoint))


def _stat_rows_from_preview(preview):
    rows = []
    for st in (preview or {}).get('stats') or []:
        typ = st.get('type') or {}
        display = st.get('display') or st.get('display_string') or {}
        rows.append({
            'type': typ.get('type') if isinstance(typ, dict) else str(typ or ''),
            'name': typ.get('name') if isinstance(typ, dict) else '',
            'value': st.get('value'),
            'display': _localized_text(display),
        })
    return rows


def _effects_from_preview(preview):
    effects = []
    for sp in (preview or {}).get('spells') or []:
        spell = sp.get('spell') or {}
        effects.append({
            'name': _localized_text(spell) or _localized_text(sp.get('name')),
            'description': _localized_text(sp.get('description')),
            'display': _localized_text(sp.get('description')) or _localized_text(spell),
        })
    return [x for x in effects if x.get('display')]


def _merge_item_game_data(detail, item_data):
    if not isinstance(item_data, dict):
        return detail
    preview = item_data.get('preview_item') or item_data
    detail = dict(detail or {})
    detail['name'] = detail.get('name') or _localized_text(preview.get('name')) or _localized_text(item_data.get('name'))
    quality = preview.get('quality') or item_data.get('quality') or {}
    detail['qualityType'] = detail.get('qualityType') or (quality.get('type') if isinstance(quality, dict) else '')
    detail['qualityName'] = detail.get('qualityName') or _localized_text(quality)
    inv = preview.get('inventory_type') or item_data.get('inventory_type') or {}
    detail['inventoryType'] = detail.get('inventoryType') or _localized_text(inv)
    subclass = preview.get('item_subclass') or item_data.get('item_subclass') or {}
    detail['subclassName'] = detail.get('subclassName') or _localized_text(subclass)
    binding = preview.get('binding') or item_data.get('binding') or {}
    detail['binding'] = detail.get('binding') or _localized_text(binding)
    unique = preview.get('unique_equipped') or item_data.get('unique_equipped') or ''
    detail['uniqueEquipped'] = detail.get('uniqueEquipped') or _localized_text(unique)
    level = preview.get('level') or {}
    if detail.get('itemLevel') is None:
        detail['itemLevel'] = level.get('value') if isinstance(level, dict) else item_data.get('level')
    req = preview.get('requirements') or {}
    req_level = req.get('level') if isinstance(req, dict) else {}
    if detail.get('requiredLevel') is None and isinstance(req_level, dict):
        detail['requiredLevel'] = req_level.get('value')
    if not detail.get('stats'):
        detail['stats'] = _stat_rows_from_preview(preview)
    if not detail.get('effects'):
        detail['effects'] = _effects_from_preview(preview)
    if not detail.get('description'):
        detail['description'] = _localized_text(preview.get('description') or item_data.get('description'))
    armor = preview.get('armor') or {}
    if not detail.get('armorDisplay') and isinstance(armor, dict):
        detail['armorDisplay'] = _localized_text(armor.get('display')) or _localized_text(armor.get('value'))
    durability = preview.get('durability') or {}
    if not detail.get('durabilityDisplay') and isinstance(durability, dict):
        detail['durabilityDisplay'] = _localized_text(durability.get('display'))
    weapon = preview.get('weapon') or item_data.get('weapon') or {}
    if not detail.get('weaponLines') and isinstance(weapon, dict):
        weapon_lines = []
        damage = weapon.get('damage') or {}
        if isinstance(damage, dict):
            dmin, dmax = damage.get('min_value'), damage.get('max_value')
            if dmin is not None and dmax is not None:
                weapon_lines.append(f'{dmin}–{dmax} Schaden')
        speed = weapon.get('attack_speed') or weapon.get('speed')
        if isinstance(speed, dict):
            speed = speed.get('value') or speed.get('display_string')
        if speed not in (None, ''):
            weapon_lines.append(f'Tempo {speed}')
        dps = weapon.get('dps')
        if isinstance(dps, dict):
            dps = dps.get('value') or dps.get('display_string')
        if dps not in (None, ''):
            weapon_lines.append(f'{dps} Schaden pro Sekunde')
        detail['weaponLines'] = weapon_lines
    item_set = preview.get('set') or item_data.get('set') or {}
    if isinstance(item_set, dict):
        detail['setName'] = detail.get('setName') or _localized_text(item_set.get('item_set') or item_set.get('name'))
        set_effects = []
        for effect in item_set.get('effects') or []:
            text = _localized_text(effect.get('display_string') or effect.get('description') or effect)
            if text:
                set_effects.append({'display': text})
        if set_effects:
            detail['setEffects'] = set_effects
    if not detail.get('bonusIds'):
        detail['bonusIds'] = [int(x) for x in preview.get('bonus_list') or [] if str(x).isdigit()]
    detail['fullTooltip'] = True
    return detail


def fetch_item_game_data(region, item_id):
    item_id = int(item_id or 0)
    if item_id <= 0:
        return None
    key = (region, item_id)
    cached = _cache_get(ITEM_DATA_CACHE, key, 21600)
    if cached is not None:
        return cached
    token = blizzard_access_token()
    data, _ = _blizzard_game_data_get(region, f'item/{item_id}', token, locale='de_DE')
    return _cache_put(ITEM_DATA_CACHE, key, data)


def fetch_item_media(region, item_id):
    item_id = int(item_id or 0)
    if item_id <= 0:
        return None
    region = str(region or 'eu').strip().lower()
    if region not in {'eu', 'us', 'kr', 'tw'}:
        region = 'eu'
    key = (region, item_id)
    cached = _cache_get(ITEM_MEDIA_CACHE, key, 21600)
    if cached is not None:
        return cached
    token = blizzard_access_token()
    data, _ = _blizzard_game_data_get(region, f'media/item/{item_id}', token, locale='de_DE')
    return _cache_put(ITEM_MEDIA_CACHE, key, data)


def _find_equipped_item(equipment, dashboard_slot='', item_id=0):
    target_type = DASHBOARD_SLOT_TYPES.get(str(dashboard_slot or '').lower(), '')
    item_id = int(item_id or 0)
    for item in (equipment or {}).get('equipped_items') or []:
        slot = item.get('slot') or {}
        ref = item.get('item') or {}
        slot_type = str(slot.get('type') if isinstance(slot, dict) else '').upper()
        iid = int(ref.get('id') or 0) if isinstance(ref, dict) else 0
        if target_type and slot_type == target_type:
            return item
        if item_id and iid == item_id:
            return item
    return None


def _image_host_allowed(host):
    host = str(host or '').lower().split(':', 1)[0]
    return host == 'render.worldofwarcraft.com' or host.endswith('.worldofwarcraft.com') or host.endswith('.raider.io') or host.endswith('.raiderio.net')



from flask import Flask, request, jsonify, Response, send_file
app = Flask(__name__)


def _json(data, status=200):
    return jsonify(data), status


def _q(name, default=''):
    return request.args.get(name, default)


def _configured():
    cfg = load_blizzard_config()
    return bool(cfg.get('client_id') and cfg.get('client_secret'))

@app.get('/')
def root_page():
    return send_file(DASHBOARD)

@app.get('/api/health')
def api_health():
    return _json({'ok': True, 'service': 'wow-bis-dashboard-helper', 'version': '2026-10-25-web', 'mode': 'web', 'host': request.host})

@app.get('/api/blizzard-config-status')
def api_blizzard_config_status():
    cfg = load_blizzard_config()
    return _json({'ok': True, 'configured': bool(cfg.get('client_id') and cfg.get('client_secret')), 'source': 'Server-Umgebungsvariablen' if _configured() else ''})

@app.post('/api/blizzard-config')
def api_blizzard_config_blocked():
    return _json({'ok': False, 'error': 'In der Webversion werden Blizzard-Zugangsdaten ausschließlich serverseitig als Umgebungsvariablen gesetzt.'}, 403)

@app.get('/api/character-media')
def api_character_media():
    region, realm, name = _q('region','eu'), _q('realm'), _q('name')
    if not _configured():
        return _json({'ok': False, 'setupRequired': True, 'error': 'Blizzard API serverseitig noch nicht eingerichtet'})
    try:
        media, endpoint = fetch_blizzard_character_media(region, realm, name, locale='de_DE')
        return _json({'ok': True, 'mediaEndpoint': endpoint, 'assets': media.get('assets') or []})
    except Exception as e:
        return _json({'ok': False, 'error': 'Ganzkörper-Render konnte nicht geladen werden', 'detail': str(e)}, 502)

@app.get('/api/equipment-details')
def api_equipment_details():
    region, realm, name = _q('region','eu'), _q('realm'), _q('name')
    if not _configured():
        return _json({'ok': False, 'setupRequired': True, 'error': 'Blizzard API serverseitig noch nicht eingerichtet'})
    try:
        equipment, endpoint = fetch_blizzard_equipment(region, realm, name, locale='de_DE')
        return _json({'ok': True, 'equipmentEndpoint': endpoint, 'equipmentDetails': _equipment_tooltip_details(equipment)})
    except Exception as e:
        return _json({'ok': False, 'error': 'Ausrüstungsdetails konnten nicht geladen werden', 'detail': str(e)}, 502)

@app.get('/api/item-tooltip')
def api_item_tooltip():
    region, realm, name, slot = _q('region','eu').lower(), _q('realm'), _q('name'), _q('slot')
    try: item_id = int(_q('itemId','0') or 0)
    except ValueError: item_id = 0
    if not _configured():
        return _json({'ok': False, 'setupRequired': True, 'error': 'Blizzard API serverseitig noch nicht eingerichtet'})
    try:
        equipment, endpoint = fetch_blizzard_equipment(region, realm, name, locale='de_DE')
        item = _find_equipped_item(equipment, slot, item_id)
        if not item:
            return _json({'ok': False, 'error': 'Angelegter Gegenstand für diesen Slot wurde nicht gefunden'}, 404)
        details = _equipment_tooltip_details({'equipped_items': [item]})
        detail = details[0] if details else {}
        real_id = int(detail.get('itemId') or item_id or 0)
        try:
            detail = _merge_item_game_data(detail, fetch_item_game_data(region, real_id))
        except Exception as enrich_error:
            detail['enrichmentWarning'] = str(enrich_error)
        detail['fullTooltip'] = True
        detail['dataSources'] = ['Blizzard Character Equipment', 'Blizzard Item API']
        return _json({'ok': True, 'equipmentEndpoint': endpoint, 'detail': detail})
    except Exception as e:
        return _json({'ok': False, 'error': 'Vollständiger Item-Tooltip konnte nicht geladen werden', 'detail': str(e)}, 502)

@app.get('/api/item-media')
def api_item_media():
    region = _q('region','eu').lower()
    try: item_id = int(_q('itemId','0') or 0)
    except ValueError: item_id = 0
    if item_id <= 0:
        return _json({'ok': False, 'error': 'Item-ID fehlt'}, 400)
    if not _configured():
        return _json({'ok': False, 'setupRequired': True, 'error': 'Blizzard API serverseitig noch nicht eingerichtet'})
    try:
        media = fetch_item_media(region, item_id) or {}
        assets = media.get('assets') or []
        icon_url = ''
        for asset in assets:
            if str(asset.get('key') or '').lower() in {'icon','image'} and asset.get('value'):
                icon_url = str(asset.get('value')); break
        if not icon_url:
            for asset in assets:
                if asset.get('value'):
                    icon_url = str(asset.get('value')); break
        return _json({'ok': True, 'itemId': item_id, 'iconUrl': icon_url})
    except Exception as e:
        return _json({'ok': False, 'error': 'Item-Icon konnte nicht geladen werden', 'detail': str(e)}, 502)

@app.get('/api/render-image')
def api_render_image():
    url = _q('url')
    try:
        parsed_url = urllib.parse.urlparse(url)
        if parsed_url.scheme != 'https' or not _image_host_allowed(parsed_url.hostname):
            return _json({'ok': False, 'error': 'Bildquelle nicht erlaubt'}, 403)
        cached = _cache_get(REMOTE_IMAGE_CACHE, url, 1800)
        if cached is None:
            req = urllib.request.Request(url, headers={'User-Agent': USER_AGENT, 'Accept': 'image/avif,image/webp,image/png,image/jpeg,*/*'})
            with urllib.request.urlopen(req, timeout=25) as response:
                raw = response.read(); ctype = response.headers.get_content_type() or 'image/png'
            if not str(ctype).startswith('image/') or len(raw) > 12 * 1024 * 1024:
                return _json({'ok': False, 'error': 'Ungültige Bildantwort'}, 502)
            cached = _cache_put(REMOTE_IMAGE_CACHE, url, (raw, ctype))
        raw, ctype = cached
        return Response(raw, status=200, content_type=ctype, headers={'Cache-Control':'public, max-age=1800'})
    except Exception as e:
        return _json({'ok': False, 'error': 'Charakterbild konnte nicht geladen werden', 'detail': str(e)}, 502)

@app.get('/api/character-stats')
def api_character_stats():
    region, realm, name = _q('region','eu'), _q('realm'), _q('name')
    character_class, spec = _q('class'), _q('spec')
    if not _configured():
        return _json({'ok': False, 'setupRequired': True, 'error': 'Blizzard API serverseitig noch nicht eingerichtet', 'detail': 'Setze BLIZZARD_CLIENT_ID und BLIZZARD_CLIENT_SECRET in der Hosting-Umgebung.'})
    try:
        stats, api_url, mode, correction, equipment_url, equipment_details = fetch_blizzard_character_stats(region, realm, name, character_class, spec)
        api_stats = dict(stats)
        armory_stats, armory_source, armory_url = fetch_public_armory_stats(region, realm, name)
        stats, reconciled = reconcile_display_stats(stats, armory_stats)
        applied = {k:v for k,v in correction.get('appliedRatings',{}).items() if float(v or 0)>0}
        applied_pct = {k:v for k,v in correction.get('appliedPercent',{}).items() if float(v or 0)>0}
        addon_note = ' · inkl. fehlender Verzauberungs-/Edelsteinboni' if applied else ' · Verzauberungen/Edelsteine geprüft'
        sources = {k:'Automatisch · Blizzard API · Character Statistics + Equipment' for k in stats}
        for k,v in reconciled.items():
            if v.get('fallback'):
                sources[k]='Automatisch · Blizzard Charakterseite · Fallback'
        method='Blizzard API · Character Statistics + Equipment'+addon_note
        if reconciled:
            method += ' · öffentliche Charakterseite nur zur Plausibilitätsprüfung'
        return _json({'ok': True, 'stats': stats, 'statSources': sources, 'method':method, 'source':'Blizzard Character Statistics + Equipment API', 'confidence':'hoch', 'verifiedBy':3 if armory_stats else 2, 'combatMode':mode, 'apiEndpoint':api_url, 'equipmentEndpoint':equipment_url, 'armoryEndpoint':armory_url, 'armorySource':armory_source, 'apiRawStats':api_stats, 'armoryStats':armory_stats, 'reconciledStats':reconciled, 'equipmentEnhancements':{'enchantCount':correction.get('enchantCount',0),'gemCount':correction.get('gemCount',0),'ratings':correction.get('enhancementRatings',{}),'appliedRatings':applied,'appliedPercent':applied_pct,'inclusion':correction.get('inclusion',{}),'details':correction.get('details',[])}, 'equipmentDetails':equipment_details})
    except urllib.error.HTTPError as e:
        detail=f'HTTP {e.code}'
        if e.code==404: detail += ' · Charakter/Realm nicht gefunden oder Profil noch nicht aktualisiert'
        elif e.code in (401,403): detail += ' · Battle.net API-Zugang oder Berechtigung prüfen'
        return _json({'ok':False,'error':'Blizzard Character Statistics konnten nicht geladen werden','detail':detail},502)
    except Exception as e:
        return _json({'ok':False,'error':'Blizzard Character Statistics konnten nicht geladen werden','detail':str(e)},502)

@app.get('/api/raiderio')
def _raiderio_all_known_runs(data):
    """Combine every season-run list exposed by Raider.IO's public character API."""
    if not isinstance(data, dict):
        return []
    fields = (
        'mythic_plus_recent_runs',
        'mythic_plus_best_runs',
        'mythic_plus_alternate_runs',
        'mythic_plus_highest_level_runs',
        'mythic_plus_weekly_highest_level_runs',
        'mythic_plus_previous_weekly_highest_level_runs',
    )
    out = []
    seen = set()
    for field in fields:
        rows = data.get(field) or []
        if not isinstance(rows, list):
            continue
        for run in rows:
            if not isinstance(run, dict):
                continue
            key = (
                run.get('url') or '',
                run.get('run_id') or run.get('id') or '',
                run.get('dungeon') or run.get('short_name') or '',
                run.get('mythic_level') or '',
                run.get('completed_at') or '',
            )
            if key in seen:
                continue
            seen.add(key)
            out.append(run)
    out.sort(key=lambda r: str(r.get('completed_at') or ''), reverse=True)
    return out


def api_raiderio():
    region, realm, name = _q('region','eu'), _q('realm'), _q('name')
    if not realm or not name:
        return _json({'error':'Realm oder Charaktername fehlt'},400)
    params = urllib.parse.urlencode({'region':region,'realm':realm,'name':name,'fields':RIO_FIELDS})
    try:
        data, _, _ = fetch_json('https://raider.io/api/v1/characters/profile?'+params)
        all_runs = _raiderio_all_known_runs(data)
        if all_runs:
            data['mythic_plus_all_known_runs'] = all_runs
            # Keep the existing frontend compatible: it already renders the
            # recent-runs collection. Feed it the complete deduplicated season
            # set available from Raider.IO instead of only the tiny recent list.
            data['mythic_plus_recent_runs'] = all_runs
            data['mythic_plus_all_known_runs_count'] = len(all_runs)
        return _json(data)
    except urllib.error.HTTPError as e:
        detail = ''
        try:
            detail = e.read().decode('utf-8', errors='replace').strip()
        except Exception:
            pass
        if e.code == 400:
            return _json({'error':'Raider.IO hat die Anfrage abgelehnt','detail':detail or str(e)},400)
        if e.code == 404:
            return _json({'error':'Charakter wurde bei Raider.IO nicht gefunden','detail':detail or str(e)},404)
        if e.code == 429:
            return _json({'error':'Raider.IO Rate-Limit erreicht. Bitte kurz erneut versuchen.','detail':detail or str(e)},429)
        return _json({'error':'Raider.IO konnte nicht geladen werden','detail':detail or str(e)},502)
    except urllib.error.URLError as e:
        return _json({'error':'Raider.IO ist derzeit nicht erreichbar','detail':str(e)},502)
    except Exception as e:
        return _json({'error':'Raider.IO konnte nicht geladen werden','detail':str(e)},502)

@app.get('/downloads/Waschi_WoW_BiS_Tool.zip')
@app.get('/api/download-bis-tool')
def api_download_bis_tool():
    """Erzeugt das Downloadpaket immer aus demselben Repository-Stand wie die Online-Version."""
    try:
        html_path = DASHBOARD if DASHBOARD.exists() else (ROOT / 'public' / 'index.html')
        if html_path.exists():
            html = html_path.read_text(encoding='utf-8')
        else:
            parts = sorted((ROOT / 'chunks').glob('index.part*.txt'))
            if not parts:
                return _json({'ok': False, 'error': 'BiS-Tool-Dateien wurden nicht gefunden'}, 404)
            html = ''.join(p.read_text(encoding='utf-8') for p in parts)

        payload = io.BytesIO()
        commit = os.environ.get('VERCEL_GIT_COMMIT_SHA', 'aktueller-stand')
        with zipfile.ZipFile(payload, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=9) as z:
            z.writestr('Waschi_WoW_BiS_Tool/index.html', html)
            for rel in ('api/index.py', 'requirements.txt', 'vercel.json', 'README_WEB.md', 'Dockerfile', '.env.example'):
                p = ROOT / rel
                if p.exists():
                    z.write(p, 'Waschi_WoW_BiS_Tool/' + rel)
            z.writestr('Waschi_WoW_BiS_Tool/VERSION.txt', f'Online- und Downloadstand: {commit}\n')
        payload.seek(0)
        return Response(
            payload.getvalue(),
            status=200,
            content_type='application/zip',
            headers={
                'Content-Disposition': 'attachment; filename="Waschi_WoW_BiS_Tool.zip"',
                'Cache-Control': 'public, max-age=300, must-revalidate'
            }
        )
    except Exception as e:
        return _json({'ok': False, 'error': 'Downloadpaket konnte nicht erstellt werden', 'detail': str(e)}, 500)


@app.get('/api/bis-refresh')
def api_bis_refresh():
    key = _q('profile')
    try:
        data = dashboard_data()
        profile = next((p for p in data.get('profiles',[]) if p.get('key')==key),None)
        if not profile: return _json({'ok':False,'error':'Unbekanntes Profil'},404)
        cfg = profile.get('bisUpdate') or {}; cls=cfg.get('classSlug'); spec=cfg.get('specSlug'); spec_id=cfg.get('specId')
        if not cls or not spec or not spec_id: return _json({'ok':False,'error':'Für dieses Profil fehlen KeystoneLoot-Importdaten'},400)
        view=_q('view','mythicplus').lower(); view=view if view in {'mythicplus','overall','raid'} else 'mythicplus'
        api=f'https://keystoneloot.io/api/import/{urllib.parse.quote(str(cls))}/{urllib.parse.quote(str(spec))}?view={urllib.parse.quote(view)}'
        payload, headers, _ = fetch_json(api)
        if payload.get('error'): return _json({'ok':False,'error':payload.get('error'),'available':payload.get('available')},502)
        items=decode_keystone(payload.get('string'),spec_id)
        base_url=cfg.get('url') or f'https://keystoneloot.io/de/classes/{cls}/{spec}/mythic-plus'
        source_url=base_url.replace('/mythic-plus','/raid' if view=='raid' else '') if view!='mythicplus' else base_url
        return _json({'ok':True,'items':items,'source':f'KeystoneLoot {view} API · Webserver','sourceUrl':source_url,'apiUrl':api,'fetchedAt':payload.get('updated') or headers.get('x-keystoneloot-updated') or ''})
    except Exception as e:
        return _json({'ok':False,'error':'KeystoneLoot-Abruf fehlgeschlagen','detail':str(e)},502)

# Vercel rewrite target: /api/index.py?route=<name>
@app.route('/api/index.py', methods=['GET','POST'])
def vercel_dispatch():
    route = request.args.get('route','')
    table = {
        'health': api_health,
        'blizzard-config-status': api_blizzard_config_status,
        'blizzard-config': api_blizzard_config_blocked,
        'character-media': api_character_media,
        'equipment-details': api_equipment_details,
        'item-tooltip': api_item_tooltip,
        'item-media': api_item_media,
        'render-image': api_render_image,
        'character-stats': api_character_stats,
        'raiderio': api_raiderio,
        'bis-refresh': api_bis_refresh,
        'download-bis-tool': api_download_bis_tool,
    }
    fn = table.get(route)
    return fn() if fn else _json({'ok':False,'error':'Unbekannter API-Endpunkt'},404)
