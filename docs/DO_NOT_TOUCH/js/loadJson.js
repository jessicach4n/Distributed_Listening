import {
    refreshSoundDropdowns,
    refreshTargetDropdowns,
    syncSliderOutput
} from './form.js';
import { openFromGitHub, openFromFolder, isEnsembleFormat, fromEnsembleFormat } from './openScore.js';

// Setting a slider's value from code fires no 'input' event, so its labels
// (min, max, current value) have to be refreshed by hand
function syncSliders(root) {
    root.querySelectorAll('input[type="range"]').forEach(syncSliderOutput);
}

function getPath(obj, path) {
    return path.split('.').reduce((current, key) => {
        return current == null ? undefined : current[key];
    }, obj);
}

function populateSounds(sounds, audioFiles={}) {
    const section = document.getElementById('audio_section');
    section.replaceChildren(); // the previous project's sounds go

    Object.entries(sounds || {}).forEach(([name, path]) => {
        document.getElementById('addAudio').click();
        const rows = section.querySelectorAll('.row');
        const row = rows[rows.length - 1];
        row.dataset.soundName = name;
        row.dataset.currentName = name; // so renaming it later renames it in the events
        const nameInput = row.querySelector('.audioNameInput');
        if (nameInput) nameInput.value = name;

        const file = audioFiles[name];
        if (file) {
            const transfer = new DataTransfer();
            transfer.items.add(file);
            row.querySelector('input[type="file"]').files = transfer.files;
        } else {
            row.dataset.soundPath = path;
            const note = document.createElement('p');
            note.className = 'audioLoadedNote';
            note.textContent = `${name}: audio file not found (${path}). Choose a file to include it`;
            row.querySelector('.column').appendChild(note);
        }
    });

    refreshSoundDropdowns();
}

function getEffectKind(effect) {
    const effectsList = ['filter', 'reverb', 'delay', 'pitch', 'pan', 'drift'];
    if (effectsList.includes(effect.type)) {
        return effect.type;
    }
    if (['lowpass', 'highpass', 'bandpass'].includes(effect.type)) {
        return 'filter';
    }

    throw new Error(`Unsupported effect type: ${effect.type}`);
}

// Adds one effect (as in score.json) to a group card. Also used by
// editHelpers.js to copy effects between groups.
export function populateEffect(card, effect) {
    const addButton = card.querySelector('.addEffectButton');
    addButton.click();

    const rows = card.querySelectorAll('.effectRow');
    const row = rows[rows.length - 1];
    const kind = getEffectKind(effect);
    const kindSelect = row.querySelector('.effectKind');

    let idInput = row.querySelector('.effectId');
    if (!idInput) {
        idInput = document.createElement('input');
        idInput.type = 'text';
        idInput.className = 'effectId';
        idInput.placeholder = 'ID (optional)';
        row.appendChild(idInput);
    }

    kindSelect.value = kind;
    kindSelect.dispatchEvent(new Event('change', {bubbles: true}));

    const subtype = kind === 'filter' ? effect.type : kind;

    if (effect.id && effect.id !== subtype) {
        idInput.value = effect.id;
    }

    const fields = row.querySelector('.effectFields');
    const lfoCheckbox = fields.querySelector('input[type="checkbox"][data-field="lfoOn"]');
    if (lfoCheckbox) {
        lfoCheckbox.checked = Boolean(effect.lfoOn ?? effect.lfo);
        lfoCheckbox.dispatchEvent(new Event('input', {bubbles: true}));
    }

    fields.querySelectorAll('[data-field]').forEach(input => {
        if (input === lfoCheckbox) return;

    const value = getPath(effect, input.dataset.field);
        if (value === undefined || value === null) return;

        if (input.type === 'checkbox') {
            input.checked = Boolean(value);
        } else {
            input.value = String(value);
        }
    });

    syncSliders(row);
    refreshTargetDropdowns(card);
    return row;
}

function getEventAction(event) {
    if ('play' in event) return 'play';
    if ('stop' in event) return 'stop';
    if ('set' in event) return 'set';
    if ('ramp' in event) return 'ramp';
}

// Adds one event (as in score.json) to the end of a group card's events, and
// returns its row. Also used by editHelpers.js to duplicate events.
export function populateEvent(card, event) {
    const addButton = card.querySelector('.addEventButton');
    addButton.click();

    const rows = card.querySelectorAll('.eventRow');
    const row = rows[rows.length - 1];

    const action = getEventAction(event);
    const actionSelect = row.querySelector('.eventAction');
    actionSelect.value = action;
    actionSelect.dispatchEvent(new Event('change', {bubbles: true}));

    row.querySelector('[data-field="at"]').value = event.at ?? 0;

    let fields;
    if (action === 'play') {
        fields = {sound: event.play, loop: !!event.loop};
    } else if (action === 'stop') {
        fields = {sound: event.stop};
    } else if (action === 'set') {
        fields = {target: event.set, value: event.value};
    } else {
        fields = {target: event.ramp, to: event.to,over: event.over};
    }

    if (fields.target === 'gain') {
        fields.target = 'volume';
    }

    refreshSoundDropdowns();
    refreshTargetDropdowns(card);

    const eventFields = row.querySelector('.eventFields');
    const fill = (key, value) => {
        const input = eventFields.querySelector(`[data-field="${key}"]`);
        if (input && value !== undefined && value !== null) {
            if (input.type === 'checkbox') input.checked = Boolean(value);
            else input.value = value;
        }
    };

    // The target first: choosing it gives the value sliders their range (a
    // slider starts at 0-1, and would clamp e.g. 5000 Hz to 1 if set before)
    if (fields.target !== undefined) {
        fill('target', fields.target);
        refreshTargetDropdowns(card);
    }
    Object.entries(fields).forEach(([key, value]) => { if (key !== 'target') fill(key, value); });

    refreshTargetDropdowns(card);
    syncSliders(row);
    return row;
}

function populateGroups(groups) {
    const groupEntries = Object.entries(groups || {}).sort(([a], [b]) => Number(a) - Number(b));

    const selector = document.getElementById('groupSelection');
    // A loaded score may need more groups than the menu offers: add them
    for (let n = selector.options.length; n <= groupEntries.length; n++) {
        if (![...selector.options].some(o => o.value === String(n))) selector.add(new Option(String(n), String(n)));
    }
    selector.value = String(groupEntries.length);
    selector.dispatchEvent(new Event('change', {bubbles: true}));

    const cards = [...document.querySelectorAll('.groupCard')];

    groupEntries.forEach(([groupIndex, group], index) => {
        const card = cards[index];

        if (!card) {
            throw new Error(`Group card ${groupIndex} was not created.`);
        }

        const phoneInput = card.querySelector('.phoneInputSection input');
        if (phoneInput && group.nbOfPhones !== undefined && group.nbOfPhones !== null) {
            phoneInput.value = group.nbOfPhones;
        }

        (group.effects || []).forEach((effect, i) => {
            try {
                populateEffect(card, effect);
            } catch (error) {
                console.error(`Failed to load effect ${i} in group ${groupIndex}:`, effect, error);
                throw error;
            }
        });

        refreshTargetDropdowns(card);

        (group.events || []).forEach((event, i) => {
            try {
                populateEvent(card, event);
            } catch (error) {
                console.error(`Failed to load event ${i} in group ${groupIndex}:`, event, error);
                throw error;
            }
        });
    });
}

async function loadProject(file) {
    if (!file.name.toLowerCase().endsWith('.zip')) {
        return {
            data: JSON.parse(await file.text()), audioFiles: {}
        };
    }

    const zip = await JSZip.loadAsync(file);
    const jsonEntry = Object.values(zip.files).find(f =>
        !f.dir && f.name.toLowerCase().endsWith('.json')
    );
    if (!jsonEntry) {
        throw new Error('Could not find .json file in the ZIP');
    }

    const data = JSON.parse(await jsonEntry.async('string'));
    const base = jsonEntry.name.slice(0, jsonEntry.name.lastIndexOf('/') + 1);
    const audioFiles = {};
    for (const [name, path] of Object.entries(data.sounds || {})) {
        const entry = zip.file(base + path);
        if (!entry) continue;
        const blob = await entry.async('blob');
        audioFiles[name] = new File([blob], path.split('/').pop());
    }
    return {data, audioFiles};
}

const status = document.getElementById('loadJsonStatus');
const notesList = document.getElementById('loadJsonNotes');

function showNotes(notes) {
    notesList.replaceChildren(...notes.map(text => {
        const li = document.createElement('li');
        li.textContent = text;
        return li;
    }));
}

// Puts a loaded project into the form, whichever way it was opened.
// audioFiles: { soundName: File }; missing: sound names whose file wasn't found
function applyProject({ data, audioFiles = {}, missing = [] }, from) {
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
        throw new Error('File must be a JSON project');
    }
    // A score written for the phase-study ensemble: convert it to this format
    let notes = [];
    if (isEnsembleFormat(data)) {
        ({ score: data, notes } = fromEnsembleFormat(data));
        notes.unshift('This score was written for the phase-study ensemble, so it was converted:');
    }

    document.getElementById('projectName').value = data.title || '';
    populateSounds(data.sounds, audioFiles);
    populateGroups(data.groups);
    refreshSoundDropdowns();

    status.textContent = `Project loaded from ${from}!` + (missing.length
        ? ` Missing audio: ${missing.join(', ')}. Choose those files under Audio.`
        : '');
    showNotes(notes);
}

async function loadJsonFile(file) {
    applyProject(await loadProject(file), 'the file');
}

document.getElementById('jsonFile').addEventListener('change', async event => {
    const file = event.target.files[0];
    if (!file) return;

    status.textContent = '';
    showNotes([]);

    try {
        await loadJsonFile(file);
    } catch (error) {
        console.error('Couldn\'t load JSON: ', error);
        status.textContent = `Couldnt load JSON: ${error.message}`;
    }
});

// ── From a GitHub repo ──────────────────────────────────────────────────────
// The repo (or a folder in it) holds score.json and an audio/ folder; the
// score and every audio file it lists are downloaded into the form.
const linkInput = document.getElementById('openLink');
const linkButton = document.getElementById('openLinkButton');

async function openLink(link = linkInput.value) {
    linkButton.disabled = true;
    status.textContent = 'Opening…';
    showNotes([]);
    try {
        const project = await openFromGitHub(link, (done, total, name) => {
            status.textContent = total ? `Downloading audio ${done} / ${total}${name ? ` (${name})` : ''}…` : 'Opening…';
        });
        applyProject(project, 'GitHub');
    } catch (error) {
        console.error('Couldn\'t open the link: ', error);
        status.textContent = error.message;
    } finally {
        linkButton.disabled = false;
    }
}

linkButton.addEventListener('click', () => openLink());
linkInput.addEventListener('keydown', event => {
    if (event.key === 'Enter') { event.preventDefault(); openLink(); }
});

// ── From a folder on this computer ──────────────────────────────────────────
document.getElementById('openFolder').addEventListener('change', async event => {
    const files = event.target.files;
    if (!files.length) return;
    status.textContent = 'Opening…';
    showNotes([]);
    try {
        applyProject(await openFromFolder(files), 'the folder');
    } catch (error) {
        console.error('Couldn\'t open the folder: ', error);
        status.textContent = error.message;
    }
    event.target.value = '';
});

// jsonform.html?link=https://github.com/you/your-piece opens that piece straight away
const startLink = new URLSearchParams(location.search).get('link');
if (startLink) {
    linkInput.value = startLink;
    openLink(startLink);
}