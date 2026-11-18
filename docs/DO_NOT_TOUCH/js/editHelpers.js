// Editing helpers for the form's group cards, from the phase-study score
// editor: copy one group's effects to every group, duplicate an event, and
// sort a group's events by time. form.js adds the buttons and announces the
// clicks (form:* events); this does the work, reading rows the same way the
// download does (generateJson.js) and filling them the way loading does
// (loadJson.js), so a copy is exactly what would be saved and loaded.
import { readEffect, readEvent } from "./generateJson.js";
import { populateEffect, populateEvent } from "./loadJson.js";
import { refreshTargetDropdowns } from "./form.js";

// Copy effects to every group: the others get this group's effect chain
// (replacing theirs); their events keep any target that still exists
document.addEventListener("form:copy-effects", (event) => {
    const source = event.target.closest(".groupCard");
    const effects = [...source.querySelectorAll(".effectRow")].map(readEffect);
    for (const card of document.querySelectorAll(".groupCard")) {
        if (card === source) continue;
        card.querySelectorAll(".effectRow").forEach((row) => row.remove());
        for (const effect of effects) populateEffect(card, JSON.parse(JSON.stringify(effect)));
        refreshTargetDropdowns(card);
    }
});

// Duplicate: a copy of the event, right below it
document.addEventListener("form:duplicate-event", (event) => {
    const row = event.target.closest(".eventRow");
    const card = row.closest(".groupCard");
    const copy = populateEvent(card, readEvent(row)); // added at the end of the list…
    row.after(copy);                                  // …then moved under the original
});

// Sort by time: earliest first; events at the same time keep their order
// (which is also the order the audio engine runs them in)
document.addEventListener("form:sort-events", (event) => {
    const card = event.target.closest(".groupCard");
    const list = card.querySelector(".eventsListSection");
    const rows = [...list.querySelectorAll(":scope > .eventRow")];
    const at = (row) => Number(row.querySelector('[data-field="at"]').value) || 0;
    rows.map((row, i) => ({ row, i, t: at(row) }))
        .sort((a, b) => a.t - b.t || a.i - b.i)
        .forEach(({ row }) => list.appendChild(row));
});
