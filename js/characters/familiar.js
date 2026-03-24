// Familiar — autonomous combatant summoned by the Summoner
// Slots into the initiative queue alongside party members and enemies

// Create a fresh Familiar owned by the given Summoner.
// The familiar always fights in the front row and targets the highest-aggro enemy.
function createFamiliar(summoner) {
    return {
        name:       'Familiar',
        summoner:   summoner,   // reference to the Summoner who owns it
        currentHP:  30,
        maxHP:      30,
        def:        0,
        dmg:        5,
        spd:        6,
        row:        'front',
        aggro:      0,
        attackType: 'melee',
        isFamiliar: true,

        // Status flags — familiars use the same flag names as Characters/Enemies
        isStunned:    false,
        isTaunting:   false,
        hasShield:    false,
        activeEffects: [],

        // ── Core interface ────────────────────────────────────────────────────

        isAlive()  { return this.currentHP > 0; },
        getMaxHP() { return this.maxHP; },

        // Flat stat lookup — familiar has no stat layers
        getStat(stat) {
            const map = { hp: this.maxHP, def: this.def, dmg: this.dmg,
                          spd: this.spd,  int: 0, dex: 0, luck: 0 };
            return (map[stat] !== undefined) ? map[stat] : 0;
        },

        // Reduce HP, applying flat def as armor
        takeDamage(amount, _log) {
            const reduced  = Math.max(1, amount - this.def);
            this.currentHP = Math.max(0, this.currentHP - reduced);
        },

        // ── Lifecycle hooks ───────────────────────────────────────────────────

        // Called when the familiar dies in combat (e.g. status-effect tick kills it)
        onDeath(log) {
            if (log) log('The Familiar has been slain!');
            if (this.summoner) this.summoner.familiar = null;
            state.activeFamiliar = null;
        },

        // Called when the Summoner recalls or devours the familiar
        onRecall() {
            if (this.summoner) this.summoner.familiar = null;
            state.activeFamiliar = null;
        },

        // No-op — familiars don't use the full status-effect system
        tickStatusEffects(_log) {},
    };
}
