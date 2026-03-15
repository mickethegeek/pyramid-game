// All status effect definitions and tick logic

// ─── Definitions ──────────────────────────────────────────────────────────────
// Each effect has: name, color (for UI), duration (default turns),
// and optional onApply / onTick / onExpire callbacks.

const STATUS_EFFECTS = {

    // Poison: light damage over time, medium duration
    poison: {
        name:     'Poison',
        color:    '#a3e635',
        duration: 3,
        onTick(combatant, _effect, log) {
            combatant.takeDamage(3);
            log(combatant.name + ' takes 3 poison damage!');
        },
    },

    // Burn: heavier damage over time, shorter duration
    burn: {
        name:     'Burn',
        color:    '#f97316',
        duration: 2,
        onTick(combatant, _effect, log) {
            combatant.takeDamage(5);
            log(combatant.name + ' takes 5 burn damage!');
        },
    },

    // Stun: skip one turn — combat.js checks combatant.isStunned before acting
    stun: {
        name:     'Stun',
        color:    '#facc15',
        duration: 1,
        onApply(combatant, log) {
            combatant.isStunned = true;
            log(combatant.name + ' is stunned and will skip their turn!');
        },
        onTick(_combatant, _effect, _log) {
            // Stun flag already set on apply; combat loop checks it
        },
        onExpire(combatant, _log) {
            combatant.isStunned = false;
        },
    },

    // Bleed: low damage per turn but lasts longest
    bleed: {
        name:     'Bleed',
        color:    '#dc2626',
        duration: 4,
        onTick(combatant, _effect, log) {
            combatant.takeDamage(2);
            log(combatant.name + ' bleeds for 2 damage!');
        },
    },

    // Taunt: forces enemies to target this combatant — combat.js checks isTaunting
    taunt: {
        name:     'Taunt',
        color:    '#fbbf24',
        duration: 2,
        onApply(combatant, log) {
            combatant.isTaunting = true;
            log(combatant.name + ' taunts the enemy! They must attack them!');
        },
        onTick(_combatant, _effect, _log) {
            // Flag is already set; nothing to do each tick
        },
        onExpire(combatant, log) {
            combatant.isTaunting = false;
            log(combatant.name + "'s taunt fades.");
        },
    },

    // Rage: big DMG boost at the cost of DEF — Barbarian signature
    rage: {
        name:     'Rage',
        color:    '#ef4444',
        duration: 3,
        onApply(combatant, log) {
            modStat(combatant, 'dmg', +5);
            modStat(combatant, 'def', -2);
            log(combatant.name + ' flies into a RAGE! +5 DMG, -2 DEF!');
        },
        onTick(_combatant, _effect, _log) {
            // Bonus is already live in stats; nothing to do each tick
        },
        onExpire(combatant, log) {
            modStat(combatant, 'dmg', -5);
            modStat(combatant, 'def', +2);
            log(combatant.name + "'s rage subsides.");
        },
    },

    // Shield: absorbs the next incoming hit — damageCalc.js checks hasShield
    shield: {
        name:     'Shield',
        color:    '#60a5fa',
        duration: 1,
        onApply(combatant, log) {
            combatant.hasShield = true;
            log(combatant.name + ' is protected by a shield!');
        },
        onTick(_combatant, _effect, _log) {
            // Passive; damageCalc consumes hasShield when a hit lands
        },
        onExpire(combatant, _log) {
            // Remove the flag in case the shield was never hit
            combatant.hasShield = false;
        },
    },

    // Slow: reduces SPD, making the target act later in initiative
    slow: {
        name:     'Slow',
        color:    '#818cf8',
        duration: 3,
        onApply(combatant, log) {
            modStat(combatant, 'spd', -4);
            log(combatant.name + ' is slowed! -4 SPD!');
        },
        onTick(_combatant, _effect, _log) {
            // Penalty is already live in stats; nothing to do each tick
        },
        onExpire(combatant, log) {
            modStat(combatant, 'spd', +4);
            log(combatant.name + ' shakes off the slow.');
        },
    },

    // Bless: heals a small amount of HP each turn
    bless: {
        name:     'Bless',
        color:    '#fde68a',
        duration: 2,
        onTick(combatant, _effect, log) {
            const heal = 4;
            combatant.currentHP = Math.min(combatant.getMaxHP(), combatant.currentHP + heal);
            log(combatant.name + ' is blessed and recovers ' + heal + ' HP!');
        },
    },

    // Curse: reduces DMG dealt while active
    curse: {
        name:     'Curse',
        color:    '#7c3aed',
        duration: 3,
        onApply(combatant, log) {
            modStat(combatant, 'dmg', -3);
            log(combatant.name + ' is cursed! -3 DMG!');
        },
        onTick(_combatant, _effect, _log) {
            // Penalty is already live in stats; nothing to do each tick
        },
        onExpire(combatant, log) {
            modStat(combatant, 'dmg', +3);
            log(combatant.name + "'s curse is lifted.");
        },
    },
};

// ─── Private helper ────────────────────────────────────────────────────────────

// Modify a stat by delta, targeting the correct layer for Character vs Enemy.
// Character uses runBonus (which getStat() already adds in).
// Enemy has no runBonus layer, so we modify baseStats directly instead.
function modStat(combatant, stat, delta) {
    if (combatant.runBonus) {
        // Player character — use the run-bonus layer so base stays clean
        combatant.runBonus[stat] = (combatant.runBonus[stat] || 0) + delta;
    } else {
        // Enemy — modify baseStats directly (reversed on expiry)
        combatant.baseStats[stat] = (combatant.baseStats[stat] || 0) + delta;
    }
}

// ─── Public API ────────────────────────────────────────────────────────────────

// Apply a status effect to a combatant by effect key.
// If the effect is already active, the duration simply resets (no stacking yet).
function applyStatusEffect(combatant, key, log) {
    const def = STATUS_EFFECTS[key];
    if (!def) { console.warn('Unknown status effect key: ' + key); return; }

    // Lazy-init the active effects list
    if (!combatant.activeEffects) combatant.activeEffects = [];

    // If already present, just reset duration — don't double-apply onApply
    const existing = combatant.activeEffects.find(e => e.key === key);
    if (existing) {
        existing.turnsLeft = def.duration;
        return;
    }

    // Add a new effect instance
    const instance = { key, turnsLeft: def.duration };
    combatant.activeEffects.push(instance);

    // Fire the apply callback if defined
    if (def.onApply) def.onApply(combatant, log);
}

// Tick all active effects on a combatant, then remove any that have expired.
// Call this at the very start of the combatant's turn, before they act.
function tickStatusEffects(combatant, log) {
    if (!combatant.activeEffects || combatant.activeEffects.length === 0) return;

    // Tick each effect and decrement its remaining duration
    for (const effect of combatant.activeEffects) {
        const def = STATUS_EFFECTS[effect.key];
        if (def && def.onTick) def.onTick(combatant, effect, log);
        effect.turnsLeft--;
    }

    // Remove effects that have run their course and fire their expiry callbacks
    combatant.activeEffects = combatant.activeEffects.filter(effect => {
        if (effect.turnsLeft <= 0) {
            const def = STATUS_EFFECTS[effect.key];
            if (def && def.onExpire) def.onExpire(combatant, log);
            return false; // drop from array
        }
        return true; // keep active
    });
}

// Return true if a combatant currently has the named effect active
function hasStatusEffect(combatant, key) {
    if (!combatant.activeEffects) return false;
    return combatant.activeEffects.some(e => e.key === key);
}

// Forcibly remove a status effect before it expires (e.g. Shield absorbed a hit)
function removeStatusEffect(combatant, key) {
    if (!combatant.activeEffects) return;
    const idx = combatant.activeEffects.findIndex(e => e.key === key);
    if (idx === -1) return;

    // Fire the expiry callback so stat changes are properly reversed
    const def = STATUS_EFFECTS[key];
    if (def && def.onExpire) def.onExpire(combatant, () => {});

    combatant.activeEffects.splice(idx, 1);
}
