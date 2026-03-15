// Base character class — shared by all 7 player classes

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
        this.equipment = { weapon: null, armor: null, accessory: null };

        // ── Current resources ────────────────────────────────────────────────
        // Both start at their maximum; mana does NOT reset between fights
        this.currentHP   = this.getStat('hp');
        this.currentMana = this.getMaxMana();

        // ── Status effect state ──────────────────────────────────────────────
        // activeEffects is managed by statusEffects.js via addStatusEffect / tickStatusEffects
        this.activeEffects = [];

        // Flags written by status effects; read by combat.js and damageCalc.js
        this.isStunned  = false;   // set by Stun effect — skip this turn
        this.isTaunting = false;   // set by Taunt effect — enemies must target this character
        this.hasShield  = false;   // set by Shield effect — absorbs the next incoming hit
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

    // Reduce HP by amount — if a Shield is active it absorbs the hit entirely
    takeDamage(amount, log) {
        if (this.hasShield) {
            removeStatusEffect(this, 'shield');
            if (log) log(this.name + "'s shield absorbs the attack completely!");
            return;
        }
        this.currentHP = Math.max(0, this.currentHP - amount);
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
