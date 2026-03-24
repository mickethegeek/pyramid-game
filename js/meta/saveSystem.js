// Save system — persists meta progress and run state to localStorage

// ─── Storage keys ─────────────────────────────────────────────────────────────

const SAVE_KEY_META = 'pyramid_meta';
const SAVE_KEY_RUN  = 'pyramid_run';

// ─── Default state factories ──────────────────────────────────────────────────

// Return a fresh meta save — warrior starts discovered, everything else at zero
function defaultMeta() {
    return {
        discoveredClasses:  ['warrior'],
        discoveredSkills:   [], // skill keys seen at least once across all runs
        soulShards:         0,
        permanentUpgrades:  {}, // e.g. { warrior: { hp: 1, dmg: 2 } }
        generalUpgrades:    {}, // e.g. { goldCarry: 2, startingPartySize: 1 }
    };
}

// ─── Meta save — persists forever ─────────────────────────────────────────────

// Write the meta object to localStorage
function saveMetaProgress(meta) {
    try {
        localStorage.setItem(SAVE_KEY_META, JSON.stringify(meta));
    } catch (e) {
        console.warn('Could not save meta progress:', e);
    }
}

// Read and return the meta object, or create a fresh one if none exists
function loadMetaProgress() {
    try {
        const raw = localStorage.getItem(SAVE_KEY_META);
        if (raw) {
            const parsed = JSON.parse(raw);
            // Migration: add discoveredSkills to saves that predate the skill system
            if (!parsed.discoveredSkills) parsed.discoveredSkills = [];
            return parsed;
        }
    } catch (e) {
        console.warn('Could not load meta progress:', e);
    }
    return defaultMeta();
}

// ─── Run save — persists until the run ends ───────────────────────────────────

// Serialise the current run state and write it to localStorage
function saveRunProgress() {
    try {
        const runData = {
            actNumber:          state.actNumber,
            pyramidWrathActive: state.pyramidWrathActive || false,
            currentRoom: { layer: state.currentRoom.layer, index: state.currentRoom.index },
            pyramid:     serialisePyramid(state.pyramid),
            party:       state.party.map(serialisePlayer),
            player:      serialisePlayer(state.player),  // kept for backwards-compat
            inventory:    state.inventory.map(serialiseItem),
            gold:         state.gold,
            relics:       state.activeRelics.map(function (r) { return r.key; }),
            partyPotions: state.partyPotions.slice(),
            actShopCount: state.actShopCount || 0,
            actRelicA:    state.actRelicA    || null,
            actRelicB:    state.actRelicB    || null,
        };
        localStorage.setItem(SAVE_KEY_RUN, JSON.stringify(runData));
    } catch (e) {
        console.warn('Could not save run progress:', e);
    }
}

// Return the raw run save object, or null if none exists
function loadRunSave() {
    try {
        const raw = localStorage.getItem(SAVE_KEY_RUN);
        return raw ? JSON.parse(raw) : null;
    } catch (e) {
        console.warn('Could not load run save:', e);
        return null;
    }
}

// Delete the run save (call on death or after completing the final boss)
function clearRunSave() {
    localStorage.removeItem(SAVE_KEY_RUN);
}

// ─── Serialisation helpers ────────────────────────────────────────────────────

// Convert the pyramid to a flat array of { layer, index, type, visited }
function serialisePyramid(pyramid) {
    const rooms = [];
    for (const layer of pyramid) {
        for (const room of layer) {
            rooms.push({
                layer:   room.layer,
                index:   room.index,
                type:    room.type,
                visited: room.visited,
            });
        }
    }
    return rooms;
}

// Serialise a single item to a plain object (or null) for storage
function serialiseItem(item) {
    if (!item) return null;
    return {
        key:           item.key,
        name:          item.name,
        type:          item.type,
        rarity:        item.rarity,
        description:   item.description,
        statBonus:     Object.assign({}, item.statBonus),
        passiveKey:    item.passiveKey,
        passiveDesc:   item.passiveDesc,
        suffixNegative: item.suffixNegative || false,
    };
}

// Convert the player to a plain object with only what we need to restore
function serialisePlayer(player) {
    return {
        classKey:    player.classKey,
        currentHP:   player.currentHP,
        currentMana: player.currentMana,
        runBonus:    player.runBonus || {},
        equipment: {
            weapon:    serialiseItem(player.equipment.weapon),
            armor:     serialiseItem(player.equipment.armor),
            accessory: serialiseItem(player.equipment.accessory),
        },
    };
}

// ─── Restoration helpers ──────────────────────────────────────────────────────

// Map of class key → factory function (populated after class files load)
// Used by applyRunSave to recreate the correct player subclass.
// Each class file registers itself here via registerClassFactory().
const CLASS_FACTORIES = {};

// Register a factory so saveSystem can recreate players on load
function registerClassFactory(key, factoryFn) {
    CLASS_FACTORIES[key] = factoryFn;
}

// Rebuild pyramid structure, then overlay saved type/visited data
function applyRunSave(runData) {
    // Rebuild the full structure (positions/orientations) fresh
    const pyramid = generatePyramid(PYRAMID_LAYERS);

    // Overlay saved type and visited state room-by-room
    for (const saved of runData.pyramid) {
        const room = pyramid[saved.layer - 1][saved.index];
        room.type    = saved.type;
        room.visited = saved.visited;
    }

    // Restore navigation state
    state.pyramid       = pyramid;
    state.currentRoom   = pyramid[runData.currentRoom.layer - 1][runData.currentRoom.index];
    state.adjacentRooms = getAdjacentRooms(pyramid, state.currentRoom);
    state.actNumber          = runData.actNumber;
    state.pyramidWrathActive = runData.pyramidWrathActive || false;
    state.gold               = runData.gold || 0;
    state.inventory     = (runData.inventory || []).map(restoreItem).filter(Boolean);
    state.partyPotions  = (runData.partyPotions || []).slice();
    state.actShopCount  = runData.actShopCount || 0;
    state.actRelicA     = runData.actRelicA    || null;
    state.actRelicB     = runData.actRelicB    || null;

    // Restore relic objects from saved keys — do NOT re-call onApply (runBonus already saved)
    state.activeRelics  = (runData.relics || []).map(function (key) {
        const data = RELIC_DATA[key];
        return data ? new Relic(data) : null;
    }).filter(Boolean);

    // Recreate all party members — fall back to single player if party array absent (old saves)
    const savedParty = runData.party || (runData.player ? [runData.player] : []);
    state.party = [];

    for (const savedMember of savedParty) {
        const factory = CLASS_FACTORIES[savedMember.classKey];
        if (!factory) continue;

        const member    = factory();
        member.runBonus = savedMember.runBonus || {};

        // Restore equipped items before HP so getStat reads the right values
        const eq = savedMember.equipment || {};
        member.equipment.weapon    = restoreItem(eq.weapon);
        member.equipment.armor     = restoreItem(eq.armor);
        member.equipment.accessory = restoreItem(eq.accessory);

        member.currentHP   = savedMember.currentHP;
        member.currentMana = savedMember.currentMana;
        state.party.push(member);
    }

    state.player = state.party[0] || null;
}
