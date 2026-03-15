// Relic system — party-wide passive effects that last the entire run

// Relic class — wraps a RELIC_DATA entry into a live object
class Relic {
    constructor(data) {
        this.key         = data.key;
        this.name        = data.name;
        this.description = data.description;
        this.cursed      = data.cursed      || false;
        this.onApply     = data.onApply     || function () {};
        this.onRemove    = data.onRemove    || function () {};
    }
}

// ─── Public API ───────────────────────────────────────────────────────────────

// Add a relic to the party and immediately fire its onApply hook
function acquireRelic(key) {
    const data = RELIC_DATA[key];
    if (!data) { console.warn('Unknown relic key:', key); return; }
    const relic = new Relic(data);
    state.activeRelics.push(relic);
    relic.onApply(state.party);
    saveRunProgress();
}

// Return true if a relic with the given key is currently active
function hasRelic(key) {
    return state.activeRelics.some(function (r) { return r.key === key; });
}

// Fire onRemove for every active relic and clear the array
// Call this on run end / full reset (not needed during a live run)
function removeAllRelics() {
    for (const relic of state.activeRelics) {
        relic.onRemove(state.party);
    }
    state.activeRelics = [];
}
