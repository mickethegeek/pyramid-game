// Archer class — Fast sniper, signature mechanic: status application

// ─── Base stats ───────────────────────────────────────────────────────────────

const ARCHER_BASE_STATS = {
    hp:    85,  // Below average HP — stays at range, not in melee
    def:    3,  // Minimal armour — mobility over protection
    dmg:   13,  // Strong single-target damage
    dex:   16,  // Highest DEX of any class — crits and dodges constantly
    spd:   14,  // Second-fastest class — almost always acts first
    int:    4,  // Low INT — small mana pool, uses it efficiently
    luck:  10,  // High luck — crits are frequent and nasty
};

// ─── Abilities ────────────────────────────────────────────────────────────────

const ARCHER_ABILITIES = [
    {
        key:         'poison_arrow',
        name:        'Poison Arrow',
        manaCost:    15,
        description: 'Fire a venom-tipped arrow — apply Poison to the target for 3 turns.',
        // Apply the Poison status effect to the target
        use(self, target, log) {
            applyStatusEffect(target, 'poison', log);
        },
    },
    {
        key:         'piercing_shot',
        name:        'Piercing Shot',
        manaCost:    20,
        description: 'An armour-piercing shot that deals DMG×1.5 and ignores all DEF.',
        // Flat DMG-scaled damage — skips the DEF subtraction entirely
        use(self, target, log) {
            const dmg = Math.floor(self.getStat('dmg') * 1.5);
            target.takeDamage(dmg, log);
            log(self.name + "'s Piercing Shot punches through for " + dmg + ' damage!');
        },
    },
];

// ─── Class ────────────────────────────────────────────────────────────────────

class Archer extends Character {

    // Initialise with Archer stats and abilities
    constructor() {
        super('Archer', ARCHER_BASE_STATS);
        this.classKey  = 'archer';
        this.abilities = ARCHER_ABILITIES;
        this.baseSkill = 'piercing_shot';
        this.skillLevels['piercing_shot'] = 1;
        // Hybrid class — keeps mana and also has a smaller stamina pool
        this.maxStamina     = 6;
        this.currentStamina = 6;
        this.staminaRegen   = 2;
    }

    // Archer scales into DEX for more crits and dodges, and steady damage
    levelUp() {
        this.level++;
        this.runBonus.hp  += 1;
        this.runBonus.dex += 2;  // Becomes more accurate and harder to hit each level
        this.runBonus.dmg += 1;

        // Grant the extra HP immediately
        this.currentHP = Math.min(this.currentHP + 1, this.getMaxHP());
    }
}

// ─── Factory ──────────────────────────────────────────────────────────────────

// Create and return a fresh Archer instance
function createArcher() {
    const c = new Archer();
    c.classKey = 'archer';
    return c;
}
