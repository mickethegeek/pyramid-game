// Base character class — shared by all 7 player classes

// ─── Offhand rules ────────────────────────────────────────────────────────────

// Which item types each class may equip in the offhand slot.
// Warrior may also equip 'weapon' in offhand (dual wield) — checked separately in canEquipOffhand.
const OFFHAND_RULES = {
    warrior:   ['weapon', 'shield'],
    barbarian: ['orb'],
    paladin:   ['shield'],
    archer:    ['quiver'],
    cleric:    ['tome', 'orb'],
    wizard:    ['tome', 'orb'],
    summoner:  ['orb', 'focus'],
};

// All item types that belong in the offhand slot rather than the main weapon/armor/accessory slots
const OFFHAND_TYPES = ['shield', 'tome', 'orb', 'quiver', 'focus'];

// Returns true if the character is allowed to put item into their offhand slot
function canEquipOffhand(character, item) {
    const rules = OFFHAND_RULES[character.classKey];

    // Class has no offhand rules defined
    if (!rules) {
        console.log(`[canEquipOffhand] FAIL — ${character.classKey} has no offhand rules`);
        return false;
    }

    // Item type must be in this class's allowed offhand types
    if (!rules.includes(item.type)) {
        console.log(`[canEquipOffhand] FAIL — ${character.classKey} cannot use "${item.type}" in offhand`);
        return false;
    }

    // Warrior dual-wield: a weapon in the offhand requires a weapon already in the main slot
    if (character.classKey === 'warrior' && item.type === 'weapon') {
        if (!character.equipment.weapon) {
            console.log(`[canEquipOffhand] FAIL — Warrior must have a main weapon equipped before dual-wielding`);
            return false;
        }
    }

    return true;
}

class Character {

    // Build a character with a display name and a baseStats object
    constructor(name, baseStats) {
        this.name  = name;
        this.level = 1;

        // ── Three-layer stat system ──────────────────────────────────────────
        // Final stat = base + permanent + runBonus
        // Spread baseStats so we never mutate the original class constant.
        // Any stat not supplied defaults to 0.
        this.baseStats = {
            hp:   0, def:  0, dmg:  0,
            dex:  0, spd:  0, int:  0, luck: 0,
            ...baseStats,
        };

        // Permanent bonuses: added by meta-upgrades, persist across all runs
        this.permanentBonus = { hp: 0, def: 0, dmg: 0, dex: 0, spd: 0, int: 0, luck: 0 };

        // Run bonuses: gained from levelling and equipment, lost on death
        this.runBonus = { hp: 0, def: 0, dmg: 0, dex: 0, spd: 0, int: 0, luck: 0 };

        // Equipment slots — each holds an Item instance or null
        // offhand: shield / tome / orb / quiver / focus, or a second weapon for warrior dual-wield
        this.equipment = { weapon: null, armor: null, accessory: null, offhand: null };

        // ── Current resources ────────────────────────────────────────────────
        // Both start at their maximum; mana does NOT reset between fights
        this.currentHP   = this.getStat('hp');
        this.currentMana = this.getMaxMana();

        // ── Stamina resource ─────────────────────────────────────────────────
        // Physical classes override these to non-zero values in their constructors.
        // Casters leave them at 0 (no stamina system at all for them).
        this.maxStamina     = 0;
        this.currentStamina = 0;
        this.staminaRegen   = 0;

        // ── Row ──────────────────────────────────────────────────────────────
        // 'front' | 'back' — used by damageCalc for row modifiers.
        // Back row enemies will be set explicitly in room compositions.
        this.row = 'front';

        // ── Aggro ────────────────────────────────────────────────────────────
        // Tracks threat generated this combat — used for future targeting logic.
        this.aggro = 0;

        // ── Status effect state ──────────────────────────────────────────────
        // activeEffects is managed by statusEffects.js via addStatusEffect / tickStatusEffects
        this.activeEffects = [];

        // Flags written by status effects; read by combat.js and damageCalc.js
        this.isStunned  = false;   // set by Stun effect — skip this turn
        this.isTaunting = false;   // set by Taunt effect — enemies must target this character
        this.hasShield  = false;   // set by Shield effect — absorbs the next incoming hit
        this.isSilenced  = false;  // set by enemy abilities — cannot use abilities this turn
        this.wasSilenced = false;  // captured at turn start before clearing (checked in executePlayerAbility)

        // ── Skills ───────────────────────────────────────────────────────────
        // baseSkill: the class's locked slot-1 skill key (set by each class constructor)
        // equippedSkills: open slots filled from the shared skill inventory
        // skillLevels: tracks each skill's current level for this character { skillKey: level }
        this.baseSkill      = null;
        this.equippedSkills = [];
        this.skillLevels    = {};
    }

    // ── Stat accessors ───────────────────────────────────────────────────────

    // Sum the stat bonuses from all currently equipped items
    getEquipmentBonus(stat) {
        let bonus = 0;
        for (const item of Object.values(this.equipment)) {
            if (item) bonus += (item.statBonus[stat] || 0);
        }
        return bonus;
    }

    // Return the final value of a stat: base + permanent + run + equipment bonuses
    getStat(stat) {
        return (this.baseStats[stat]      || 0)
             + (this.permanentBonus[stat] || 0)
             + (this.runBonus[stat]       || 0)
             + this.getEquipmentBonus(stat);
    }

    // Return the character's maximum HP
    getMaxHP() {
        return this.getStat('hp');
    }

    // Return the character's maximum mana pool (INT × 5)
    getMaxMana() {
        return this.getStat('int') * 5;
    }

    // ── HP and mana ──────────────────────────────────────────────────────────

    // Reduce HP by amount — if a Shield is active it absorbs the hit entirely;
    // if deathImmune is set (Last Stand), survive at 1 HP and consume the flag
    takeDamage(amount, log) {
        if (this.hasShield) {
            removeStatusEffect(this, 'shield');
            if (log) log(this.name + "'s shield absorbs the attack completely!");
            return;
        }
        const newHP = this.currentHP - amount;
        if (newHP <= 0 && this.deathImmune) {
            this.currentHP = 1;
            this.deathImmune = false;
            if (log) log(this.name + "'s Last Stand keeps them alive at 1 HP!");
            return;
        }
        this.currentHP = Math.max(0, newHP);
    }

    // Return true if this character is still alive
    isAlive() {
        return this.currentHP > 0;
    }

    // Regenerate mana by INT/10 (minimum 1) — called at the start of each turn
    regenMana() {
        const regen = Math.max(1, Math.floor(this.getStat('int') / 10));
        this.currentMana = Math.min(this.getMaxMana(), this.currentMana + regen);
    }

    // Return true if the character can afford an ability's mana cost
    hasMana(cost) {
        return this.currentMana >= cost;
    }

    // Deduct a mana cost — call this right before resolving an ability
    spendMana(cost) {
        this.currentMana = Math.max(0, this.currentMana - cost);
    }

    // ── Stamina ──────────────────────────────────────────────────────────────

    // Regenerate stamina by staminaRegen per turn — no-op for casters (maxStamina = 0)
    regenStamina() {
        this.currentStamina = Math.min(this.maxStamina, this.currentStamina + this.staminaRegen);
    }

    // Return true if the character can afford a stamina cost
    hasStamina(cost) {
        return this.currentStamina >= cost;
    }

    // Deduct a stamina cost — call this right before resolving a physical ability
    spendStamina(cost) {
        this.currentStamina = Math.max(0, this.currentStamina - cost);
    }

    // ── Levelling ────────────────────────────────────────────────────────────

    // Increase the character's level and add generic run-bonus stat growth.
    // Individual class files can override this for class-specific growth rates.
    levelUp() {
        this.level++;
        this.runBonus.hp  += 2;
        this.runBonus.dmg += 1;
        this.runBonus.def += 1;

        // Grant the extra HP immediately (partial heal on level-up)
        this.currentHP = Math.min(this.currentHP + 2, this.getMaxHP());
    }

    // ── Status effects ───────────────────────────────────────────────────────

    // Apply a status effect to this character by key — delegates to statusEffects.js
    addStatusEffect(key, log) {
        applyStatusEffect(this, key, log);
    }

    // Tick all active status effects — call this at the start of each turn.
    // Delegates to the free function tickStatusEffects() in statusEffects.js.
    tickStatusEffects(log) {
        tickStatusEffects(this, log);
    }
}
