// Round-level housekeeping — log, turn start, round-end effects, telegraph pre-roll, death checks

// Append a message to the combat log; keep up to 200 entries so the player can scroll history
function addToLog(combat, message) {
    combat.log.push(message);
    if (combat.log.length > 200) combat.log.shift();
}

// Run start-of-turn housekeeping: tick status effects and regenerate mana/stamina.
// Returns true if the combatant was stunned at the START of this turn.
// Stun flag captured BEFORE ticking because duration:1 ticking clears it.
function startOfTurn(combat, combatant) {
    combat.turnStarted = true;
    const wasStunned     = combatant.isStunned;
    // Capture and clear silence before ticking so executePlayerAbility can read wasSilenced
    combatant.wasSilenced = combatant.isSilenced;
    combatant.isSilenced  = false;
    combatant.tickStatusEffects(msg => addToLog(combat, msg));
    if (combatant.regenMana)    combatant.regenMana();
    if (combatant.regenStamina) combatant.regenStamina();
    // Tick ability cooldowns (e.g. Summoner's Devour cooldown)
    if (combatant.devourCooldown > 0) combatant.devourCooldown--;
    return wasStunned;
}

// Tick all per-round party buffs at the end of every full initiative cycle.
// Handles Sacred Aura heal-over-time and the shared damageReduction expiry.
function processRoundEnd(combat) {
    const log = msg => addToLog(combat, msg);

    for (const member of combat.party) {
        if (!member.isAlive()) continue;

        // ── Sacred Aura heal tick ─────────────────────────────────────────────
        if ((member.sacredAuraTurns || 0) > 0) {
            member.currentHP = Math.min(member.getMaxHP(), member.currentHP + member.sacredAuraHeal);
            log(member.name + ' is healed for ' + member.sacredAuraHeal + ' HP by Sacred Aura!');

            const caster = state.party.find(
                m => m.activeEffects && m.activeEffects.some(e => e.key === 'sacred_aura')
            );
            if (caster) caster.aggro += Math.floor(member.sacredAuraHeal * 0.8);

            member.sacredAuraTurns--;

            if (member.sacredAuraTurns === 0) {
                member.sacredAuraHeal = 0;
                if ((member.damageReductionTurns || 0) === 0) {
                    member.damageReduction = 0;
                }
            }
        }

        // ── Damage reduction expiry ───────────────────────────────────────────
        if ((member.damageReductionTurns || 0) > 0) {
            member.damageReductionTurns--;
            if (member.damageReductionTurns === 0) {
                member.damageReduction = 0;
            }
        }
    }

    // ── Goremaw boss round-end hooks ──────────────────────────────────────────
    const goremaw = combat.enemies.find(e => e.key === 'goremaw' && e.isAlive());
    if (goremaw) {
        const livingSpawnedRats = combat.enemies.filter(
            e => e.key === 'bogRat' && e.spawnedByGoremaw && e.isAlive()
        );
        goremaw.bogRatBuff = livingSpawnedRats.length * goremaw.passive.bogRatDmgBonus;

        if (goremaw.phase === 2) {
            goremaw.currentHP = Math.min(goremaw.getMaxHP(), goremaw.currentHP + goremaw.passive.phase2Regen);
            log('Goremaw regenerates ' + goremaw.passive.phase2Regen + ' HP from the swamp!');
        }
    }

    // ── Herald passive: echo non-herald familiar on-death effects each round ──
    if (state.heraldActive) {
        const heraldAlive = (state.activeFamiliars || []).some(
            u => u.familiarKey === 'herald' && u.currentHP > 0
        );
        if (heraldAlive) {
            for (const unit of (state.activeFamiliars || [])) {
                if (unit.familiarKey !== 'herald' && unit.currentHP > 0) {
                    log('The Herald pulses — ' + unit.name + "'s death echo fires!");
                    unit.onDeath(log);
                }
            }
        }
    }
}

// Roll each living enemy's next action and cache the result on the enemy for both display and execution.
// Called at the start of every player turn. The cached action is consumed in executeEnemyTurn so
// the telegraph badge and the actual execution always use the same random roll.
function prerollEnemyIntentions(combat) {
    const aliveParty = getAlivePartyMembers(combat);
    for (const enemy of getAliveEnemies(combat)) {
        const action = getEnemyAction(enemy, aliveParty);

        enemy._prerolledAction = action;

        if (action.type === 'defend') {
            enemy.intendedAction = { name: 'Defend', targetName: enemy.name, type: 'buff' };
        } else if (action.ability) {
            enemy.intendedAction = {
                name:       actionKeyToName(action.ability.key),
                targetName: action.target ? action.target.name : '?',
                type:       action.ability.type || 'attack',
            };
        } else {
            enemy.intendedAction = {
                name:       'Attack',
                targetName: action.target ? action.target.name : '?',
                type:       'attack',
            };
        }
    }
}

// Check if any combatant died from a status-effect tick and resolve combat if so.
// Returns true if combat has ended (caller should return immediately).
function checkCombatEndAfterTick(combat, actor) {
    if (!actor.isAlive()) {
        if (actor.isFamiliar) {
            const log = msg => addToLog(combat, msg);
            nextTurn(combat);
            handleFamiliarDeath(actor, combat, log);
            if (combat.phase === 'enemy_turn') scheduleEnemyTurn(combat);
            return true;
        }

        const actorIsEnemy = combat.enemies.includes(actor);
        if (actorIsEnemy) {
            addToLog(combat, actor.name + ' succumbs to their wounds!');
            if (isAllEnemiesDefeated(combat)) {
                combat.phase = 'victory';
                addToLog(combat, 'All enemies defeated!');
                return true;
            }
            nextTurn(combat);
            if (combat.phase === 'enemy_turn') scheduleEnemyTurn(combat);
            return true;
        } else {
            if (actor.charging) {
                addToLog(combat, actor.name + ' was interrupted!');
                actor.charging = null;
            }
            addToLog(combat, actor.name + ' has fallen!');
            if (isPartyDefeated(combat)) {
                combat.phase = 'defeat';
                addToLog(combat, 'Your party has been defeated...');
                return true;
            }
            nextTurn(combat);
            if (combat.phase === 'enemy_turn') scheduleEnemyTurn(combat);
            return true;
        }
    }
    return false;
}
