// Room type definitions, weights, and visual styles

// ─── Room type weights ────────────────────────────────────────────────────────
// 'boss' has weight 0 — it is never randomly assigned, always fixed at the apex.
// All other weights must sum to 100.

const ROOM_TYPES = {
    combat:   { weight: 35, label: 'Combat'       },
    elite:    { weight: 10, label: 'Elite Combat'  },
    shop:     { weight: 12, label: 'Shop'          },
    event:    { weight: 12, label: 'Event'         },
    treasure: { weight:  8, label: 'Treasure'      },
    rest:     { weight:  8, label: 'Rest'          },
    trap:     { weight:  6, label: 'Trap'          },
    ambush:   { weight:  5, label: 'Ambush'        },
    warp:     { weight:  4, label: 'Warp'          },
    boss:     { weight:  0, label: 'Boss'          },
    camp:     { weight:  0, label: 'Camp'          },  // fixed below boss, never random
};

// ─── Visual styles ────────────────────────────────────────────────────────────
// ONE place to change when swapping colours for symbols.
// To add symbols later: fill in the symbol string and update drawRoom() in renderer.js
// to also render style.symbol centred on the triangle.

const ROOM_STYLES = {
    combat:   { color: '#ef4444', symbol: '' },  // red       → sword later
    elite:    { color: '#b91c1c', symbol: '' },  // dark red  → skull later
    shop:     { color: '#a855f7', symbol: '' },  // purple    → coin later
    event:    { color: '#3b82f6', symbol: '' },  // blue      → scroll later
    treasure: { color: '#f59e0b', symbol: '' },  // amber     → chest later
    rest:     { color: '#22c55e', symbol: '' },  // green     → campfire later
    trap:     { color: '#f97316', symbol: '' },  // orange    → spike later
    ambush:   { color: '#7c3aed', symbol: '' },  // violet    → exclamation later
    warp:     { color: '#06b6d4', symbol: '' },  // cyan      → portal later
    boss:     { color: '#ffd700', symbol: '' },  // gold        → crown later
    camp:     { color: '#c2855b', symbol: '' },  // terracotta  → tent/fire later
    unknown:  { color: '#2d3748', symbol: '' },  // dark grey   → fog (not yet generated)
};

// ─── Wrath weights ────────────────────────────────────────────────────────────
// Applied when state.pyramidWrathActive is true (too many rooms visited).
// Trap and ambush surge; treasure and combat fall. Must sum to 100.

const WRATH_ROOM_WEIGHTS = {
    combat:    19,
    elite:     10,
    shop:      12,
    event:     12,
    treasure:   2,
    rest:       8,
    trap:      18,
    ambush:    14,
    warp:       5,
};

// ─── Public helpers ───────────────────────────────────────────────────────────

// Pick a random room type using the weighted odds table — never returns 'boss'.
// Uses wrath weights when state.pyramidWrathActive is true.
function pickRoomType() {
    const entries = Object.entries(ROOM_TYPES)
        .filter(([key]) => key !== 'boss' && key !== 'camp')
        .map(([key, def]) => {
            const w = (state.pyramidWrathActive && WRATH_ROOM_WEIGHTS[key] !== undefined)
                ? WRATH_ROOM_WEIGHTS[key]
                : def.weight;
            return [key, w];
        });

    const totalWeight = entries.reduce((sum, [, w]) => sum + w, 0);
    let roll = Math.random() * totalWeight;
    for (const [key, w] of entries) {
        roll -= w;
        if (roll <= 0) return key;
    }
    return 'combat'; // fallback — should never be reached
}

// Return the fill colour for a room type (or unknown/fog if type is null)
function getRoomColor(type) {
    const style = ROOM_STYLES[type] || ROOM_STYLES.unknown;
    return style.color;
}
