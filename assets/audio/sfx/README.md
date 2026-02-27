# Sound Effects — O Fim (The Bar)

Sound effects for the AEON bar setting ambience. Related to GitHub Issue #32.

## Status

The ElevenLabs API was called successfully via MCP Docker tools (`text_to_sound_effects`),
generating all 4 effects. However, the Docker MCP container filesystem is isolated from the
host, so the generated files could not be extracted to this directory.

To regenerate these files, use the ElevenLabs text-to-sound-effects API (or the MCP tool
with a writable volume mount) with the prompts below.

## Sound Effects

### 1. bar-ambience.mp3
**Duration:** 5 seconds
**Prompt:**
> Late night bar ambience at 2AM: glasses clinking softly, distant murmurs of quiet
> conversation, chairs shifting on wooden floor, draft beer being poured into a glass,
> contemplative low-energy atmosphere, Brazilian bar interior

**Character:** The persistent hum of O Fim. Always 2 AM. Chopp flows cold. Low energy,
contemplative, the sound of people who have stopped pretending.

---

### 2. jukebox-transition.mp3
**Duration:** 5 seconds
**Prompt:**
> Jukebox music transition: bossa nova melody fading out while glam rock guitar bleeds
> through, genre crossfade effect, vinyl crackle, warm analog sound shifting between
> musical styles

**Character:** The jukebox plays Tom Jobim, but sometimes Bowie bleeds through. The
transition between worlds — a crossfade that shouldn't work but does.

---

### 3. fado-background.mp3
**Duration:** 5 seconds
**Prompt:**
> Soft Portuguese fado music playing distantly in background, melancholic Portuguese guitar,
> gentle acoustic reverb, ambient and distant, sad and contemplative mood

**Character:** Occasionally, Fado. Soares watches from a window across the street. The
Portuguese guitar carries saudade — longing for something that may never have existed.

---

### 4. choronzon-static.mp3
**Duration:** 5 seconds
**Prompt:**
> Radio static between stations, white noise with eerie patterns emerging, electronic glitch
> sounds, unsettling interference, demonic radio frequency, chaotic signal searching

**Character:** Choronzon is the static between radio stations. Not noise — signal from
somewhere else. Patterns that almost resolve into meaning, then dissolve.

---

## Generation Settings

- **API:** ElevenLabs Text-to-Sound-Effects
- **Format:** mp3_44100_128 (MP3, 44.1kHz, 128kbps)
- **Duration:** 5 seconds each
- **MCP Tool:** `text_to_sound_effects` via MCP Docker

## Manual Generation

Using the ElevenLabs API directly:

```bash
curl -X POST "https://api.elevenlabs.io/v1/sound-generation" \
  -H "xi-api-key: $ELEVENLABS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "<prompt from above>",
    "duration_seconds": 5,
    "prompt_influence": 0.3
  }' \
  --output assets/audio/sfx/<filename>.mp3
```

Or via the ElevenLabs MCP Docker tool (ensure volume mount to host):

```
docker run -v $(pwd)/assets/audio/sfx:/output elevenlabs-mcp \
  text_to_sound_effects --output-directory /output ...
```
