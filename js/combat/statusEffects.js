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
            if (lastStack(combatant, 'stun')) combatant.isStunned = false;
        },
    },

    // Bleed: low damage per turn but lasts longest.
    // Supports instance overrides: effect.damage (default 2), effect.bleedLinkedToPin (expiry tied to Pinned).
    bleed: {
        name:     'Bleed',
        color:    '#dc2626',
        duration: 4,
        onTick(combatant, effect, log) {
            // Pin-linked bleed (Pinning Shot): expire the moment the pin wears off
            if (effect.bleedLinkedToPin && !combatant.isPinned) {
                effect.turnsLeft = 0;
                return;
            }
            const dmg = effect.damage || 2;
            combatant.takeDamage(dmg);
            log(combatant.name + ' bleeds for ' + dmg + ' damage!');
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
            if (lastStack(combatant, 'taunt')) {
                combatant.isTaunting = false;
                log(combatant.name + "'s taunt fades.");
            }
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
            // Only clear if no other shield stack remains
            if (lastStack(combatant, 'shield')) combatant.hasShield = false;
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

    // Blind: 35% chance each turn to miss attacks — roll happens in basicAttack (actions.js)
    blind: {
        name:     'Blind',
        color:    '#6b7280',
        duration: 2,
        onApply(combatant, log) {
            combatant.isBlinded = true;
            log(combatant.name + ' is blinded! Their attacks may miss!');
        },
        onTick(_combatant, _effect, _log) {
            // Flag already set on apply; miss roll is in basicAttack (actions.js)
        },
        onExpire(combatant, log) {
            if (lastStack(combatant, 'blind')) {
                combatant.isBlinded = false;
                log(combatant.name + "'s vision clears.");
            }
        },
    },

    // Arcane Burn: magic DoT that bypasses DEF entirely.
    // instance.damagePerTurn — damage written directly to HP each tick (no armor, no dodge).
    // instance.duration      — overrides the default duration when set by the applying skill.
    arcane_burn: {
        name:     'Arcane Burn',
        color:    '#a78bfa',
        duration: 3,
        onApply(combatant, _log, instance) {
            // Allow the applying skill to set a custom duration per level
            if (instance.duration !== undefined) instance.turnsLeft = instance.duration;
            // Store damage on the combatant; overwritten if a higher-level stack is applied later
            combatant.arcane_burnDamage = instance.damagePerTurn || 0;
        },
        onTick(combatant, _effect, log) {
            // Bypass applyDamage — write directly to HP so DEF is never subtracted
            const damage = combatant.arcane_burnDamage || 0;
            combatant.currentHP = Math.max(0, combatant.currentHP - damage);
            log(combatant.name + ' suffers ' + damage + ' Arcane Burn damage!');
        },
        onExpire(combatant, _log) {
            combatant.arcane_burnDamage = 0;
        },
    },

    // Pinned: melee enemies skip their attack this turn — ranged/caster are unaffected
    pinned: {
        name:     'Pinned',
        color:    '#78716c',
        duration: 2,
        onApply(combatant, log) {
            combatant.isPinned = true;
            log(combatant.name + ' is pinned and cannot advance!');
        },
        onTick(_combatant, _effect, _log) {
            // Flag already set; melee skip is checked in executeEnemyTurn (combat.js)
        },
        onExpire(combatant, log) {
            if (lastStack(combatant, 'pinned')) {
                combatant.isPinned = false;
                log(combatant.name + ' breaks free from the pin!');
            }
        },
    },

    // Sacred: allies receive 30% stronger heals; enemies take 30% more from holy-tagged skills
    sacred: {
        name:     'Sacred',
        color:    '#fef08a',
        duration: 3,
        onApply(combatant, log) {
            combatant.isSacred = true;
            log(combatant.name + ' is bathed in Sacred light!');
        },
        onTick(_combatant, _effect, _log) {
            // Passive flag — healing code multiplies by 1.3 for allies;
            // holy abilities multiply damage by 1.3 for enemies, both check isSacred
        },
        onExpire(combatant, log) {
            if (lastStack(combatant, 'sacred')) {
                combatant.isSacred = false;
                log(combatant.name + "'s Sacred aura fades.");
            }
        },
    },

    // Fortify: +10 DEF for 1 turn — applied when a passive-personality enemy defends
    fortify: {
        name:     'Fortified',
        color:    '#60a5fa',
        duration: 1,
        onApply(combatant, log) {
            modStat(combatant, 'def', +10);
            log(combatant.name + ' fortifies its defenses! (+10 DEF)');
        },
        onTick(_combatant, _effect, _log) {},
        onExpire(combatant, _log) {
            modStat(combatant, 'def', -10);
        },
    },

    // Harden: +15 DEF for 2 turns — Mud Golem's Harden ability
    harden: {
        name:     'Hardened',
        color:    '#78716c',
        duration: 2,
        onApply(combatant, log) {
            modStat(combatant, 'def', +15);
            log(combatant.name + ' hardens! (+15 DEF for 2 turns)');
        },
        onTick(_combatant, _effect, _log) {},
        onExpire(combatant, log) {
            modStat(combatant, 'def', -15);
            log(combatant.name + "'s hardened shell crumbles.");
        },
    },

    // Bloat: +10 DEF and -4 SPD for 2 turns — Swamp Crawler's Bloat ability
    bloat: {
        name:     'Bloated',
        color:    '#6b7280',
        duration: 2,
        onApply(combatant, log) {
            modStat(combatant, 'def', +10);
            modStat(combatant, 'spd', -4);
            log(combatant.name + ' bloats up! (+10 DEF, -4 SPD for 2 turns)');
        },
        onTick(_combatant, _effect, _log) {},
        onExpire(combatant, log) {
            modStat(combatant, 'def', -10);
            modStat(combatant, 'spd', +4);
            log(combatant.name + "'s bloat subsides. (-10 DEF, +4 SPD)");
        },
    },

    // Embolden: dynamic DMG bonus stored per-instance — Bog Witch Cackle ability.
    // Each stack carries its own bonus amount so multiple cackles reverse independently.
    embolden: {
        name:     'Emboldened',
        color:    '#f97316',
        duration: 2,
        onApply(combatant, _log, instance) {
            // instance.bonus is set by the caller via applyStatusEffect(..., { bonus })
            modStat(combatant, 'dmg', +instance.bonus);
        },
        onTick(_combatant, _effect, _log) {},
        onExpire(combatant, log, instance) {
            modStat(combatant, 'dmg', -instance.bonus);
            log(combatant.name + "'s emboldened effect fades.");
        },
    },

    // Iron Will: temporary damage reduction buff from the Warrior skill
    // instance.damageReduction (0.40 or 0.60) and optional instance.defBonus are set by the skill
    iron_will_buff: {
        name:     'Iron Will',
        color:    '#94a3b8',
        duration: 1,
        onApply(combatant, log, instance) {
            combatant.damageReduction = instance.damageReduction || 0.40;
            if (instance.defBonus) modStat(combatant, 'def', instance.defBonus);
            log(combatant.name + ' steels themselves — incoming damage reduced by ' +
                Math.round(combatant.damageReduction * 100) + '%!');
        },
        onTick(combatant, _effect, _log) {
            // Grant a guaranteed crit on next Power Strike if HP is critically low
            if (combatant.currentHP < combatant.getMaxHP() * 0.30) {
                combatant.ironWillCrit = true;
            }
        },
        onExpire(combatant, log, instance) {
            combatant.damageReduction = 0;
            if (instance.defBonus) modStat(combatant, 'def', -instance.defBonus);
            log(combatant.name + "'s Iron Will fades.");
        },
    },

    // Battle Hardened: short DEF buff applied by Shield Bash at levels 2+
    // instance.damageReduction is set by the skill (0.10 or 0.20)
    battle_hardened: {
        name:     'Battle Hardened',
        color:    '#60a5fa',
        duration: 1,
        onApply(combatant, log, instance) {
            combatant.damageReduction = instance.damageReduction || 0.10;
            log(combatant.name + ' braces hard — incoming damage reduced by ' +
                Math.round(combatant.damageReduction * 100) + '%!');
        },
        onTick(_combatant, _effect, _log) {},
        onExpire(combatant, log) {
            combatant.damageReduction = 0;
            log(combatant.name + "'s Battle Hardened buff fades.");
        },
    },

    // Last Stand: one-turn death immunity + damage boost applied by the Warrior skill
    // instance.dmgBonus is the flat DMG added (stored so onExpire can reverse it exactly)
    last_stand_buff: {
        name:     'Last Stand',
        color:    '#dc2626',
        duration: 1,
        onApply(combatant, log, instance) {
            combatant.deathImmune = true;
            const dmgBonus = Math.max(1, Math.floor(combatant.getStat('dmg') * 0.5));
            instance.dmgBonus = dmgBonus;
            modStat(combatant, 'dmg', dmgBonus);
            log(combatant.name + ' makes their Last Stand! Immune to death and +' + dmgBonus + ' DMG!');
        },
        onTick(_combatant, _effect, _log) {},
        onExpire(combatant, log, instance) {
            if (combatant.deathImmune) combatant.deathImmune = false;
            modStat(combatant, 'dmg', -instance.dmgBonus);
            log(combatant.name + "'s Last Stand fades.");
        },
    },

    // Retribution: reflects a configurable fraction of raw incoming damage back at the attacker.
    // instance.reflectFraction  — how much to reflect (default 0.20)
    // instance.armorPierce      — if true the reflected hit bypasses attacker DEF
    // instance.martyrs          — if true, reflect surges to 100% when carrier drops below 25% HP
    retribution: {
        name:     'Retribution',
        color:    '#f59e0b',
        duration: 3,
        onApply(combatant, _log, instance) {
            combatant.retributionReflect    = instance.reflectFraction ?? 0.20;
            combatant.retributionArmorPierce = instance.armorPierce   ?? false;
            combatant.retributionMartyrs    = instance.martyrs        ?? false;
            _log(combatant.name + ' crackles with Retribution! ' +
                Math.round((instance.reflectFraction ?? 0.20) * 100) + '% of incoming damage is reflected!');
        },
        onTick(_combatant, _effect, _log) {
            // Reflection is handled in applyDamage (damageCalc.js) on each incoming hit
        },
        onExpire(combatant, log) {
            if (lastStack(combatant, 'retribution')) {
                combatant.retributionReflect     = 0;
                combatant.retributionArmorPierce = false;
                combatant.retributionMartyrs     = false;
                log(combatant.name + "'s Retribution fades.");
            }
        },
    },

    // Temp shield: absorbs incoming damage using a temp HP pool until depleted.
    // instance.amount          — temp HP to add
    // instance.damageReduction — flat DR applied while shield holds (default 0)
    // instance.fortress        — if true, stuns the attacker when the shield breaks
    // Duration is effectively permanent — removed manually in damageCalc.js when tempHP hits 0.
    temp_shield: {
        name:     'Shield',
        color:    '#60a5fa',
        duration: Infinity,
        onApply(combatant, log, instance) {
            combatant.tempHP             = (combatant.tempHP || 0) + instance.amount;
            combatant.shieldDamageReduction = instance.damageReduction ?? 0;
            combatant.shieldFortress     = instance.fortress ?? false;
            log(combatant.name + ' is shielded for ' + instance.amount + ' temp HP!');
        },
        onTick(_combatant, _effect, _log) {},
        onExpire(combatant, _log) {
            combatant.tempHP             = 0;
            combatant.shieldDamageReduction = 0;
            combatant.shieldFortress     = false;
        },
    },
};

// ─── Private helpers ───────────────────────────────────────────────────────────

// Return true if this is the only remaining stack of key on the combatant.
// Used by flag-based onExpire callbacks so the flag is only cleared on the last stack.
// The expiring instance is still in activeEffects when onExpire fires, so <= 1 is correct.
function lastStack(combatant, key) {
    return (combatant.activeEffects || []).filter(e => e.key === key).length <= 1;
}

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
// options: optional extra data merged into the instance (e.g. { bonus: 5 } for embolden).
// The instance is passed as a third arg to onApply/onExpire so effects can read stored data.
function applyStatusEffect(combatant, key, log, options) {
    const def = STATUS_EFFECTS[key];
    if (!def) { console.warn('Unknown status effect key: ' + key); return; }

    // Lazy-init the active effects list
    if (!combatant.activeEffects) combatant.activeEffects = [];

    // Merge any extra data into the instance so callbacks (e.g. embolden) can read it on expire
    const instance = { key, turnsLeft: def.duration, ...(options || {}) };
    combatant.activeEffects.push(instance);

    // Fire the apply callback if defined — passes instance so dynamic effects can initialise
    if (def.onApply) def.onApply(combatant, log, instance);
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

    // Remove effects that have run their course and fire their expiry callbacks.
    // The instance is passed as third arg so effects like embolden can read stored data (e.g. bonus).
    combatant.activeEffects = combatant.activeEffects.filter(effect => {
        if (effect.turnsLeft <= 0) {
            const def = STATUS_EFFECTS[effect.key];
            if (def && def.onExpire) def.onExpire(combatant, log, effect);
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

    // Pass the instance so expiry callbacks (e.g. embolden) can read stored data
    const instance = combatant.activeEffects[idx];
    const def = STATUS_EFFECTS[key];
    if (def && def.onExpire) def.onExpire(combatant, () => {}, instance);

    combatant.activeEffects.splice(idx, 1);
}
