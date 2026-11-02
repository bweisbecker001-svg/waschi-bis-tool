<?php
declare(strict_types=1);

$config = require __DIR__ . '/../private/config.php';
$dataDir = __DIR__ . '/../private/data';
$contentFile = $dataDir . '/site-content.json';
$voiceFile = $dataDir . '/voice-state.json';
$cookieName = 'waschi_session';

if (!is_dir($dataDir)) @mkdir($dataDir, 0750, true);

function json_response(array $data, int $status = 200): never {
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}
function clean_value(mixed $value, int $limit = 2000): string {
    $value = preg_replace('/\s+/u', ' ', (string)($value ?? '')) ?? '';
    return mb_substr(trim($value), 0, $limit);
}
function b64url_encode(string $raw): string { return rtrim(strtr(base64_encode($raw), '+/', '-_'), '='); }
function b64url_decode(string $value): string|false {
    $pad = strlen($value) % 4;
    if ($pad) $value .= str_repeat('=', 4 - $pad);
    return base64_decode(strtr($value, '-_', '+/'), true);
}
function sign_payload(array $payload, string $secret): string {
    $raw = json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    return b64url_encode($raw) . '.' . b64url_encode(hash_hmac('sha256', $raw, $secret, true));
}
function verify_payload(?string $token, string $secret): ?array {
    try {
        if (!$token || !str_contains($token, '.')) return null;
        [$a,$b]=explode('.',$token,2); $raw=b64url_decode($a); $got=b64url_decode($b);
        if ($raw===false || $got===false) return null;
        if (!hash_equals(hash_hmac('sha256',$raw,$secret,true),$got)) return null;
        $data=json_decode($raw,true);
        if (!is_array($data) || (int)($data['exp']??0)<time()) return null;
        return $data;
    } catch (Throwable) { return null; }
}
function read_json_file(string $path, array $fallback=[]): array {
    if (!is_file($path)) return $fallback;
    $raw=@file_get_contents($path); if ($raw===false) return $fallback;
    $data=json_decode($raw,true); return is_array($data)?$data:$fallback;
}
function write_json_file(string $path, array $data): void {
    $dir=dirname($path); if (!is_dir($dir)) @mkdir($dir,0750,true);
    $tmp=$path.'.tmp.'.bin2hex(random_bytes(6)); $raw=json_encode($data,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES);
    if (@file_put_contents($tmp,$raw,LOCK_EX)===false) {
        @unlink($tmp); throw new RuntimeException('Daten konnten nicht gespeichert werden.');
    }
    if (!@rename($tmp,$path)) {
        if (@file_put_contents($path,$raw,LOCK_EX)===false) {
            @unlink($tmp); throw new RuntimeException('Daten konnten nicht gespeichert werden.');
        }
        @unlink($tmp);
    }
}
function load_content(string $contentFile, array $defaults): array {
    $data=read_json_file($contentFile,$defaults);
    $data['calendar']??=$defaults['calendar']??[];
    $data['news']??=$defaults['news']??[];
    $data['permissions']??=['calendarAdmins'=>$defaults['permissions']['calendarAdmins']??[]];
    return $data;
}
function save_content(string $contentFile,array $data): void { $data['updatedAt']=time(); write_json_file($contentFile,$data); }
function current_user(string $cookieName,string $secret): ?array { return verify_payload($_COOKIE[$cookieName]??null,$secret); }
function permissions(?array $user,array $content,array $config): array {
    $username=strtolower(trim((string)($user['username']??'')));
    $admins=array_values(array_filter(array_map(fn($v)=>strtolower(trim((string)$v)),$content['permissions']['calendarAdmins']??$config['calendar_admins_default'])));
    $canNews=$user!==null && $username===strtolower((string)$config['news_admin']);
    $canCalendar=$user!==null && ($canNews || in_array($username,$admins,true));
    return ['authenticated'=>$user!==null,'canNews'=>$canNews,'canCalendar'=>$canCalendar,'calendarAdmins'=>$admins];
}
function request_json(): array { $raw=file_get_contents('php://input'); $data=json_decode($raw?:'{}',true); return is_array($data)?$data:[]; }
function make_id(string $prefix,string $title=''): string { return $prefix.'-'.substr(hash('sha256',hrtime(true).':'.bin2hex(random_bytes(12)).':'.$title),0,16); }
function require_permission(string $kind,string $cookieName,string $secret,array &$content,array $config): array {
    $user=current_user($cookieName,$secret); $perms=permissions($user,$content,$config);
    if (!$user) json_response(['ok'=>false,'error'=>'Nicht angemeldet'],401);
    if ($kind==='news' && !$perms['canNews']) json_response(['ok'=>false,'error'=>'Nur Lentor (berndw) darf Aktuelles bearbeiten.'],403);
    if ($kind==='calendar' && !$perms['canCalendar']) json_response(['ok'=>false,'error'=>'Keine Kalender-Berechtigung.'],403);
    return [$user,$perms];
}
function discord_oauth_profile(string $code,array $config): array {
    $post=http_build_query(['client_id'=>$config['discord_client_id'],'client_secret'=>$config['discord_client_secret'],'grant_type'=>'authorization_code','code'=>$code,'redirect_uri'=>$config['discord_redirect_uri']]);
    $ctx=stream_context_create(['http'=>['method'=>'POST','header'=>"Content-Type: application/x-www-form-urlencoded\r\nUser-Agent: Waschi.fun\r\n",'content'=>$post,'timeout'=>20,'ignore_errors'=>true]]);
    $raw=@file_get_contents('https://discord.com/api/v10/oauth2/token',false,$ctx); $token=json_decode($raw?:'{}',true); $access=(string)($token['access_token']??'');
    if ($access==='') throw new RuntimeException('Discord Zugriffstoken fehlt');
    $ctx=stream_context_create(['http'=>['method'=>'GET','header'=>"Authorization: Bearer {$access}\r\nUser-Agent: Waschi.fun\r\n",'timeout'=>20]]);
    $raw=@file_get_contents('https://discord.com/api/v10/users/@me',false,$ctx); $profile=json_decode($raw?:'{}',true);
    if (!is_array($profile)||empty($profile['id'])) throw new RuntimeException('Discord-Profil konnte nicht geladen werden');
    return $profile;
}
function proxy_legacy(string $path,string $base): never {
    $url=rtrim($base,'/').$path; if (!empty($_SERVER['QUERY_STRING'])) $url.='?'.$_SERVER['QUERY_STRING'];
    $method=$_SERVER['REQUEST_METHOD']??'GET'; $opts=['http'=>['method'=>$method,'header'=>"User-Agent: Waschi.fun-STRATO\r\n",'timeout'=>30,'ignore_errors'=>true]];
    if (!in_array($method,['GET','HEAD'],true)) { $opts['http']['content']=file_get_contents('php://input'); $opts['http']['header'].="Content-Type: ".($_SERVER['CONTENT_TYPE']??'application/json')."\r\n"; }
    $ctx=stream_context_create($opts); $body=@file_get_contents($url,false,$ctx); $status=502;
    if (!empty($http_response_header[0])&&preg_match('/\s(\d{3})\s/',$http_response_header[0],$m)) $status=(int)$m[1];
    http_response_code($status); foreach($http_response_header??[] as $h) if (stripos($h,'Content-Type:')===0) header($h);
    if ($body!==false) echo $body; exit;
}

$defaults=read_json_file(__DIR__.'/../private/initial-content.json',['calendar'=>[],'news'=>[],'permissions'=>['calendarAdmins'=>$config['calendar_admins_default']],'updatedAt'=>time()]);
$content=load_content($contentFile,$defaults);
$path=parse_url($_SERVER['REQUEST_URI']??'/api/health',PHP_URL_PATH)?:'/api/health';
$method=strtoupper($_SERVER['REQUEST_METHOD']??'GET');
$secret=(string)$config['session_secret'];

if ($path==='/api/health'&&$method==='GET') json_response(['ok'=>true,'service'=>'waschi-strato-api']);

if ($path==='/api/discord-push'&&$method==='POST') {
    $given=$_SERVER['HTTP_X_WASCHI_VOICE_KEY']??'';
    if ($given===''||!hash_equals((string)$config['voice_push_secret'],$given)) json_response(['ok'=>false,'error'=>'Unauthorized'],401);
    $data=request_json(); if (!isset($data['updatedAt'],$data['channels'])) json_response(['ok'=>false,'error'=>'Ungültiger Voice-Snapshot'],400);
    $data['receivedAt']=time(); write_json_file($voiceFile,$data); json_response(['ok'=>true]);
}

if ($path==='/api/discord-online'&&$method==='GET') {
    $voice=read_json_file($voiceFile,[]); $updated=(int)($voice['updatedAt']??0); $fresh=$updated>0&&time()-$updated<=120;
    json_response(['ok'=>true,'source'=>'altare-gateway','server'=>(string)($voice['server']??'Waschi'),'online'=>null,'total'=>null,'members'=>[],'memberListAvailable'=>false,'voiceAvailable'=>$fresh,'voiceStale'=>$updated>0&&!$fresh,'voiceMembers'=>$fresh?(int)($voice['voiceMembers']??0):0,'voiceChannels'=>$fresh?($voice['channels']??[]):[],'voiceUpdatedAt'=>$updated?:null,'botAlwaysOn'=>true,'statusText'=>$fresh?'Voice-Kanäle live über den Waschi-Bot auf Altare':'Waschi-Bot auf Altare verbunden; Voice-Snapshot derzeit nicht aktuell']);
}

if ($path==='/api/site-auth/login'&&$method==='GET') {
    if ($config['discord_client_id']==='CHANGE_ME'||$config['discord_client_secret']==='CHANGE_ME') { header('Location: /calendar/?auth=setup',true,302); exit; }
    $next=(string)($_GET['next']??'/calendar/'); if (!str_starts_with($next,'/')) $next='/calendar/';
    $state=sign_payload(['next'=>$next,'exp'=>time()+600],$secret);
    $q=http_build_query(['client_id'=>$config['discord_client_id'],'response_type'=>'code','redirect_uri'=>$config['discord_redirect_uri'],'scope'=>'identify','state'=>$state]);
    header('Location: https://discord.com/oauth2/authorize?'.$q,true,302); exit;
}
if ($path==='/api/site-auth/callback'&&$method==='GET') {
    $state=verify_payload((string)($_GET['state']??''),$secret); if (!$state) { header('Location: /calendar/?auth=state',true,302); exit; }
    try {
        $p=discord_oauth_profile((string)($_GET['code']??''),$config);
        $session=['id'=>(string)($p['id']??''),'username'=>(string)($p['username']??''),'globalName'=>(string)($p['global_name']??''),'exp'=>time()+7*24*3600];
        setcookie($cookieName,sign_payload($session,$secret),['expires'=>time()+7*24*3600,'path'=>'/','secure'=>true,'httponly'=>true,'samesite'=>'Lax']);
        header('Location: '.($state['next']??'/calendar/'),true,302); exit;
    } catch (Throwable) { header('Location: /calendar/?auth=failed',true,302); exit; }
}
if ($path==='/api/site-auth/status'&&$method==='GET') {
    $user=current_user($cookieName,$secret); $perms=permissions($user,$content,$config);
    $pub=$user?['id'=>$user['id']??null,'username'=>$user['username']??null,'globalName'=>$user['globalName']??null]:null;
    json_response(array_merge(['ok'=>true,'configured'=>$config['discord_client_id']!=='CHANGE_ME'&&$config['discord_client_secret']!=='CHANGE_ME','user'=>$pub],$perms));
}
if ($path==='/api/site-auth/logout'&&$method==='POST') { setcookie($cookieName,'',['expires'=>time()-3600,'path'=>'/','secure'=>true,'httponly'=>true,'samesite'=>'Lax']); json_response(['ok'=>true]); }

if ($path==='/api/site-content'&&$method==='GET') {
    $news=array_values(array_filter($content['news']??[],fn($n)=>($n['published']??true)!==false));
    usort($news,fn($a,$b)=>strcmp((string)($b['date']??'').(string)($b['createdAt']??''),(string)($a['date']??'').(string)($a['createdAt']??'')));
    $calendar=array_values($content['calendar']??[]); usort($calendar,fn($a,$b)=>strcmp((string)($a['date']??'').(string)($a['time']??''),(string)($b['date']??'').(string)($b['time']??'')));
    json_response(['ok'=>true,'calendar'=>$calendar,'news'=>$news,'updatedAt'=>$content['updatedAt']??null]);
}
if ($path==='/api/site-calendar'&&$method==='POST') {
    [$user]=require_permission('calendar',$cookieName,$secret,$content,$config); $data=request_json(); $id=clean_value($data['id']??'',100); $rows=&$content['calendar']; $index=null;
    foreach($rows as $i=>$row) if($id!==''&&(string)($row['id']??'')===$id){$index=$i;break;}
    if($index===null){$rows[]=['id'=>make_id('event',(string)($data['title']??'')),'createdAt'=>time(),'createdBy'=>$user['username']??''];$index=array_key_last($rows);}
    $rows[$index]=array_merge($rows[$index],['title'=>clean_value($data['title']??'',160),'date'=>clean_value($data['date']??'',10),'endDate'=>clean_value($data['endDate']??'',10),'time'=>clean_value($data['time']??'',5),'endTime'=>clean_value($data['endTime']??'',5),'category'=>clean_value($data['category']??'waschi',30),'description'=>clean_value($data['description']??'',3000),'link'=>clean_value($data['link']??'',500),'updatedAt'=>time(),'updatedBy'=>$user['username']??'']);
    if($rows[$index]['title']===''||!preg_match('/^\d{4}-\d{2}-\d{2}$/',$rows[$index]['date'])) json_response(['ok'=>false,'error'=>'Titel und gültiges Datum sind erforderlich.'],400);
    save_content($contentFile,$content); json_response(['ok'=>true,'event'=>$rows[$index]]);
}
if ($path==='/api/site-calendar'&&$method==='DELETE') {
    require_permission('calendar',$cookieName,$secret,$content,$config); $id=clean_value($_GET['id']??'',100); $before=count($content['calendar']??[]);
    $content['calendar']=array_values(array_filter($content['calendar']??[],fn($x)=>(string)($x['id']??'')!==$id));
    if(count($content['calendar'])===$before) json_response(['ok'=>false,'error'=>'Termin nicht gefunden'],404);
    save_content($contentFile,$content); json_response(['ok'=>true]);
}
if ($path==='/api/site-news'&&$method==='POST') {
    [$user]=require_permission('news',$cookieName,$secret,$content,$config); $data=request_json(); $id=clean_value($data['id']??'',100); $rows=&$content['news']; $index=null;
    foreach($rows as $i=>$row) if($id!==''&&(string)($row['id']??'')===$id){$index=$i;break;}
    if($index===null){$rows[]=['id'=>make_id('news',(string)($data['title']??'')),'createdAt'=>time(),'createdBy'=>$user['username']??''];$index=array_key_last($rows);}
    $rows[$index]=array_merge($rows[$index],['title'=>clean_value($data['title']??'',180),'date'=>clean_value($data['date']??'',10),'summary'=>clean_value($data['summary']??'',700),'body'=>clean_value($data['body']??'',8000),'published'=>(bool)($data['published']??true),'updatedAt'=>time(),'updatedBy'=>$user['username']??'']);
    if($rows[$index]['title']===''||!preg_match('/^\d{4}-\d{2}-\d{2}$/',$rows[$index]['date'])) json_response(['ok'=>false,'error'=>'Titel und gültiges Datum sind erforderlich.'],400);
    save_content($contentFile,$content); json_response(['ok'=>true,'news'=>$rows[$index]]);
}
if ($path==='/api/site-news'&&$method==='DELETE') {
    require_permission('news',$cookieName,$secret,$content,$config); $id=clean_value($_GET['id']??'',100);
    $content['news']=array_values(array_filter($content['news']??[],fn($x)=>(string)($x['id']??'')!==$id)); save_content($contentFile,$content); json_response(['ok'=>true]);
}
if ($path==='/api/site-calendar-admins'&&$method==='POST') {
    require_permission('news',$cookieName,$secret,$content,$config); $data=request_json(); $admins=[];
    foreach(($data['admins']??[]) as $value){$v=strtolower(clean_value($value,80));if($v!==''&&!in_array($v,$admins,true))$admins[]=$v;}
    if(!in_array('berndw',$admins,true))array_unshift($admins,'berndw'); $content['permissions']['calendarAdmins']=array_slice($admins,0,30);
    save_content($contentFile,$content); json_response(['ok'=>true,'calendarAdmins'=>$content['permissions']['calendarAdmins']]);
}
if (str_starts_with($path,'/api/')) proxy_legacy($path,(string)$config['legacy_api_base']);
json_response(['ok'=>false,'error'=>'Nicht gefunden'],404);
