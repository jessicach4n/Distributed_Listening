import {
    refreshSoundDropdowns,
    refreshTargetDropdowns
} from './form.js';

function getPath(obj, path) {
    return path.split('.').reduce((current, key) => {
        return current == null ? undefined : current[key];
    }, obj);
}

function populateSounds(sounds, audioFiles={}) {
    const section = document.getElementById('audio_section');
    section.textcontent = '';

    Object.entries(sounds || {}).forEach(([name, path]) => {
        document.getElementById('addAudio').click();
        const rows = section.querySelectorAll('.row');
        const row = rows[rows.length - 1];
        row.dataset.soundName = name;

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
    const effectsList = ['filter', 'reverb', 'delay', 'pitch', 'pan'];
    if (effectsList.includes(effect.type)) {
        return effect.type;
    }
    if (['lowpass', 'highpass', 'bandpass'].includes(effect.type)) {
        return 'filter';
    }

    throw new Error(`Unsupported effect type: ${effect.type}`);
}

function populateEffect(card, effect) {
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

    refreshTargetDropdowns(card);
}

function getEventAction(event) {
    if ('play' in event) return 'play';
    if ('stop' in event) return 'stop';
    if ('set' in event) return 'set';
    if ('ramp' in event) return 'ramp';
}

function populateEvent(card, event) {
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
        fields = {sound: event.play};
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

    Object.entries(fields).forEach(([key, value]) => {
    const input = eventFields.querySelector(`[data-field="${key}"]`);
        if (input && value !== undefined && value !== null) {
            input.value = value;
        }
    });

    refreshTargetDropdowns(card);
}

function populateGroups(groups) {
    const groupEntries = Object.entries(groups || {}).sort(([a], [b]) => Number(a) - Number(b));

    const selector = document.getElementById('groupSelection');
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

async function loadJsonFile(file) {
    const {data, audioFiles} = await loadProject(file);

    if (!data || typeof data !== 'object' || Array.isArray(data)) {
        throw new Error('File must be a JSON project');
    }

    document.getElementById('projectName').value = data.title || '';
    populateSounds(data.sounds, audioFiles);
    populateGroups(data.groups);
    refreshSoundDropdowns();
    document.getElementById('loadJsonStatus').textContent = 'Project loaded !!';
}

document.getElementById('jsonFile').addEventListener('change', async event => {
    const file = event.target.files[0];
    if (!file) return;

    const status = document.getElementById('loadJsonStatus');
    status.textContent = '';

    try {
        await loadJsonFile(file);
    } catch (error) {
        console.error('Couldn\'t load JSON: ', error);
        status.textContent = `Couldnt load JSON: ${error.message}`;
    }
});