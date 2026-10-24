// Sound files sit next to score.json in the piece's folder (docs/performances/<n>/),
// so the score just names the file, e.g. "pad.wav".
const TARGET_ALIASES = {volume: 'gain'};

function setPath(obj, path, value) {
const keys = path.split('.');
let current = obj;
    keys.slice(0, -1).forEach(function(k) {
        current[k] = current[k] || {};
        current = current[k];
    });
    current[keys[keys.length - 1]] = value;
}

function readInput(input) {
    return input.type === 'number' ? Number(input.value) : input.value;
}

// ======= SOUNDS ======= //
function readSounds() {
const sounds = {};
    document.querySelectorAll('#audio_section .row').forEach(function (row) {
const inputs = row.querySelectorAll('input[type="text"]');
const file = inputs[0].value.trim();
const name = row.querySelector('.audioNameInput').value.trim();
        if (!name || !file) {
            return;
        }
        sounds[name] = file;
    });
    return sounds;
}

// ======= EFFECTS ======= //
function readEffect(effectRow) {
    const kind = effectRow.querySelector('.effectKind').value;
    const params = {};

        effectRow.querySelectorAll('.effectFields [data-field]').forEach(function (input) {
            if (input.disabled || input.type === 'checkbox') {
                return;
            }
            setPath(params, input.dataset.field, readInput(input));
        });

    const type = params.type || kind;
    delete params.type;

    const lfoInput = effectRow.querySelector('.effectFields input[type="checkbox"][data-field="lfoOn"]');
    if (lfoInput) {
        params.lfoOn = lfoInput.checked;
    }

    const idInput = effectRow.querySelector('.effectId');
    const customId = idInput ? idInput.value.trim() : '';

    return Object.assign(
        {
            id: customId || type,
            type: type
        },
        params
    );
}

// ======= EVENTS ======= //
function readEvent(eventRow) {
const action = eventRow.querySelector('.eventAction').value;
const at = Number(eventRow.querySelector('[data-field="at"]').value);
const f = {};
    eventRow.querySelectorAll('.eventFields [data-field]').forEach(function (input) {
        f[input.dataset.field] = readInput(input);
    });

const target = TARGET_ALIASES[f.target] || f.target;
    if (action === 'play') {return {at: at, play: f.sound};}
    if (action === 'stop') {return {at: at, stop: f.sound};}
    if (action === 'set') {return {at: at, set: target, value: f.value};}
    if (action === 'ramp') {return {at: at, ramp: target, to: f.to, over: f.over};}
}

// ======= GROUPS ======= //
function readGroups() {
const groups = {};
    document.querySelectorAll('.groupCard').forEach(function(card, index) {
const phoneInput = card.querySelector('.phoneInputSection input');
        groups[index] = {
            nbOfPhones: phoneInput && phoneInput.value !== '' ? Number(phoneInput.value) : null,
            effects: Array.from(card.querySelectorAll('.effectRow')).map(readEffect),
            events: Array.from(card.querySelectorAll('.eventRow')).map(readEvent)
        };
    });
    return groups;
}

// ======= BUILD + DOWNLOAD ======= //
function buildJson() {
    return {
        title: document.getElementById('projectName').value.trim(),
        sounds: readSounds(),
        groups: readGroups()
    };
}

function downloadJson(data) {
const blob = new Blob([JSON.stringify(data, null, 2)], {type: 'application/json'});
const url = URL.createObjectURL(blob);
const link = document.createElement('a');
    link.href = url;
    // The name the server looks for in each piece's folder.
    link.download = 'score.json';
    link.click();
    URL.revokeObjectURL(url);
}

document.getElementById('jsonForm').addEventListener('submit', function(event) {
    event.preventDefault();
    downloadJson(buildJson());
});