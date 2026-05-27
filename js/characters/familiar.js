// Familiar — autonomous combatants summoned by the Summoner
// Slot into the initiative queue alongside party members and enemies

// ─── Legacy factory (backward compat with Summoner ability system) ─────────────

// Create a basic spirit familiar used by the old Summon Familiar ability
function createFamiliar(summoner) {
    return {
        name:       'Familiar',
        summoner,
        currentHP:  30,
        maxHP:      30,
        def:        0,
        dmg:        5,
        spd:        6,
        row:        'front',
        aggro:      0,
        attackType: 'melee',
        isFamiliar: true,
        isStunned:    false,
        isTaunting:   false,
        hasShield:    false,
        activeEffects: [],

        isAlive()  { return this.currentHP > 0; },
        getMaxHP() { return this.maxHP; },

        getStat(stat) {
            const map = { hp: this.maxHP, def: this.def, dmg: this.dmg,
                          spd: this.spd, int: 0, dex: 0, luck: 0 };
            return map[stat] !== undefined ? map[stat] : 0;
        },

        takeDamage(amount, _log) {
            const reduced  = Math.max(1, amount - this.def);
            this.currentHP = Math.max(0, this.currentHP - reduced);
        },

        onDeath(log) {
            if (log) log('The Familiar has been slain!');
            if (this.summoner) this.summoner.familiar = null;
            state.activeFamiliar = null;
        },

        onRecall() {
            if (this.summoner) this.summoner.familiar = null;
            state.activeFamiliar = null;
        },

        tickStatusEffects(_log) {},
    };
}

// ─── Familiar templates ────────────────────────────────────────────────────────

// Static template objects — one per familiar type. Each template describes stat
// multipliers, group size, and lifecycle hooks.
// Units are instantiated from these by createFamiliarUnit(); never modified directly.
const FAMILIAR_TEMPLATES = {

    // Dog — fast, reliable, deals a parting blow on death
    dog: {
        key:          'dog',
        name:         'Dog',
        hpMultiplier:  1.5,
        dmgMultiplier: 0.8,
        spd:           8,
        attackType:   'physical',
        targeting:    'single',
        count:         1,
        onSummon(_summoner, _units, _combat, _log) {},
        // On death: deal 1.5× summoner INT magic damage to the highest-aggro enemy
        onDeath(summoner, log) {
            const enemies = state.combat ? state.combat.enemies.filter(e => e.isAlive()) : [];
            if (!enemies.length) return;
            const target = enemies.reduce((a, b) => b.aggro > a.aggro ? b : a);
            const dmg    = Math.floor(1.5 * summoner.getStat('int'));
            target.currentHP = Math.max(0, target.currentHP - dmg);
            log('Dog\'s dying howl strikes ' + target.name + ' for ' + dmg + ' magic damage!');
        },
        onRecall(_summoner, _log) {},
    },

    // Snake — elusive, poisons on every attack, spreads venom on death
    snake: {
        key:          'snake',
        name:         'Snake',
        hpMultiplier:  1.0,
        dmgMultiplier: 0.5,
        spd:           6,
        attackType:   'physical',
        targeting:    'single',
        dodgeChance:   0.30,           // read by executeFamiliarTurn / enemyAI
        attackAppliesPoison: true,     // read by executeFamiliarTurn
        count:         1,
        onSummon(_summoner, _units, _combat, _log) {},
        // On death: apply poison to up to 3 random living enemies
        onDeath(_summoner, log) {
            const enemies  = state.combat ? state.combat.enemies.filter(e => e.isAlive()) : [];
            const targets  = enemies.slice().sort(() => Math.random() - 0.5).slice(0, 3);
            for (const t of targets) applyStatusEffect(t, 'poison', log);
            if (targets.length) {
                log('Snake\'s death venom seeps into '
                    + targets.length + ' enem' + (targets.length === 1 ? 'y' : 'ies') + '!');
            }
        },
        onRecall(_summoner, _log) {},
    },

    // Crow — fast pair, blinds on arrival and departure
    crow: {
        key:          'crow',
        name:         'Crow',
        hpMultiplier:  1.2,
        dmgMultiplier: 1.2,
        spd:           12,
        attackType:   'physical',
        targeting:    'single',
        count:         2,
        // On summon: blind one random enemy
        onSummon(_summoner, _units, combat, log) {
            const enemies = combat ? combat.enemies.filter(e => e.isAlive()) : [];
            if (!enemies.length) return;
            const t = enemies[Math.floor(Math.random() * enemies.length)];
            applyStatusEffect(t, 'blind', log);
            log('The Crows\' arrival blinds ' + t.name + '!');
        },
        onDeath(_summoner, _log) {},
        // On recall: blind one random living enemy
        onRecall(_summoner, log) {
            const enemies = state.combat ? state.combat.enemies.filter(e => e.isAlive()) : [];
            if (!enemies.length) return;
            const t = enemies[Math.floor(Math.random() * enemies.length)];
            applyStatusEffect(t, 'blind', log);
            if (log) log('The Crows screech as they depart — ' + t.name + ' is blinded!');
        },
    },

    // Bat swarm — 6 independent units, each targets randomly.
    // While any bat lives: state.batAuraActive = true (DEF -20% on all enemies — checked in damageCalc.js).
    bat: {
        key:          'bat',
        name:         'Bat',
        hpMultiplier:  0.6,
        dmgMultiplier: 1.0,
        spd:           14,
        attackType:   'physical',
        targeting:    'random',
        count:         6,
        // On summon: activate the group DEF-reduction aura
        onSummon(_summoner, _units, _combat, log) {
            state.batAuraActive = true;
            if (log) log('A bat swarm engulfs the battlefield — all enemies\' DEF reduced by 20%!');
        },
        // On each bat death: 25% blind to a random enemy; last bat clears the aura
        onDeath(_summoner, log) {
            const aliveBats = (state.activeFamiliars || [])
                .filter(u => u.familiarKey === 'bat' && u.isAlive()).length;
            if (aliveBats === 0) {
                state.batAuraActive = false;
                if (log) log('The last bat falls — DEF aura dissipates!');
            }
            // 25% chance to blind a random living enemy (independent per bat)
            const enemies = state.combat ? state.combat.enemies.filter(e => e.isAlive()) : [];
            if (enemies.length && Math.random() < 0.25) {
                const t = enemies[Math.floor(Math.random() * enemies.length)];
                applyStatusEffect(t, 'blind', log);
            }
        },
        // On recall (whole group): clear the aura
        onRecall(_summoner, log) {
            state.batAuraActive = false;
            if (log) log('The bats scatter — DEF aura ends.');
        },
    },

    // Golem — massive tank that draws aggro away from the party
    golem: {
        key:          'golem',
        name:         'Golem',
        hpMultiplier:  5.0,
        dmgMultiplier: 0.9,
        spd:           3,
        attackType:   'physical',
        targeting:    'single',
        count:         1,
        // On summon: set tauntActive flag (targeting logic handled in enemyAI.js)
        onSummon(_summoner, units, _combat, log) {
            for (const unit of units) unit.tauntActive = true;
            if (log) log('The Golem takes a defensive stance — drawing enemy attention!');
        },
        onDeath(_summoner, _log) {},
        // On recall: grant all living party members 20% damage reduction for 2 turns
        onRecall(_summoner, log) {
            const living = state.party ? state.party.filter(m => m.isAlive()) : [];
            for (const m of living) {
                m.damageReduction      = 0.20;
                m.damageReductionTurns = 2;
            }
            if (log && living.length) {
                log('Golem\'s essence shields the party — 20% damage reduction for 2 turns!');
            }
        },
    },

    // Herald — powerful spirit that attacks all enemies. Coexists with other familiars.
    herald: {
        key:          'herald',
        name:         'Herald',
        hpMultiplier:  5.0,
        dmgMultiplier: 2.5,
        spd:           10,
        attackType:   'magic',
        targeting:    'all',
        count:         1,
        // On summon: flag herald presence
        onSummon(_summoner, _units, _combat, log) {
            state.heraldActive = true;
            if (log) log('The Herald materialises — ancient power surges through the battlefield!');
        },
        // On death: blind all enemies 3t, then summon Dog + Crow (both coexist)
        // Herald On-Death familiar On-Death passive tick handled in combat.js.
        onDeath(summoner, log) {
            const enemies = state.combat ? state.combat.enemies.filter(e => e.isAlive()) : [];
            for (const e of enemies) applyStatusEffect(e, 'blind', log, { turnsLeft: 3 });
            if (enemies.length) log('The Herald\'s collapse blinds all enemies for 3 turns!');
            summonFamiliarGroup(summoner, 'dog',  state.combat, log, true);
            summonFamiliarGroup(summoner, 'crow', state.combat, log, true);
            state.heraldActive = false;
            log('The Herald\'s dying wish calls forth a Dog and Crows!');
        },
        // On recall: heal all living party members for 1.5× summoner INT
        onRecall(summoner, log) {
            const living = state.party ? state.party.filter(m => m.isAlive()) : [];
            const heal   = Math.floor(1.5 * summoner.getStat('int'));
            for (const m of living) {
                m.currentHP = Math.min(m.getMaxHP(), m.currentHP + heal);
            }
            state.heraldActive = false;
            if (log && living.length) {
                log('The Herald blesses the party on departure — each ally recovers ' + heal + ' HP!');
            }
        },
    },
};

// ─── Unit factory ──────────────────────────────────────────────────────────────

// Create one familiar combat unit from a template, scaling HP and DMG off summoner INT.
// hpMult / dmgMult: optional Blood Pact multipliers (default 1).
function createFamiliarUnit(template, summoner, hpMult, dmgMult) {
    hpMult  = hpMult  || 1;
    dmgMult = dmgMult || 1;
    const maxHP = Math.max(1, Math.floor(template.hpMultiplier  * summoner.getStat('int') * hpMult));
    const dmg   = Math.max(1, Math.floor(template.dmgMultiplier * summoner.getStat('int') * dmgMult));

    return {
        name:        template.name,
        familiarKey: template.key,
        template,
        summoner,
        currentHP:   maxHP,
        maxHP,
        dmg,
        def:         0,
        spd:         template.spd,
        row:         'front',
        aggro:       0,
        attackType:  template.attackType,
        targeting:   template.targeting,
        isFamiliar:  true,
        dodgeChance: template.dodgeChance        || 0,
        tauntActive: false,
        attackAppliesPoison: template.attackAppliesPoison || false,
        isStunned:   false,
        isTaunting:  false,
        hasShield:   false,
        activeEffects: [],

        isAlive()  { return this.currentHP > 0; },
        getMaxHP() { return this.maxHP; },

        getStat(stat) {
            const map = { hp: this.maxHP, def: this.def, dmg: this.dmg,
                          spd: this.spd, int: 0, dex: 0, luck: 0 };
            return map[stat] !== undefined ? map[stat] : 0;
        },

        takeDamage(amount, _log) {
            const reduced  = Math.max(1, amount - this.def);
            this.currentHP = Math.max(0, this.currentHP - reduced);
        },

        // Bridge to template hooks — combat.js calls these with just (log)
        onDeath(log)   { this.template.onDeath(this.summoner, log); },
        onRecall(log)  { this.template.onRecall(this.summoner, log); },

        tickStatusEffects(_log) {},
    };
}

// ─── Group summon helper ────────────────────────────────────────────────────────

// Instantiate a familiar group from FAMILIAR_TEMPLATES, apply Blood Pact bonus if present,
// optionally recall existing non-herald familiars, and insert units into the initiative queue.
// skipRecall: true for summon_herald (coexists with active familiars).
function summonFamiliarGroup(summoner, familiarKey, combat, log, skipRecall) {
    const template = FAMILIAR_TEMPLATES[familiarKey];
    if (!template) {
        if (log) log('Unknown familiar key: ' + familiarKey);
        return;
    }

    // ── Blood Pact bonus ─────────────────────────────────────────────────────
    // bloodPactBonus set by blood_pact skill
    let hpMult  = 1;
    let dmgMult = 1;
    if (summoner.bloodPactBonus) {
        hpMult  = summoner.bloodPactBonus.hpMult;
        dmgMult = summoner.bloodPactBonus.dmgMult;
        summoner.bloodPactBonus = null;
    }

    // ── Recall existing non-herald familiars (unless skipRecall) ─────────────
    if (!state.activeFamiliars) state.activeFamiliars = [];
    if (!skipRecall) {
        const nonHerald = state.activeFamiliars.filter(u => u.familiarKey !== 'herald');
        if (nonHerald.length > 0) {
            const recalledKey      = nonHerald[0].familiarKey;
            const recallTemplate   = FAMILIAR_TEMPLATES[recalledKey];
            if (recallTemplate && recallTemplate.onRecall) {
                recallTemplate.onRecall(summoner, log);
            }
            // Remove recalled units from queue
            if (combat && combat.queue) {
                const removeKeys = new Set(nonHerald.map(u => u.familiarKey));
                combat.queue = combat.queue.filter(
                    slot => !(slot.isFamiliar && removeKeys.has(slot.combatant.familiarKey))
                );
            }
            state.activeFamiliars = state.activeFamiliars.filter(u => u.familiarKey === 'herald');
        }
    }

    // ── Instantiate units ────────────────────────────────────────────────────
    const units = [];
    for (let i = 0; i < template.count; i++) {
        units.push(createFamiliarUnit(template, summoner, hpMult, dmgMult));
    }

    // ── On-summon hook ───────────────────────────────────────────────────────
    if (template.onSummon) template.onSummon(summoner, units, combat, log);

    // ── Register in state ────────────────────────────────────────────────────
    for (const unit of units) state.activeFamiliars.push(unit);
    // Keep legacy single-familiar reference updated
    state.activeFamiliar = state.activeFamiliars.find(u => u.familiarKey !== 'herald')
                        || state.activeFamiliars[0]
                        || null;

    // ── Insert into initiative queue after current turn, ordered by SPD ──────
    if (combat && combat.queue) {
        for (const unit of units) {
            const slot = { combatant: unit, isPlayer: false, isFamiliar: true };
            let insertIdx = combat.queue.length;
            for (let i = (combat.turnIndex || 0) + 1; i < combat.queue.length; i++) {
                if (combat.queue[i].combatant.getStat('spd') < unit.spd) {
                    insertIdx = i;
                    break;
                }
            }
            combat.queue.splice(insertIdx, 0, slot);
        }
    }

    const label = template.count > 1
        ? template.count + ' ' + template.name + 's'
        : 'a ' + template.name;
    if (log) log(summoner.name + ' summons ' + label + '!');
}
