// Loot table — rarity weights, item creation, and post-combat drop logic

// ─── Rarity weights ────────────────────────────────────────────────────────────

const RARITY_WEIGHTS = {
    common:    60,
    uncommon:  25,
    rare:      12,
    legendary:  3,
};

// ─── Rarity pools ─────────────────────────────────────────────────────────────
// Built once at load time — avoids scanning ITEM_DATA on every drop roll

const RARITY_POOLS = { common: [], uncommon: [], rare: [], legendary: [] };

(function buildPools() {
    for (const key of Object.keys(ITEM_DATA)) {
        const rarity = ITEM_DATA[key].rarity;
        if (RARITY_POOLS[rarity]) RARITY_POOLS[rarity].push(key);
    }
}());

// ─── Item factory ─────────────────────────────────────────────────────────────

// Create and return an Item instance from a key in ITEM_DATA
function createItem(key) {
    const data = ITEM_DATA[key];
    if (!data) throw new Error('Unknown item key: ' + key);
    return new Item({ key, ...data });
}

// ─── Roll logic ───────────────────────────────────────────────────────────────

// Pick a rarity using weighted random selection
function rollRarity() {
    const total = Object.values(RARITY_WEIGHTS).reduce((s, w) => s + w, 0);
    let roll = Math.random() * total;
    for (const [rarity, weight] of Object.entries(RARITY_WEIGHTS)) {
        roll -= weight;
        if (roll <= 0) return rarity;
    }
    return 'common'; // fallback — should never be reached
}

// Roll a random item key from the given rarity pool
// Falls back to common if the pool is somehow empty
function rollItemFromRarity(rarity) {
    const pool = RARITY_POOLS[rarity];
    if (!pool || pool.length === 0) {
        const fallback = RARITY_POOLS.common;
        return fallback[Math.floor(Math.random() * fallback.length)];
    }
    return pool[Math.floor(Math.random() * pool.length)];
}

// ─── Public API ───────────────────────────────────────────────────────────────

// Roll once on the loot table and return a procedurally generated Item
function rollLoot() {
    return generateItem();
}

// Roll for loot, push it into the shared inventory, and return the item
// Call this after every combat victory so main.js can show the item name
function awardLoot() {
    const item = rollLoot();
    state.inventory.push(item);
    return item;
}

// Restore an Item from serialised save data — handles both old key-based saves
// and the new full-object format used by generated items.
function restoreItem(data) {
    if (!data) return null;
    // Legacy format: bare string key (old equipment slots)
    if (typeof data === 'string') return createItem(data);
    // Old-style key in ITEM_DATA (saved before procedural generation)
    if (data.key && ITEM_DATA[data.key]) return createItem(data.key);
    // New format: full serialised object for generated items
    return new Item(data);
}

// ─── Passive helpers ──────────────────────────────────────────────────────────

// Return true if any of the character's equipped accessories has the given passiveKey
function hasPassive(character, passiveKey) {
    for (const item of Object.values(character.equipment)) {
        if (item && item.passiveKey === passiveKey) return true;
    }
    return false;
}

// ─── Rarity display helpers ───────────────────────────────────────────────────

// Capitalise the first letter of a rarity string for display
function rarityLabel(rarity) {
    return rarity.charAt(0).toUpperCase() + rarity.slice(1);
}

// Return a colour string for a given rarity — used by UI screens
function rarityColor(rarity) {
    const colors = {
        common:    '#cccccc',
        uncommon:  '#4ade80',
        rare:      '#60a5fa',
        legendary: '#ffd700',
    };
    return colors[rarity] || '#ccc';
}
