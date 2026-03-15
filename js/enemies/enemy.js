// Base enemy class — mirrors the Character interface so combat logic works for both

class Enemy {

    // Build an enemy from a definition object (pulled from ENEMY_DATA)
    constructor(data) {
        this.name  = data.name;
        this.intro = data.intro || null;  // optional flavour text shown at combat start

        // Enemies use flat base stats only — no permanent or run bonus layers
        this.baseStats = {
            hp: 0, def: 0, dmg: 0,
            dex: 0, spd: 0, int: 0, luck: 0,
            ...data.stats,
        };

        // Current HP starts at max
        this.currentHP = this.getStat('hp');

        // ── Status effect state ──────────────────────────────────────────────
        // Managed by statusEffects.js — same system as characters
        this.activeEffects = [];

        // Flags written by status effects; read by combat.js and damageCalc.js
        this.isStunned  = false;   // set by Stun — skip this enemy's turn
        this.isTaunting = false;   // set by Taunt — unused for enemies but kept for symmetry
        this.hasShield  = false;   // set by Shield — absorbs the next hit
    }

    // ── Stat accessor ────────────────────────────────────────────────────────

    // Return a stat value — enemies have no permanent or run bonuses
    getStat(stat) {
        return this.baseStats[stat] || 0;
    }

    // Return the enemy's maximum HP
    getMaxHP() {
        return this.getStat('hp');
    }

    // ── HP management ────────────────────────────────────────────────────────

    // Reduce HP by amount — if a Shield is active it absorbs 70% of hit instead
        takeDamage(amount, log) {
        if (this.hasShield) {
            // Shield consumes itself and blocks 70% of damage
            const blocked = Math.floor(amount * 0.7);
            const remaining = amount - blocked; 
            removeStatusEffect(this, 'shield');
            if (log) log(this.name + "'s shield blocks " + blocked + " damage! (" + remaining + " gets through)");
            this.currentHP = Math.max(0, this.currentHP - remaining);
            return;
        }
        this.currentHP = Math.max(0, this.currentHP - amount);
    }


    // Return true if the enemy is still alive
    isAlive() {
        return this.currentHP > 0;
    }

    // ── Status effects ───────────────────────────────────────────────────────

    // Apply a status effect to this enemy — delegates to statusEffects.js
    addStatusEffect(key, log) {
        applyStatusEffect(this, key, log);
    }

    // Tick all active status effects — call at the start of each enemy turn
    tickStatusEffects(log) {
        tickStatusEffects(this, log);
    }
}

// Act difficulty multipliers — applied to HP, DEF, and DMG only
const ACT_MULTIPLIERS = { 1: 1.0, 2: 1.5, 3: 2.0 };

// Create an array of Enemy instances from an array of keys, all scaled for the current act
function createEnemyGroup(keys, actNumber) {
    return keys.map(key => createEnemy(key, actNumber));
}

// Create an Enemy instance by key, scaling combat stats for the current act
function createEnemy(key, actNumber) {
    const data = ENEMY_DATA[key];
    if (!data) throw new Error('Unknown enemy key: ' + key);
    const enemy = new Enemy(data);

    const mult = ACT_MULTIPLIERS[actNumber] || 1.0;
    if (mult !== 1.0) {
        enemy.baseStats.hp  = Math.round(enemy.baseStats.hp  * mult);
        enemy.baseStats.def = Math.round(enemy.baseStats.def * mult);
        enemy.baseStats.dmg = Math.round(enemy.baseStats.dmg * mult);
        enemy.baseStats.spd = Math.round(enemy.baseStats.spd * mult);
        // Resync currentHP to the new scaled maximum
        enemy.currentHP = enemy.getStat('hp');
    }

    return enemy;
}
