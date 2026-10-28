export const AUDIO_FOLDER_PATH = 'audio/';

//   sliders need a max. "Over (seconds)" had no max before, so pick one that fits your project
const SLIDER_MAX_TIME_SECONDS = 120;   // max for "Over (seconds)"

// ========EFFECT =========
//   every field and target below now has a `step` (sliders need one)
const EFFECTS = {
    filter: {
        label: 'Filter',
        fields: [
            { key: 'type', label: 'Select type', kind: 'select', options: ['lowpass', 'highpass', 'bandpass'] },
            { key: 'frequency', label: 'Frequency (Hz)', min: 20, max: 20000, step: 1, default: 1000, showWhen: 'nolfo' },
            { key: 'q', label: 'Q', min: 0.1, max: 20, step: 0.1, default: 1 },
            { key: 'lfoOn', label: 'Use LFO', kind: 'checkbox' },
            { key: 'lfo.rate', label: 'LFO rate (Hz)', min: 0.01, max: 20, step: 0.01, default: 0.2, showWhen: 'lfo' },
            { key: 'lfo.min', label: 'LFO min (Hz)', min: 20, max: 20000, step: 1, default: 200, showWhen: 'lfo' },
            { key: 'lfo.max', label: 'LFO max (Hz)', min: 20, max: 20000, step: 1, default: 2000, showWhen: 'lfo' },
        ],
        targets: [
            { setting: 'frequency', min: 20, max: 20000, step: 1, ramp: true, showWhen: 'nolfo' },
            { setting: 'rate', min: 0.01, max: 20, step: 0.01, ramp: true, showWhen: 'lfo' },
            { setting: 'q', min: 0.1, max: 20, step: 0.1, ramp: true },
        ],
    },
    reverb: {
        label: 'Reverb',
        fields: [
            { key: 'decay', label: 'Decay (s)', min: 0.1, max: 30, step: 0.1, default: 4 },
            { key: 'preDelay', label: 'Pre-delay (s)', min: 0, max: 1, step: 0.01, default: 0.01 },
            { key: 'mix', label: 'Mix (0-1)', min: 0, max: 1, step: 0.01, default: 0.3 },
        ],
        targets: [{ setting: 'mix', min: 0, max: 1, step: 0.01, ramp: true }],
    },
    delay: {
        label: 'Delay / echo',
        fields: [
            { key: 'time', label: 'Time (s)', min: 0.01, max: 5, step: 0.01, default: 0.25 },
            { key: 'feedback', label: 'Feedback (0-0.95)', min: 0, max: 0.95, step: 0.01, default: 0.4 },
            { key: 'mix', label: 'Mix (0-1)', min: 0, max: 1, step: 0.01, default: 0.3 },
        ],
        targets: [
            { setting: 'time', min: 0.01, max: 5, step: 0.01, ramp: true },
            { setting: 'feedback', min: 0, max: 0.95, step: 0.01, ramp: true },
            { setting: 'mix', min: 0, max: 1, step: 0.01, ramp: true },
        ],
    },
    pitch: {
        label: 'Pitch',
        fields: [
            { key: 'semitones', label: 'Semitones', min: -24, max: 24, step: 1, default: 0 },
            { key: 'mix', label: 'Mix (0-1)', min: 0, max: 1, step: 0.01, default: 1 },
        ],
        targets: [
            { setting: 'semitones', min: -24, max: 24, step: 1, ramp: false }, // set only!
            { setting: 'mix', min: 0, max: 1, step: 0.01, ramp: true },
        ],
    },
    pan: {
        label: 'Pan',
        fields: [{ key: 'pan', label: 'Pan (-1 left, 1 right)', min: -1, max: 1, step: 0.01, default: 0 }],
        targets: [{ setting: 'pan', min: -1, max: 1, step: 0.01, ramp: true }],
    },
};

// ========EVENT =========
//   value / to / over now have min, max and step so they can be sliders
const EVENTS = {
    play: {
        label: 'Play',
        fields: [
            { key: 'sound', label: 'Sound to play', kind: 'sound' },
        ],
    },
    stop: {
        label: 'Stop',
        fields: [
            { key: 'sound', label: 'Sound to stop', kind: 'sound' },
        ],
    },
    set: {
        label: 'Set',
        fields: [
            { key: 'target', label: 'Target', kind: 'target' },
            { key: 'value', label: 'Value', min: 0, max: 1, step: 0.01, default: 0, limitedByTarget: true },
        ],
    },
    ramp: {
        label: 'Ramp',
        fields: [
            { key: 'target', label: 'Target', kind: 'target' },
            { key: 'to', label: 'Go to', min: 0, max: 1, step: 0.01, default: 0, limitedByTarget: true },
            { key: 'over', label: 'Over (seconds)', min: 0.01, max: SLIDER_MAX_TIME_SECONDS, step: 0.01, default: 1 },
        ],
    },
};

//   the trash-can icon used by every "Delete" button
const DELETE_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="45" height="44" viewBox="0 0 45 44" fill="none">
  <path d="M13.125 38.5C12.0938 38.5 11.2109 38.141 10.4766 37.4229C9.74219 36.7049 9.375 35.8417 9.375 34.8333L9.375 11H7.5L7.5 7.33333L16.875 7.33333V5.5L28.125 5.5V7.33333L37.5 7.33333V11H35.625V34.8333C35.625 35.8417 35.2578 36.7049 34.5234 37.4229C33.7891 38.141 32.9062 38.5 31.875 38.5L13.125 38.5ZM16.875 31.1667L20.625 31.1667L20.625 14.6667H16.875L16.875 31.1667ZM24.375 31.1667H28.125L28.125 14.6667H24.375L24.375 31.1667Z" fill="#03010100"/>
</svg>`;

//   turns a button into an icon-only delete button
function setDeleteIcon(button){
    button.classList.add('deleteButton');
    button.innerHTML = DELETE_ICON_SVG;
    button.title = "Delete";                 // tooltip on hover
    button.setAttribute('aria-label', 'Delete');   // screen readers (the text label is gone)
}

//====== helper: rebuild a dropdown but keep the user's choice if it still exists =====
// options is a list like [{value: 'pad', label: 'pad'}, ...]
function fillSelect(select, options, placeholder){
    var previous = select.value;
    select.textContent = "";

    var placeholderOption = document.createElement('option');
    placeholderOption.value = "";
    placeholderOption.textContent = placeholder;
    select.appendChild(placeholderOption);

    options.forEach(function(o){
        var option = document.createElement('option');
        option.value = o.value;
        option.textContent = o.label;
        select.appendChild(option);
    });

    //keep the old choice only if it is still in the list
    var stillExists = options.some(function(o){ return o.value === previous; });
    select.value = stillExists ? previous : "";
}


//====== ONE field: label + input, built from a config description =====
function createField(f){

    var fieldDiv = document.createElement('div');
    fieldDiv.className="column";
    //remember when this field should be visible (used for the filter LFO)
    if (f.showWhen) { fieldDiv.dataset.showWhen = f.showWhen; }

    var label = document.createElement('label');
    label.textContent = f.label;

    var input;
    if (f.kind === 'select') {
        // fixed options (e.g. lowpass / highpass / bandpass)
        input = document.createElement('select');
        f.options.forEach(function(optionName){
            var option = document.createElement('option');
            option.value = optionName;
            option.textContent = optionName;
            input.appendChild(option);
        });

    } else if (f.kind === 'checkbox') {
        input = document.createElement('input');
        input.type = "checkbox";

    } else if (f.kind === 'sound' || f.kind === 'target') {
        // empty for now, refreshSoundDropdowns / refreshTargetDropdowns fill them
        input = document.createElement('select');
        input.className = (f.kind === 'sound') ? "soundSelect" : "targetSelect";
        input.required = true;

    } else if (f.kind === 'number') {
        //   plain number box (the original code), used by "At (seconds)"
        input = document.createElement('input');
        input.type = "number";
        input.step = "any";
        input.required = true;
        if (f.min !== undefined) { input.min = f.min; }
        if (f.max !== undefined) { input.max = f.max; }
        if (f.default !== undefined) { input.value = f.default; }

    } else {
        //   every other number field is a slider (type="range")
        input = document.createElement('input');
        input.type = "range";
        //   min / max / step MUST be set before the value, otherwise the browser
        // clamps the default to its own 0-100 range
        input.min = f.min;
        input.max = f.max;
        input.step = f.step;
        if (f.default !== undefined) { input.value = f.default; }
        if (f.limitedByTarget) { input.className = "targetLimited"; }
    }

    input.dataset.field = f.key;   // lets the JSON code find this input later

    fieldDiv.appendChild(label);

    if (input.type === 'range') {
        //   layout is   [min] ----o---- [max]
        //                              current value
        var sliderWrap = document.createElement('div');
        sliderWrap.className = "sliderWrap";

        var sliderRow = document.createElement('div');
        sliderRow.className = "sliderRow";
        var minLabel = document.createElement('span');
        minLabel.className = "sliderMin";
        var maxLabel = document.createElement('span');
        maxLabel.className = "sliderMax";
        sliderRow.appendChild(minLabel);
        sliderRow.appendChild(input);
        sliderRow.appendChild(maxLabel);

        var valueOut = document.createElement('output');
        valueOut.className = "sliderValue";

        sliderWrap.appendChild(sliderRow);
        sliderWrap.appendChild(valueOut);
        fieldDiv.appendChild(sliderWrap);
        syncSliderOutput(input);   // fills in min, max and current value
    } else {
        fieldDiv.appendChild(input);
    }
    return fieldDiv;
}

//   now refreshes the min label, max label AND current value of a slider
// (min/max matter because the event sliders change range when the target changes)
// Also exported: code that sets slider.value from JS (loadJson.js) must call it,
// because setting .value in code does not fire an 'input' event.
function syncSliderOutput(input){
    var wrap = input.closest('.sliderWrap');
    if (!wrap) { return; }
    wrap.querySelector('.sliderMin').textContent = input.min;
    wrap.querySelector('.sliderMax').textContent = input.max;
    wrap.querySelector('output').textContent = input.value;
}
document.addEventListener('input', function(e){
    if (e.target.type === 'range') { syncSliderOutput(e.target); }
});


//====== a box with all the fields of a list =====
function createFields(fieldList, className){
    var fieldsDiv = document.createElement('div');
    fieldsDiv.className = className;
    fieldList.forEach(function(f){
        fieldsDiv.appendChild(createField(f));
    });
    return fieldsDiv;
}


//=========ADD AUDIO ============
document.getElementById("addAudio").addEventListener('click', function(){

    var newRow= document.createElement('div');
    newRow.className='row';

    // //=======AUDIO FILE
    var divAudioFile = document.createElement('div');
    divAudioFile.className = 'column';
    var labelAudioFile = document.createElement('label');
    labelAudioFile.textContent = 'Upload Audio File';
    var inputAudioFile = document.createElement('input');
    inputAudioFile.type = 'file';
    inputAudioFile.className = 'audioFileInput';
    inputAudioFile.accept = 'audio/*';

    //====DELETE AUDIO BUTTON
    var deletAudioButton =document.createElement('button');
    deletAudioButton.className='removeAudio';
    // deletAudioButton.textContent="- Remove Audio";
    setDeleteIcon(deletAudioButton); 
    deletAudioButton.type="button";

    divAudioFile.appendChild(labelAudioFile);
    divAudioFile.appendChild(inputAudioFile);

    newRow.appendChild(divAudioFile);
    newRow.appendChild(deletAudioButton);

    document.getElementById('audio_section').appendChild(newRow);
});

//===== DELETE AUDIO =======
// ONE listener on the whole audio section: it catches clicks from the
// buttons that exist now AND the ones created later
document.getElementById('audio_section').addEventListener('click', function(event){
    if (event.target.classList.contains('removeAudio')) {
        event.target.closest('.row').remove();
        refreshSoundDropdowns();   // the removed name must disappear from the event dropdowns
    }
});

//===== CHOOSING AN AUDIO FILE =======
document.getElementById('audio_section').addEventListener('input', function(event) {
    var t = event.target;
    if (t.type==='file' && t.files.length) {
        var row = t.closest('.row');
        delete row.dataset.soundName;
        delete row.dataset.soundPath;
        var note = row.querySelector('.audioLoadedNote');
        if (note) note.remove();
    }
    refreshSoundDropdowns();
})


//====== SOUND dropdowns: filled from the audio names the user typed =====
export function getAudioEntries() {
    var entries = [];
    document.querySelectorAll('#audio_section .row').forEach(function(row) {
        var input = row.querySelector('input[type="file"]');
        var file = input && input.files[0];
        if (file) {
            entries.push({
                name: row.dataset.soundName || file.name.replace(/\.[^.]+$/, ''),
                path: AUDIO_FOLDER_PATH + file.name,
                file: file
            });
        } else if (row.dataset.soundName) {
            entries.push({
                name: row.dataset.soundName,
                path: row.dataset.soundPath,
                file: null
            });
        }
    });
    return entries;
}

function getSoundNames(){
    var names = [];
    getAudioEntries().forEach(function(e) {
        if (names.indexOf(e.name) === -1) {
            names.push(e.name);
        }
    });
    return names;
}

function refreshSoundDropdowns(){
    var options = getSoundNames().map(function(name){
        return { value: name, label: name };
    });
    document.querySelectorAll('.soundSelect').forEach(function(select){
        fillSelect(select, options, "Choose audio");
    });
}


//====EFFECTS====

//Show/hide the filter fields that depend on the "Use LFO" checkbox
function updateLfoVisibility(effectRow){
    var checkbox = effectRow.querySelector('input[type="checkbox"]');
    var lfoOn = checkbox ? checkbox.checked : false;

    effectRow.querySelectorAll('[data-show-when]').forEach(function(fieldDiv){
        var show = (fieldDiv.dataset.showWhen === 'lfo') ? lfoOn : !lfoOn;
        fieldDiv.hidden = !show;
        //a disabled input is skipped by the validation and easy to skip in the JSON
        fieldDiv.querySelector('input, select').disabled = !show;
    });
}

//Create row of effect: dropdown + its inputs + id + delete button =====
function createEffectRow(effectsListSection){

    var effectRow = document.createElement('div');
    // effectRow.className = "column effectRow";
    effectRow.className = "row effectRow";

    //create label
    var effectLabel = document.createElement('label');
    effectLabel.textContent = "Select effect";

    //create the dropdown of effect type, one option for each effect in EFFECTS
    var effectSelect = document.createElement('select');
    effectSelect.className = "effectKind";   // <-- NEW: getEffectInfo reads this class
    for (var key in EFFECTS) {
        var option = document.createElement('option');
        option.value = key;                    // 'reverb'
        option.textContent = EFFECTS[key].label; // 'Reverb'
        effectSelect.appendChild(option);
    }

    //combine label "select effect" and dropdown
    var selectEffectDiv = document.createElement('div');
    selectEffectDiv.className='column';
    selectEffectDiv.appendChild(effectLabel);
    selectEffectDiv.appendChild(effectSelect);



    //box that holds the inputs, filled with the first effect to start
    var fieldsBox = document.createElement('div');
    fieldsBox.className="fieldBox";
    
    fieldsBox.appendChild(createFields(EFFECTS[effectSelect.value].fields, "effectFields row"));
    updateLfoVisibility(effectRow);

    //when the user picks another effect, replace the inputs
    effectSelect.addEventListener('change', function(){
        fieldsBox.textContent = "";
        fieldsBox.appendChild(createFields(EFFECTS[effectSelect.value].fields, "effectFields row"));
        updateLfoVisibility(effectRow);
        refreshTargetDropdowns(effectRow.closest('.groupCard'));
    });

    //delete button
      var deleteButton = document.createElement('button');
    deleteButton.type = "button";
    // deleteButton.textContent = "- Delete";
    setDeleteIcon(deleteButton); 
    deleteButton.addEventListener('click', function(){
        var card = effectRow.closest('.groupCard');   // get the card BEFORE removing
        effectRow.remove();
        refreshTargetDropdowns(card);
    });



    //put everything in the row, then the row in the list
         // effectRow.appendChild(effectLabel);
    // effectRow.appendChild(subEffectSection);
    effectRow.appendChild(selectEffectDiv);
    effectRow.appendChild(fieldsBox);
    // effectRow.appendChild(effectIdInput);
    effectRow.appendChild(deleteButton);
    effectsListSection.appendChild(effectRow);

    //the row is on the page now, so the targets can include this effect
    updateLfoVisibility(effectRow);
    refreshTargetDropdowns(effectRow.closest('.groupCard'));
}


//Create whole Effects section of a card =====
function createEffectInput(newCard){

    var effectSection = document.createElement('div');
    effectSection.className = "effectSection";

    var title = document.createElement('h4');
    title.textContent = "Effects";

    //the list where effect rows will go
    var effectsListSection = document.createElement('div');
    effectsListSection.className="effectsListSection";

    //add effect button
    var addButton = document.createElement('button');
    addButton.className = "addEffectButton";
    addButton.type = "button";
    addButton.textContent = "+ Add Effect";
    // clicking the button creates a new row of effect inputs
    addButton.addEventListener('click', function(){
        createEffectRow(effectsListSection);
    });

    //something changed inside an effect (id, filter type, LFO box...)
    effectsListSection.addEventListener('input', function(e){
        //the effect dropdown has its own 'change' listener above, skip it here
        if (e.target.classList.contains('effectKind')) { return; }

        //LFO box ticked -> show/hide the LFO fields
        if (e.target.type === 'checkbox') {
            updateLfoVisibility(e.target.closest('.effectRow'));
        }
        //typing a number can't change which targets exist, everything else can
        //   also skip sliders, otherwise dragging one would rebuild the target dropdowns on every pixel
        if (e.target.type !== 'number' && e.target.type !== 'range') {
            refreshTargetDropdowns(newCard);
        }
    });

    effectSection.appendChild(title);
    effectSection.appendChild(effectsListSection);
    effectSection.appendChild(addButton);
    newCard.appendChild(effectSection);
}


//===========PHONE INPUTS=========
//Create whole section for nb of phone input of a card=====
function createPhoneInput(newCard){

        var newPhoneInputSection= document.createElement('div');
        newPhoneInputSection.className="row phoneInputSection";

        // >>> REVERTED: back to the original number input (no slider)
        //create label
        var nbOfPhonesLabel= document.createElement('label');
        nbOfPhonesLabel.textContent="Select a number of phones you want in this group?"

        //create field input
        var nbOfPhoneInput= document.createElement('input');
        nbOfPhoneInput.type="number";
        nbOfPhoneInput.min = "1";
        nbOfPhoneInput.placeholder="3";
        nbOfPhoneInput.dataset.field = "phones";

        newPhoneInputSection.appendChild(nbOfPhonesLabel);
        newPhoneInputSection.appendChild(nbOfPhoneInput);

        newCard.appendChild(newPhoneInputSection);
}


//===========TARGETS (what set/ramp events can change)=========

//info about one effect row (reads the page)
function getEffectInfo(effectRow){
    var kind = effectRow.querySelector('.effectKind').value;   // filter, reverb...
    var jsonType = kind;
    if (kind === "filter") {
        // the first <select> inside the fields is the lowpass/highpass/bandpass one
        var typeSelect = effectRow.querySelector('.effectFields select');
        if (typeSelect) { jsonType = typeSelect.value; }
    }
    var customId = effectRow.querySelector('.effectId').value.trim();
    var lfoBox = effectRow.querySelector('.effectFields input[type="checkbox"]');

    return {
        kind: kind,
        id: customId || jsonType,           // id defaults to the type
        lfoOn: lfoBox ? lfoBox.checked : false
    };
}

//list of every target that exists in this group
function getTargets(card){
    var targets = [{ value: "volume", label: "volume", min: 0, max: 1, step: 0.01, ramp: true }];

    card.querySelectorAll('.effectRow').forEach(function(effectRow){
        var info = getEffectInfo(effectRow);

        EFFECTS[info.kind].targets.forEach(function(t){
            //skip targets that don't apply (frequency vs rate)
            if (t.showWhen === "lfo" && !info.lfoOn) { return; }
            if (t.showWhen === "nolfo" && info.lfoOn) { return; }

            var name = info.id + "." + t.setting;   // e.g. reverb.mix
            targets.push({ value: name, label: name, min: t.min, max: t.max, step: t.step, ramp: t.ramp });   //   step added
        });
    });

    return targets;
}

//=====EVENTS: when a target is chosen, limit the number inputs to that target's range =====
function refreshTargetDropdowns(card){
    if (!card) { return; }
    var targets = getTargets(card);

    card.querySelectorAll('.eventRow').forEach(function(eventRow){
        var select = eventRow.querySelector('.targetSelect');
        if (!select) { return; }   // play/stop rows have no target

        var action = eventRow.querySelector('.eventAction').value;

        //"set" can use every target, "ramp" only the ones that can ramp
        var allowed = targets.filter(function(t){
            return action === "set" || t.ramp;
        });
        var options = allowed.map(function(t){
            return { value: t.value, label: t.label };
        });
        fillSelect(select, options, "Choose target");

        //limit the sliders to the chosen target's range
        var chosen = targets.find(function(t){ return t.value === select.value; });
        //   sliders must always keep a min/max, so with no target chosen we leave the last range as is
        // (before: min/max were removed)
        eventRow.querySelectorAll('.targetLimited').forEach(function(input){
            if (chosen) {
                var previous = Number(input.value);   // remember it: changing min/max makes the browser clamp the value
                input.min = chosen.min;
                input.max = chosen.max;
                input.step = chosen.step;
                // put the old value back, but never outside the new range
                input.value = Math.min(Math.max(previous, chosen.min), chosen.max);
                syncSliderOutput(input);
            }
        });
    });
}


//===========EVENT INPUTS=========
//Create an event row: "at" + "action" + "its inputs" + "delete button" =====
function createEventRow(eventsListSection){

    var eventRow = document.createElement('div');
    eventRow.className = "row eventRow";

    //"at" input (createField works for a plain number too)
    var atDiv = createField({ key: 'at', label: 'At (seconds)', kind: 'number', min: 0, default: 0 });   //   kind: 'number' keeps it a number box, not a slider

    //action dropdown, one option for each action in EVENTS
    var actionDiv = document.createElement('div');
    actionDiv.className="column";
    var actionLabel = document.createElement('label');
    actionLabel.textContent = "Action";
    var actionSelect = document.createElement('select');
    actionSelect.className = "eventAction";

    for (var key in EVENTS) {
        var option = document.createElement('option');
        option.value = key;                   // 'play'
        option.textContent = EVENTS[key].label; // 'Play'
        actionSelect.appendChild(option);
    }
    actionDiv.appendChild(actionLabel);
    actionDiv.appendChild(actionSelect);

    //box that holds the inputs, filled with the first action (play)
    var fieldsBox = document.createElement('div');
    fieldsBox.className="column";
    
    fieldsBox.appendChild(createFields(EVENTS[actionSelect.value].fields, "eventFields row"));

    //delete button
    var deleteButton = document.createElement('button');
    deleteButton.type = "button";
    setDeleteIcon(deleteButton);   //   was deleteButton.textContent = "- Delete";
    deleteButton.addEventListener('click', function(){
        eventRow.remove();
    });

    eventRow.appendChild(atDiv);
    eventRow.appendChild(actionDiv);
    eventRow.appendChild(fieldsBox);
    eventRow.appendChild(deleteButton);
    eventsListSection.appendChild(eventRow);

    var card = eventsListSection.closest('.groupCard');

    //when the action changes, swap the inputs and refill the dropdowns
    actionSelect.addEventListener('change', function(){
        fieldsBox.textContent = "";
        fieldsBox.appendChild(createFields(EVENTS[actionSelect.value].fields, "eventFields row"));
        refreshSoundDropdowns();
        refreshTargetDropdowns(card);
    });

    //fill the new dropdowns right away
    refreshSoundDropdowns();
    refreshTargetDropdowns(card);
}

//Create whole section for event input of a card=====
function createEventInput(newCard){

    var eventSection = document.createElement('div');
    eventSection.className = "eventSection";

    var title = document.createElement('h4');
    title.textContent = "Events";

    var eventsListSection = document.createElement('div');
    eventsListSection.className="eventsListSection";

    var addButton = document.createElement('button');
    addButton.className = "addEventButton";
    addButton.type = "button";
    addButton.textContent = "+ Add Event";

    //when the user clicks the button, create a new row of event inputs
    addButton.addEventListener('click', function(){
        createEventRow(eventsListSection);
    });

    //when a target is chosen, update the min/max of the number inputs
    eventsListSection.addEventListener('input', function(e){
        if (e.target.classList.contains('targetSelect')) {
            refreshTargetDropdowns(newCard);
        }
    });

    eventSection.appendChild(title);
    eventSection.appendChild(eventsListSection);
    eventSection.appendChild(addButton);
    newCard.appendChild(eventSection);
}


//===========CARD CREATION=========
// Create a Card for Group with a title, a phone input, an effect input and event input=====
 function createGroupCard(index){
        //create a single card
        var newCard= document.createElement('div');
        newCard.className="groupCard";

        //Name the card
        var titleGroupeNb = document.createElement('h4');
        titleGroupeNb.textContent="Group "+index;
        newCard.appendChild(titleGroupeNb);

        //add a phone input for each group
        createPhoneInput(newCard);

        //add an effect input for each group
        createEffectInput(newCard);

        //add an event input for each group
        createEventInput(newCard);

        return newCard;
}

//==============ADD GROUP CARD FUNCTION==========
document.getElementById("groupSelection").addEventListener('change', function(){

    //get number of groups selected
    var value = Number(this.value);

    //remove all previous cards
    document.querySelectorAll(".groupCard").forEach(function(card) {
        card.remove();
    });

    //Add cards
    for (let index = 1; index <= value; index++) {
        var card = createGroupCard(index);
        document.getElementById("groupeSection").appendChild(card);
    }
});

// Export functions to be reused by loadJson.js
export {
    refreshSoundDropdowns,
    refreshTargetDropdowns,
    syncSliderOutput   // >>> NEW
};