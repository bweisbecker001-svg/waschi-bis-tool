import asyncio
import json
import os
import time
import urllib.request

import discord
from dotenv import load_dotenv

load_dotenv()

API_BASE = os.environ.get("WASCHI_API_BASE", "https://waschi.fun").rstrip("/")
VOICE_PUSH_SECRET = os.environ.get("VOICE_PUSH_SECRET", "").strip()

intents = discord.Intents.none()
intents.guilds = True
intents.voice_states = True
client = discord.Client(intents=intents)

def target_guild():
    configured = os.environ.get("DISCORD_GUILD_ID", "").strip()
    if configured:
        try:
            guild = client.get_guild(int(configured))
            if guild:
                return guild
        except ValueError:
            pass
    for guild in client.guilds:
        if guild.name.strip().lower() == "waschi":
            return guild
    return client.guilds[0] if client.guilds else None

def member_row(member):
    return {"id": str(member.id), "name": member.display_name, "username": member.name, "avatar": str(member.display_avatar.url)}

def build_snapshot():
    guild = target_guild()
    if guild is None:
        return None
    channels = []
    total_voice = 0
    for channel in sorted(guild.voice_channels, key=lambda c: (c.position, c.id)):
        members = [member for member in channel.members if not member.bot]
        if not members:
            continue
        total_voice += len(members)
        channels.append({"id": str(channel.id), "name": channel.name, "members": [member_row(member) for member in members]})
    return {"version": 1, "guildId": str(guild.id), "server": guild.name, "updatedAt": int(time.time()), "voiceMembers": total_voice, "channels": channels}

def push_snapshot():
    if not VOICE_PUSH_SECRET:
        raise RuntimeError("VOICE_PUSH_SECRET fehlt")
    payload = build_snapshot()
    if payload is None:
        return
    data = json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    req = urllib.request.Request(API_BASE + "/api/discord-push", data=data, method="POST", headers={"Content-Type": "application/json", "X-Waschi-Voice-Key": VOICE_PUSH_SECRET, "User-Agent": "WaschiBot/1.0"})
    with urllib.request.urlopen(req, timeout=15) as response:
        if response.status < 200 or response.status >= 300:
            raise RuntimeError(f"Voice push HTTP {response.status}")
    print(f"Voice-Snapshot an STRATO gesendet: {payload['voiceMembers']} Mitglied(er) in {len(payload['channels'])} Kanal/Kanälen", flush=True)

async def safe_push():
    try:
        await asyncio.to_thread(push_snapshot)
    except Exception as exc:
        print(f"Voice-Snapshot fehlgeschlagen: {exc}", flush=True)

@client.event
async def on_ready():
    print(f"Waschi-Bot verbunden als {client.user}", flush=True)
    guild = target_guild()
    if guild:
        print(f"Server erkannt: {guild.name} ({guild.id})", flush=True)
    await safe_push()

@client.event
async def on_voice_state_update(member, before, after):
    print(f"Voice-Änderung: {member.display_name}", flush=True)
    await safe_push()

async def periodic_push():
    await client.wait_until_ready()
    while not client.is_closed():
        await safe_push()
        await asyncio.sleep(30)

@client.event
async def setup_hook():
    client.loop.create_task(periodic_push())

token = os.environ.get("DISCORD_BOT_TOKEN", "").strip()
if not token:
    raise RuntimeError("DISCORD_BOT_TOKEN fehlt")
client.run(token, log_handler=None)
