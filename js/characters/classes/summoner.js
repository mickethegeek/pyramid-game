// Summoner class — commands a spirit familiar that fights autonomously

// ─── Base stats ───────────────────────────────────────────────────────────────

const SUMMONER_BASE_STATS = {
    hp:    65,  // Low HP — relies on the familiar to absorb pressure
    def:    3,  // Minimal armour
    dmg:    6,  // Weakest direct damage — always better to summon
    dex:    6,  // Average agility
    spd:    8,  // Decent speed — summons quickly
    int:   14,  // High INT — large mana pool for frequent summons
    luck:  12,  // High luck — fortunate conjurer
};

// ─── Abilities ────────────────────────────────────────────────────────────────

const SUMMONER_ABILITIES = [
    {
        key:         'summon_familiar',
        name:        'Summon Familiar',
        manaCost:    25,
        description: 'Summon a spirit familiar (HP 30, DMG 5, SPD 6) that auto-attacks enemies each turn.',

        // Create the familiar and inject it into the combat queue
        use(self, _target, log, combat) {
            if (state.activeFamiliar) {
                log('A familiar is already active!');
                return;
            }
            const familiar       = createFamiliar(self);
            self.familiar        = familiar;
            state.activeFamiliar = familiar;
            injectFamiliarIntoQueue(combat, familiar);
            log(self.name + ' summons a Familiar! (HP ' + familiar.maxHP
                + ', DMG ' + familiar.dmg + ', SPD ' + familiar.spd + ')');
        },
    },
    {
        key:         'devour',
        name:        'Devour',
        manaCost:    0,           // Free: no mana cost — cooldown is the balance
        description: 'Devour your familiar or any non-boss/non-elite enemy at ≤5% HP. 2-turn cooldown.',

        // Return the current cooldown remaining for this summoner
        getCooldown(actor) { return actor.devourCooldown || 0; },

        // Devour is ready when not on cooldown AND a valid target exists
        isReady(actor, combat) {
            if ((actor.devourCooldown || 0) > 0) return false;
            // Own familiar is always a valid target
            if (actor.familiar && actor.familiar.isAlive()) return true;
            // Bosses and elites cannot be devoured
            if (combat.combatType === 'boss' || combat.combatType === 'elite') return false;
            // At least one normal enemy must be at ≤5% HP
            const enemies = getAliveEnemies(combat);
            return enemies.some(e => e.currentHP / e.getMaxHP() <= 0.05);
        },

        // Execute the devour on the best available target
        use(self, _target, log, combat) {
            let devourTarget = null;
            let isFamiliar   = false;

            if (self.familiar && self.familiar.isAlive()) {
                // Prefer own familiar
                devourTarget = self.familiar;
                isFamiliar   = true;
            } else {
                // Find the lowest-HP qualifying enemy (≤5% HP, not boss/elite combat)
                const enemies = getAliveEnemies(combat);
                for (const e of enemies) {
                    if (e.currentHP / e.getMaxHP() <= 0.05) {
                        if (!devourTarget || e.currentHP < devourTarget.currentHP) {
                            devourTarget = e;
                        }
                    }
                }
            }

            if (!devourTarget) {
                log('No valid target to Devour!');
                return;
            }

            if (isFamiliar) {
                // Absorb familiar — restore HP to the summoner, then recall it
                const restored = Math.min(20, self.getMaxHP() - self.currentHP);
                devourTarget.currentHP = 0;
                devourTarget.onRecall();   // clears self.familiar + state.activeFamiliar
                self.currentHP += restored;
                log(self.name + ' devours the Familiar and recovers ' + restored + ' HP!');
            } else {
                // Consume a weak enemy — restore HP equal to what remained (capped at 15)
                const restored = Math.min(15, devourTarget.currentHP);
                devourTarget.currentHP = 0;
                self.currentHP = Math.min(self.getMaxHP(), self.currentHP + restored);
                log(self.name + ' devours ' + devourTarget.name
                    + '! Recovered ' + restored + ' HP.');
            }

            self.devourCooldown = 2;
        },
    },
];

// ─── Class ────────────────────────────────────────────────────────────────────

class Summoner extends Character {

    // Initialise with Summoner stats, abilities, a null familiar slot, and cooldown counter
    constructor() {
        super('Summoner', SUMMONER_BASE_STATS);
        this.classKey       = 'summoner';
        this.abilities      = SUMMONER_ABILITIES;
        this.baseSkill      = 'call_familiar';
        // call_familiar level determines which familiar is available:
        // level 1 = Dog, 2 = Snake, 3 = Crow, 4 = Bats, 5 = Golem
        this.skillLevels['call_familiar'] = 1;
        this.familiar       = null;  // Populated by Summon Familiar; cleared by Devour or death
        this.devourCooldown = 0;     // Turns until Devour can be used again
        // Hybrid class — keeps mana and also has a smaller stamina pool
        this.maxStamina     = 6;
        this.currentStamina = 6;
        this.staminaRegen   = 2;
    }

    // Summoner scales into INT for better mana sustain and eventual familiar upgrades
    levelUp() {
        this.level++;
        this.runBonus.hp   += 1;
        this.runBonus.int  += 2;
        this.runBonus.luck += 1;
        this.currentHP = Math.min(this.currentHP + 1, this.getMaxHP());
    }
}

// ─── Factory ──────────────────────────────────────────────────────────────────

// Create and return a fresh Summoner instance
function createSummoner() {
    const c = new Summoner();
    c.classKey = 'summoner';
    return c;
}
