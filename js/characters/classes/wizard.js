// Wizard class — AoE nuke, glass cannon, highest INT in the game

// ─── Base stats ───────────────────────────────────────────────────────────────

const WIZARD_BASE_STATS = {
    hp:    55,  // Lowest HP — dies to almost anything that reaches them
    def:    2,  // No armour at all — pure robes
    dmg:    8,  // Weak melee — should never be auto-attacking
    dex:    4,  // Clumsy — rarely crits or dodges
    spd:    6,  // Slow — power comes at the cost of initiative
    int:   20,  // Highest INT of any class — devastating spell damage and huge mana pool
    luck:   4,  // Low luck — destiny is calculated, not fortunate
};

// ─── Abilities ────────────────────────────────────────────────────────────────

const WIZARD_ABILITIES = [
    {
        key:         'fireball',
        name:        'Fireball',
        manaCost:    30,
        description: 'Hurl a blazing fireball dealing INT×2 magic damage, ignoring armour.',
        use(self, target, log) {
            const dmg = Math.floor(self.getStat('int') * 2);
            target.takeDamage(dmg, log);
            log(self.name + ' hurls a Fireball for ' + dmg + ' fire damage!');
        },
    },
    {
        key:         'freeze',
        name:        'Freeze',
        manaCost:    20,
        description: 'Encase the target in ice — apply Stun, skipping their next turn.',
        // Apply the Stun status effect to the target
        use(self, target, log) {
            applyStatusEffect(target, 'stun', log);
        },
    },
];

// ─── Class ────────────────────────────────────────────────────────────────────

class Wizard extends Character {

    // Initialise with Wizard stats and abilities
    constructor() {
        super('Wizard', WIZARD_BASE_STATS);
        this.abilities = WIZARD_ABILITIES;
    }

    // Wizard pours everything into INT — every level the spells hit harder
    levelUp() {
        this.level++;
        this.runBonus.hp  += 1;
        this.runBonus.int += 3;  // Massive INT scaling — the payoff for fragility

        // Grant the extra HP immediately
        this.currentHP = Math.min(this.currentHP + 1, this.getMaxHP());
    }
}

// ─── Factory ──────────────────────────────────────────────────────────────────

// Create and return a fresh Wizard instance
function createWizard() {
    const c = new Wizard();
    c.classKey = 'wizard';
    return c;
}
