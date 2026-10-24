import { getAudioEntries } from "./form.js";
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
    getAudioEntries().forEach(function(e) {
        sounds[e.name] = e.path;
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

async function downloadProject(data) {
    const projectTitle = (data.title).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const zip = new JSZip();
    const folder = zip.folder(projectTitle);

    folder.file(projectTitle + '.json', JSON.stringify(data, null, 2));
    getAudioEntries().forEach(function(e) {
        if (e.file) {
            folder.file(e.path, e.file);
        }
    });

    const blob = await zip.generateAsync({type: 'blob'});
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = projectTitle + '.zip';
    // The name the server looks for in each piece's folder.
    // link.download = 'score.json';
    link.click();
    URL.revokeObjectURL(url);
}

document.getElementById('jsonForm').addEventListener('submit', function(event) {
    event.preventDefault();
    downloadProject(buildJson());
});