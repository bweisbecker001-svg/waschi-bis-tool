import asyncio
import json
import os
import time

import discord
from vercel.blob import sync as blob

VOICE_PATH = "waschi/discord-voice-state-v1.json"

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
    return {
        "id": str(member.id),
        "name": member.display_name,
        "username": member.name,
        "avatar": str(member.display_avatar.url),
    }


def publish_snapshot():
    guild = target_guild()
    if guild is None:
        return

    channels = []
    total_voice = 0
    for channel in sorted(guild.voice_channels, key=lambda c: (c.position, c.id)):
        members = [m for m in channel.members if not m.bot]
        if not members:
            continue
        total_voice += len(members)
        channels.append({
            "id": str(channel.id),
            "name": channel.name,
            "members": [member_row(m) for m in members],
        })

    payload = {
        "version": 1,
        "guildId": str(guild.id),
        "server": guild.name,
        "updatedAt": int(time.time()),
        "voiceMembers": total_voice,
        "channels": channels,
    }
    raw = json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    blob.put_blob(
        VOICE_PATH,
        raw,
        access="private",
        content_type="application/json",
        allow_overwrite=True,
        cache_control_max_age=0,
    )
    print(f"voice snapshot: {total_voice} member(s) in {len(channels)} channel(s)", flush=True)


async def safe_publish():
    try:
        await asyncio.to_thread(publish_snapshot)
    except Exception as exc:
        print(f"voice snapshot failed: {exc}", flush=True)


@client.event
async def on_ready():
    print(f"Waschi Discord voice daemon connected as {client.user}", flush=True)
    await safe_publish()


@client.event
async def on_voice_state_update(member, before, after):
    await safe_publish()


async def periodic_publish():
    await client.wait_until_ready()
    while not client.is_closed():
        await safe_publish()
        await asyncio.sleep(30)


@client.event
async def setup_hook():
    client.loop.create_task(periodic_publish())


token = os.environ.get("DISCORD_BOT_TOKEN", "").strip()
if not token:
    raise RuntimeError("DISCORD_BOT_TOKEN fehlt")

client.run(token, log_handler=None)
