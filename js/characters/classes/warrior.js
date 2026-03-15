// Warrior class — Tank / CC specialist, signature mechanic: Taunt

// ─── Base stats ───────────────────────────────────────────────────────────────

const WARRIOR_BASE_STATS = {
    hp:   120,  // Highest HP of any class — built to absorb punishment
    def:    8,  // Solid armour, reliable damage reduction
    dmg:   10,  // Strong baseline melee damage
    dex:    6,  // Moderate agility — occasional crits and dodges
    spd:    7,  // Average speed — acts mid-order in initiative
    int:    3,  // Low INT — small mana pool, not a spellcaster
    luck:   5,  // Average luck
};

// ─── Abilities ────────────────────────────────────────────────────────────────
// Data-driven: each ability declares its cost, description, and use() function.
// use(self, target, log): self = the Warrior, target = the enemy, log = addToLog fn

const WARRIOR_ABILITIES = [
    {
        key:         'taunt',
        name:        'Taunt',
        manaCost:    10,
        description: 'Force the enemy to target the Warrior for 2 turns.',
        // Apply the Taunt status effect to self
        use(self, _target, log) {
            self.addStatusEffect('taunt', log);
        },
    },
    {
        key:         'shield_wall',
        name:        'Shield Wall',
        manaCost:    15,
        description: 'Raise a shield that absorbs the next incoming hit entirely.',
        // Apply the Shield status effect to self
        use(self, _target, log) {
            self.addStatusEffect('shield', log);
        },
    },
];

// ─── Class ────────────────────────────────────────────────────────────────────

class Warrior extends Character {

    // Initialise with Warrior stats and attach the ability list
    constructor() {
        super('Warrior', WARRIOR_BASE_STATS);
        this.abilities = WARRIOR_ABILITIES;
    }

    // Warrior levels up with extra HP and DEF focus instead of the generic split
    levelUp() {
        this.level++;
        this.runBonus.hp  += 3;  // +1 more HP than generic (tank scaling)
        this.runBonus.def += 1;
        this.runBonus.dmg += 1;

        // Grant the extra HP immediately (partial heal on level-up)
        this.currentHP = Math.min(this.currentHP + 3, this.getMaxHP());
    }
}

// ─── Factory ──────────────────────────────────────────────────────────────────

// Create and return a fresh Warrior instance
function createWarrior() {
    const c = new Warrior();
    c.classKey = 'warrior';
    return c;
}
