// Cleric class — Healer / Spellcaster, signature mechanic: Divine Pact

// ─── Base stats ───────────────────────────────────────────────────────────────

const CLERIC_BASE_STATS = {
    hp:    70,  // Fragile — must stay supported
    def:    4,  // Light robes, minimal protection
    dmg:   12,  // Decent weapon damage when forced to fight
    dex:    6,  // Average agility
    spd:    5,  // Slow — the healer acts last, after the damage is done
    int:   16,  // High INT — drives both healing potency and large mana pool
    luck:   6,  // Slightly lucky — blessings from the gods
};

// ─── Abilities ────────────────────────────────────────────────────────────────

const CLERIC_ABILITIES = [
    {
        key:         'holy_light',
        name:        'Holy Light',
        manaCost:    20,
        description: 'Channel divine energy to restore 25 HP to yourself.',
        use(self, _target, log) {
            const heal = 25;
            self.currentHP = Math.min(self.getMaxHP(), self.currentHP + heal);
            log(self.name + ' channels Holy Light and recovers ' + heal + ' HP!');
        },
    },
    {
        key:         'smite',
        name:        'Smite',
        manaCost:    25,
        description: 'Call down divine wrath: deal INT×1.5 magic damage, ignoring armour.',
        // Flat INT-scaled damage — bypasses DEF entirely (magic damage)
        use(self, target, log) {
            const dmg = Math.floor(self.getStat('int') * 1.5);
            target.takeDamage(dmg, log);
            log(self.name + ' calls down Smite for ' + dmg + ' holy damage!');
        },
    },
];

// ─── Class ────────────────────────────────────────────────────────────────────

class Cleric extends Character {

    // Initialise with Cleric stats and abilities
    constructor() {
        super('Cleric', CLERIC_BASE_STATS);
        this.abilities = CLERIC_ABILITIES;
    }

    // Cleric scales into INT to improve healing and spell damage over time
    levelUp() {
        this.level++;
        this.runBonus.hp  += 2;
        this.runBonus.int += 1;  // Each level improves mana pool and spell potency
        this.runBonus.dmg += 1;

        // Grant the extra HP immediately
        this.currentHP = Math.min(this.currentHP + 2, this.getMaxHP());
    }
}

// ─── Factory ──────────────────────────────────────────────────────────────────

// Create and return a fresh Cleric instance
function createCleric() {
    const c = new Cleric();
    c.classKey = 'cleric';
    return c;
}
