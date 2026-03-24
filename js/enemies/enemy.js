// Base enemy class — mirrors the Character interface so combat logic works for both

class Enemy {

    // Build an enemy from a definition object (pulled from ENEMY_DATA)
    constructor(data) {
        this.name  = data.name;
        this.intro = data.intro || null;  // optional flavour text shown at combat start
        // Store the raw data so the onDeath method can read callbacks without a key lookup
        this.data  = data;

        // Enemies use flat base stats only — no permanent or run bonus layers
        this.baseStats = {
            hp: 0, def: 0, dmg: 0,
            dex: 0, spd: 0, int: 0, luck: 0,
            ...data.stats,
        };

        // Current HP starts at max
        this.currentHP = this.getStat('hp');

        // How many turns this enemy has taken — incremented in executeEnemyTurn (combat.js)
        this.turnCount = 0;

        // 'front' | 'back' — back row enemies set explicitly in room compositions
        this.row = 'front';

        // Aggro accumulated this combat — tracked for future targeting logic
        this.aggro = 0;

        // Stores the action this enemy just executed so combatUI can telegraph it during player turns
        this.intendedAction = null;

        // Tags for special interactions — e.g. 'undead', 'demon'. No Act 1 enemies use these yet.
        this.tags = data.tags || [];

        // ── Status effect state ──────────────────────────────────────────────
        // Managed by statusEffects.js — same system as characters
        this.activeEffects = [];

        // Flags written by status effects; read by combat.js and damageCalc.js
        this.isStunned  = false;   // set by Stun — skip this enemy's turn
        this.isTaunting = false;   // set by Taunt — unused for enemies but kept for symmetry
        this.hasShield  = false;   // set by Shield — absorbs the next hit
        this.isBlinded  = false;   // set by Blind — 35% miss chance on basic attacks
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

    // Reduce HP by amount — if a Shield is active it absorbs 70% of hit instead.
    // Mud Golem passive: intercepts incoming damage and shares 40% with a living partner.
    takeDamage(amount, log) {
        // Damage intercept: if this is a Mud Golem and a partner is alive, split the hit
        if (this.key === 'mudGolem' && state.combat) {
            const partner = state.combat.enemies.find(
                e => e !== this && e.key === 'mudGolem' && e.isAlive()
            );
            if (partner) {
                const myShare    = Math.ceil(amount * 0.6);
                const theirShare = Math.floor(amount * 0.4);
                if (log) log('Mud Golem damage is shared! (' + myShare + ' here, ' + theirShare + ' to partner)');
                this._applyDamageRaw(myShare, log);
                partner._applyDamageRaw(theirShare, null);
                return;
            }
        }
        this._applyDamageRaw(amount, log);
    }

    // Internal HP reduction — used directly to avoid re-triggering the Golem intercept
    _applyDamageRaw(amount, log) {
        if (this.hasShield) {
            // Shield consumes itself and blocks 70% of damage
            const blocked   = Math.floor(amount * 0.7);
            const remaining = amount - blocked;
            removeStatusEffect(this, 'shield');
            if (log) log(this.name + "'s shield blocks " + blocked + " damage! (" + remaining + " gets through)");
            this.currentHP = Math.max(0, this.currentHP - remaining);
            return;
        }
        this.currentHP = Math.max(0, this.currentHP - amount);
    }

    // Fire the on-death callback defined in ENEMY_DATA when this enemy is defeated.
    // party: alive party array, enemies: full enemies array, log: combat log function
    onDeath(party, enemies, log) {
        if (this.data && this.data.onDeath) {
            // Pass { party, enemies } as the 'combat' arg so callbacks use combat.party / combat.enemies
            this.data.onDeath(this, { party, enemies }, log || (() => {}));
        }
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
    // Store the data key so enemyAI.js can look up actions and callbacks
    enemy.key        = key;
    // Store attack type for Pinned check and damageCalc row rules
    enemy.attackType = data.attackType || 'melee';
    // Set starting row — 'random' picks front or back with equal chance
    const rowPref = data.row || 'front';
    enemy.row = (rowPref === 'random') ? (Math.random() < 0.5 ? 'front' : 'back') : rowPref;

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
