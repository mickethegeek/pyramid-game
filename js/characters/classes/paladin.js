// Paladin class — Hybrid tank-healer, signature mechanic: Holy Shield

// ─── Base stats ───────────────────────────────────────────────────────────────

const PALADIN_BASE_STATS = {
    hp:   110,  // High HP — second tankiest after the Warrior
    def:   10,  // Highest DEF in the game — heavy blessed armour
    dmg:    9,  // Decent but not spectacular melee damage
    dex:    4,  // Slow and methodical — rarely dodges
    spd:    5,  // Low speed — heavy armour costs initiative
    int:    8,  // Moderate INT — enough mana to cast support spells
    luck:  10,  // High luck — the gods smile on the faithful
};

// ─── Abilities ────────────────────────────────────────────────────────────────

const PALADIN_ABILITIES = [
    {
        key:         'holy_shield',
        name:        'Holy Shield',
        manaCost:    20,
        description: 'Raise a blessed shield and invoke a healing aura — apply both Shield and Bless to self.',
        // Apply Shield (absorbs next hit) and Bless (heals over time) to self
        use(self, _target, log) {
            self.addStatusEffect('shield', log);
            self.addStatusEffect('bless', log);
        },
    },
    {
        key:         'consecrate',
        name:        'Consecrate',
        manaCost:    30,
        description: 'Sanctify the ground dealing INT×1.2 holy damage, ignoring armour.',
        use(self, target, log) {
            const dmg = Math.floor(self.getStat('int') * 1.2);
            target.takeDamage(dmg, log);
            log(self.name + ' consecrates the area for ' + dmg + ' holy damage!');
        },
    },
];

// ─── Class ────────────────────────────────────────────────────────────────────

class Paladin extends Character {

    // Initialise with Paladin stats and abilities
    constructor() {
        super('Paladin', PALADIN_BASE_STATS);
        this.classKey  = 'paladin';
        this.abilities = PALADIN_ABILITIES;
        this.baseSkill = 'retribution_strike';
        this.skillLevels['retribution_strike'] = 1;
        // Physical class — uses stamina alongside mana (Paladin is a hybrid tank-healer)
        this.maxStamina     = 10;
        this.currentStamina = 10;
        this.staminaRegen   = 3;
    }

    // Paladin scales into survivability — more armour and spell support each level
    levelUp() {
        this.level++;
        this.runBonus.hp  += 3;
        this.runBonus.def += 1;  // Keeps getting harder to kill
        this.runBonus.int += 1;  // Slowly improves healing and holy damage

        // Grant the extra HP immediately
        this.currentHP = Math.min(this.currentHP + 3, this.getMaxHP());
    }
}

// ─── Factory ──────────────────────────────────────────────────────────────────

// Create and return a fresh Paladin instance
function createPaladin() {
    const c = new Paladin();
    c.classKey = 'paladin';
    return c;
}
