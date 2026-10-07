const form = document.getElementById("projectForm");
const audioSection = document.getElementById("audio_section");
const scoreSection = document.getElementById("scoreSection");
const audioTemplate = audioSection.querySelector(".audio-row").cloneNode(true);

// add, remove audio, autofill filename
document.getElementById("addAudio").addEventListener("click", () => {
  audioSection.appendChild(audioTemplate.cloneNode(true));
});

audioSection.addEventListener("click", (e) => {
  if (e.target.classList.contains("removeAudio")) {
    e.target.closest(".audio-row").remove();
  }
});

audioSection.addEventListener("change", (e) => {
  if (!e.target.classList.contains("audioFile")) return;
  const row = e.target.closest(".audio-row");
  const nameInput = row.querySelector(".audioName");
  const file = e.target.files[0];
  if (file && !nameInput.value.trim()) {
    nameInput.value = file.name.replace(/\.[^.]+$/, "");
  }
});

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function soundOptions() {
  return [...audioSection.querySelectorAll(".audio-row .audioName")]
    .map(i => i.value.trim())
    .filter(Boolean)
    .map(n => `<option value="${esc(n)}">${esc(n)}</option>`)
    .join("") || `<option value="">add sound</option>`;
}

// add n remove cues
function renumberCues() {
  [...scoreSection.querySelectorAll(".cue")].forEach((c, i) => {
    c.querySelector("h4").textContent = `Cue ${i + 1}`;
  });
}

const cueTemplate = document.getElementById("cueTemplate");

document.getElementById("addCue").addEventListener("click", () => {
  const cue = cueTemplate.content.cloneNode(true);
  cue.querySelector(".soundPick").innerHTML = soundOptions();
  scoreSection.appendChild(cue);
  renumberCues();
});

scoreSection.addEventListener("click", (e) => {
  if (e.target.classList.contains("removeCue")) {
    e.target.closest(".cue").remove();
    renumberCues();
  }
});

// display value of slider
scoreSection.addEventListener("input", (e) => {
  if (e.target.type === "range") e.target.nextElementSibling.textContent = e.target.value;
});
// transition length visibility
scoreSection.addEventListener("change", (e) => {
  if (e.target.classList.contains("transitionPick")) {
    const cue = e.target.closest(".cue");
    cue.querySelector(".transitionLength").hidden = e.target.value === "none";
  }
});
// sound options
scoreSection.addEventListener("mousedown", (e) => {
  if (e.target.classList.contains("soundPick")) {
    const current = e.target.value;
    e.target.innerHTML = soundOptions();
    e.target.value = current;
  }
});

// return json per cue
function collectCue(cue, i) {
  const get = (key) => cue.querySelector(`[data-key="${key}"]`);
  const num = (key) => Number(get(key).value);
  const type = get("transitionType").value;

  return {
    id: i + 1,
    sound: get("sound").value,
    startTime: num("startTime"),
    duration: num("duration") || null,
    loop: get("loop").checked,
    volume: num("volume"),
    fadeIn: num("fadeIn"),
    fadeOut: num("fadeOut"),
    effects: {
      pan: num("pan"),
      speed: num("speed"),
      reverb: num("reverb"),
    },
    transition: type === "none" ? null : {type, duration: num("transitionDuration")},
  };
}

// build total json
function collectData() {
  const sounds = [...audioSection.querySelectorAll(".audio-row")]
    .map(row => ({
      name: row.querySelector(".audioName").value.trim(),
      fileName: row.querySelector(".audioFile").files[0]?.name ?? "",
    }))
    .filter(s => s.name || s.fileName);

  return {
    project: form.elements.projectName.value.trim(),
    group: Number(form.elements.group.value),
    sounds,
    score: [...scoreSection.querySelectorAll(".cue")].map(collectCue),
  };
}

function downloadJSON(data, filename) {
  const blob = new Blob([JSON.stringify(data, null, 2)], {type: "application/json"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

form.addEventListener("submit", (e) => {
  e.preventDefault();
  const data = collectData();
  const safeName = (data.project || "project").replace(/[^a-z0-9_-]/gi, "_").toLowerCase();
  downloadJSON(data, `group${data.group}_${safeName}.json`);
});