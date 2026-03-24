// Barbarian class — Berserker, signature mechanic: Rage

// ─── Enraged check ────────────────────────────────────────────────────────────

// Return true if the Barbarian's current HP is below 50% of their maximum HP
function isEnraged(character) {
    return character.currentHP < character.getMaxHP() * 0.5;
}

// ─── Base stats ───────────────────────────────────────────────────────────────

const BARBARIAN_BASE_STATS = {
    hp:   140,  // Highest raw HP — a walking wall of muscle
    def:    4,  // Light armour — speed over protection
    dmg:   16,  // Highest base damage of any melee class
    dex:    4,  // Low agility — swings hard, not precisely
    spd:   10,  // Fast despite the size — charges in early
    int:    2,  // Barely literate — tiny mana pool
    luck:   5,  // Average luck
};

// ─── Abilities ────────────────────────────────────────────────────────────────

const BARBARIAN_ABILITIES = [
    {
        key:         'rage',
        name:        'Rage',
        manaCost:    15,
        description: 'Enter a berserker rage: +5 DMG, -2 DEF for 3 turns.',
        // Apply the Rage status effect to self
        use(self, _target, log) {
            self.addStatusEffect('rage', log);
        },
    },
    {
        key:         'reckless_strike',
        name:        'Reckless Strike',
        manaCost:    20,
        description: 'Strike twice as hard — but take 10 damage in the reckless exchange.',
        // Hit target at 2× multiplier (can crit), then deal flat self-damage
        use(self, target, log) {
            const result = calculateDamage(self, target, 2.0);
            target.takeDamage(result.damage, log);

            const msg = result.isCrit
                ? 'CRITICAL! Reckless Strike hits for ' + result.damage + '!'
                : 'Reckless Strike hits for ' + result.damage + ' damage!';
            log(msg);

            // Self-damage bypasses the Barbarian's own shield (recklessness, not an attack)
            self.currentHP = Math.max(0, self.currentHP - 10);
            log(self.name + ' takes 10 self-damage from recklessness!');
        },
    },
];

// ─── Class ────────────────────────────────────────────────────────────────────

class Barbarian extends Character {

    // Initialise with Barbarian stats and abilities
    constructor() {
        super('Barbarian', BARBARIAN_BASE_STATS);
        this.classKey  = 'barbarian';
        this.abilities = BARBARIAN_ABILITIES;
        this.baseSkill = 'cleave';
        this.skillLevels['cleave'] = 1;
        // Physical class — uses stamina instead of mana for physical abilities
        this.maxStamina     = 10;
        this.currentStamina = 10;
        this.staminaRegen   = 3;
    }

    // Announce the first time incoming damage pushes HP below the Enraged threshold
    takeDamage(amount, log) {
        const wasEnraged = isEnraged(this);
        super.takeDamage(amount, log);
        if (!wasEnraged && isEnraged(this) && log) log(this.name + ' is ENRAGED!');
    }

    // Barbarian scales heavily into raw damage — no defensive growth
    levelUp() {
        this.level++;
        this.runBonus.hp  += 4;  // Biggest HP gains of any class
        this.runBonus.dmg += 2;  // Escalating damage — the berserker fantasy

        // Grant the extra HP immediately
        this.currentHP = Math.min(this.currentHP + 4, this.getMaxHP());
    }
}

// ─── Factory ──────────────────────────────────────────────────────────────────

// Create and return a fresh Barbarian instance
function createBarbarian() {
    const c = new Barbarian();
    c.classKey = 'barbarian';
    return c;
}
