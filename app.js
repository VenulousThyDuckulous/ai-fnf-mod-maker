const $ = id => document.getElementById(id);
const log = m => $("log").textContent = m;
let sfData = null, synth = null, selectedPreset = 0, chart = null, songName = "ai-madness";
let WorkletSynthesizer = null, audioContext = null;

// Load the SoundFont library only when it is actually needed.
// A failed SF2 library import must NOT prevent the API-key tester from working.
async function loadSoundFontLib() {
  if (WorkletSynthesizer) return;
  // spessasynth_lib is the browser wrapper and can load SF2 files directly
  // through synth.soundBankManager.addSoundBank(). We do not import
  // SoundBankLoader here. That class belongs to spessasynth_core.
  const lib = await import("https://cdn.jsdelivr.net/npm/spessasynth_lib@4.3.14/+esm");
  WorkletSynthesizer = lib.WorkletSynthesizer;
  if (!WorkletSynthesizer) throw new Error("WorkletSynthesizer could not be loaded from spessasynth_lib.");
}

const keySaved = localStorage.getItem("ai-fnf-api-key");
if (keySaved) $("apiKey").value = keySaved;

for (let n = 48; n <= 84; n++) {
  const o = document.createElement("option");
  o.value = n;
  o.textContent = `MIDI ${n}`;
  $("previewNote").appendChild(o);
}

$("saveKey").onclick = () => {
  const key = $("apiKey").value.trim();
  if (!key) {
    $("aiStatus").textContent = "Enter an API key first.";
    return;
  }
  localStorage.setItem("ai-fnf-api-key", key);
  $("aiStatus").textContent = "Saved locally in this browser.";
};

async function testOpenAIKey(key) {
  const r = await fetch("https://api.openai.com/v1/models", {
    method: "GET",
    headers: {
      "Authorization": `Bearer ${key}`,
      "Accept": "application/json"
    },
    cache: "no-store"
  });

  let body = null;
  try { body = await r.json(); } catch (_) {}

  if (!r.ok) {
    const apiMessage = body?.error?.message;
    throw new Error(`HTTP ${r.status}${apiMessage ? ` — ${apiMessage}` : ""}`);
  }

  return Array.isArray(body?.data);
}

$("testKey").onclick = async () => {
  const key = $("apiKey").value.trim();
  if (!key) {
    $("aiStatus").textContent = "❌ Enter an API key first.";
    return;
  }

  const button = $("testKey");
  button.disabled = true;
  button.textContent = "Testing...";
  $("aiStatus").textContent = "Connecting to OpenAI...";

  try {
    const ok = await testOpenAIKey(key);
    if (ok) {
      localStorage.setItem("ai-fnf-api-key", key);
      $("aiStatus").textContent = "✅ Connection works! API key is valid.";
    } else {
      $("aiStatus").textContent = "⚠️ OpenAI responded, but the response was unexpected.";
    }
  } catch (e) {
    // Give a useful message for the common GitHub Pages/browser cases.
    if (e instanceof TypeError && /fetch/i.test(e.message)) {
      $("aiStatus").textContent = "❌ Browser could not reach OpenAI. Check your internet connection, browser extensions, or network restrictions.";
    } else {
      $("aiStatus").textContent = `❌ ${e.message}`;
    }
    console.error("OpenAI connection test failed:", e);
  } finally {
    button.disabled = false;
    button.textContent = "Test connection";
  }
};

$("sf2").onchange = async e => {
  const f = e.target.files[0];
  if (!f) return;
  $("sfStatus").textContent = "Loading " + f.name + "...";
  try {
    await loadSoundFontLib();
    sfData = await f.arrayBuffer();

    // Initialize the actual browser synth and let its sound-bank manager
    // parse the SF2. This is the supported spessasynth_lib API.
    if (!audioContext) audioContext = new AudioContext({ sampleRate: 44100 });
    const workletURL = "https://cdn.jsdelivr.net/npm/spessasynth_lib@4.3.14/dist/spessasynth_processor.min.js";
    await audioContext.audioWorklet.addModule(workletURL);
    const ws = new WorkletSynthesizer(audioContext);
    ws.connect(audioContext.destination);
    await ws.soundBankManager.addSoundBank(sfData, "main");
    await ws.isReady;
    synth = { engine: ws, ready: true };

    // presetList is exposed by spessasynth_lib after the bank is loaded.
    const presets = Array.isArray(ws.presetList) ? ws.presetList : [];
    $("preset").innerHTML = "";
    presets.forEach((p, i) => {
      const o = document.createElement("option");
      o.value = i;
      o.textContent = `${i}: ${p.name || "Preset"}`;
      $("preset").appendChild(o);
    });

    $("sfStatus").textContent = `Loaded ${f.name} • ${presets.length} presets`;
  } catch (e) {
    console.error(e);
    $("sfStatus").textContent = "SF2 load failed: " + e.message;
  }
};

$("preset").onchange = e => selectedPreset = +e.target.value || 0;

$("testNote").onclick = async () => {
  if (!synth?.engine) {
    $("sfStatus").textContent = "Load an SF2 first.";
    return;
  }
  const note = +$("previewNote").value;
  try {
    await audioContext.resume();
    const presets = synth.engine.presetList || [];
    const preset = presets[selectedPreset];
    synth.engine.programChange(0, Number(preset?.program ?? selectedPreset));
    synth.engine.noteOn(0, note, 110);
    setTimeout(() => synth.engine.noteOff(0, note), 500);
    $("sfStatus").textContent = "Playing preview note.";
  } catch (e) {
    console.error(e);
    $("sfStatus").textContent = "Preview failed: " + e.message;
  }
};

function slug(s) {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "-") || "song";
}

function makeChart() {
  const bpm = +$("bpm").value || 180;
  const len = +$("length").value || 90;
  const step = 60000 / bpm / 2;
  const notes = [];
  const total = Math.floor(len * 1000 / step);
  for (let i = 0; i < total; i++) {
    if (i < 16) continue;
    const bar = i % 16;
    if (bar === 0 || bar === 4 || bar === 8 || bar === 12) notes.push([i * step, 0, 0]);
    if (bar === 2 || bar === 6 || bar === 10 || bar === 14) notes.push([i * step, 1, 0]);
    if (i % 8 === 7) notes.push([i * step, 2, 0]);
  }
  return {
    song: {
      song: songName,
      notes: notes.map(n => ({ sectionNotes: [[n[0], n[1], 0]], lengthInSteps: 16 })),
      bpm,
      needsVoices: false,
      speed: 1,
      player1: $("player").value.trim() || "bf",
      player2: $("opponent").value.trim() || "dad",
      gfVersion: "gf",
      stage: $("stage").value.trim() || "stage",
      validScore: true
    }
  };
}

async function aiGenerate() {
  const key = $("apiKey").value.trim();
  if (!key) return null;
  const prompt = `Generate structured FNF chart planning data for this request. Return JSON only with arrays of note events. Request: ${$("prompt").value}. BPM: ${$("bpm").value}. Length: ${$("length").value} seconds.`;
  const r = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({ model: "gpt-4.1-mini", input: prompt })
  });
  if (!r.ok) {
    let message = `AI HTTP ${r.status}`;
    try { const b = await r.json(); message += b?.error?.message ? ` — ${b.error.message}` : ""; } catch (_) {}
    throw new Error(message);
  }
  const data = await r.json();
  return data.output_text || "";
}

$("generate").onclick = async () => {
  songName = slug($("songName").value);
  log("Generating chart...");
  try {
    let aiText = null;
    if ($("apiKey").value.trim()) {
      try { aiText = await aiGenerate(); }
      catch (e) { log("AI request failed; using local generator. " + e.message); }
    }
    chart = makeChart();
    if (aiText) chart.song.generatedByAI = true;
    $("export").disabled = false;
    $("previewJson").disabled = false;
    log(`Generated ${songName} • ${chart.song.notes.length} chart sections • ${$("bpm").value} BPM`);
  } catch (e) {
    log("Generation failed: " + e.message);
  }
};

$("previewJson").onclick = () => {
  if (chart) log(JSON.stringify(chart, null, 2));
};

$("export").onclick = async () => {
  if (!chart) return;
  const zip = new JSZip(), mod = slug($("modName").value) || "ai-mod";
  const s = songName;
  const folder = `mods/${mod}`;
  zip.file(`${folder}/data/${s}/${s}-${$("difficulty").value.toLowerCase()}.json`, JSON.stringify(chart, null, 2));
  zip.file(`${folder}/songs/${s}/README.txt`, `Generated by AI FNF Mod Maker.\nSong: ${s}\nBPM: ${chart.song.bpm}\nInstrumental audio should be placed here as Inst.ogg.\n`);
  zip.file(`${folder}/README.txt`, `Psych Engine 1.0.4 generated mod\n\nSong: ${s}\n`);
  if (sfData) zip.file(`${folder}/soundfonts/imported.sf2`, sfData);
  const blob = await zip.generateAsync({ type: "blob" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${mod}.zip`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  log("ZIP exported.");
};
