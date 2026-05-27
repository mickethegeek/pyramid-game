// Combat orchestrator — init, familiar management, scheduling, and action dispatch
// Turn queue logic lives in turnQueue.js; round housekeeping in roundManager.js

// Initialise a new combat encounter
// party: Character[] — all party members; enemies: Enemy[] — all enemies in this encounter
function initCombat(party, enemies) {
    const queue         = buildInitiativeQueue(party, enemies);
    const firstIsPlayer = queue[0].isPlayer;

    const combat = {
        party:   party,
        enemies: enemies,
        player:  party[0],     // convenience alias — legacy helpers use state.player instead
        enemy:   enemies[0],   // convenience alias — used for boss isBoss checks in main.js
        queue:   queue,        // sorted array of { combatant, isPlayer }
        turnIndex:   0,        // index into queue of the current actor
        log:         [],       // recent combat messages (max 200 shown)
        phase:       firstIsPlayer ? 'player_turn' : 'enemy_turn',
        turnStarted: false,    // guards against double-ticking per turn
        // first_hit_crit passive: true until any party member lands their first attack
        playerFirstHitPending: party.some(m => hasPassive(m, 'first_hit_crit')),
        // click-to-target: the enemy the player has explicitly selected; null = auto-target
        selectedTarget: null,
    };

    // Mark of Suffering relic: deal 5 damage to every living party member at combat start
    if (hasRelic('mark_of_suffering')) {
        for (const member of party) {
            if (member.isAlive()) member.currentHP = Math.max(1, member.currentHP - 5);
        }
        addToLog(combat, 'Mark of Suffering: the party takes 5 damage!');
    }

    // Aggro: party members starting in the front row open with initial threat
    for (const member of party) {
        if (member.row === 'front') member.aggro += 20;
    }

    // Pre-roll enemy intentions immediately if the player acts first
    if (firstIsPlayer) prerollEnemyIntentions(combat);

    return combat;
}

// ─── Familiar queue management ─────────────────────────────────────────────────

// Centralised familiar death cleanup.
// Call AFTER nextTurn() has advanced the index past the dead unit so queue removal is safe.
function handleFamiliarDeath(unit, combat, log) {
    unit.onDeath(log);

    // Dark Covenant: if summoner's bloodPactBonus carries onDeathDouble, fire the hook a second time
    const summoner = state.party && state.party.find(m => m.className === 'summoner' && m.isAlive());
    if (summoner && summoner.bloodPactBonus && summoner.bloodPactBonus.onDeathDouble) {
        log(unit.name + "'s death effect echoes (Dark Covenant)!");
        unit.onDeath(log);
    }

    // Remove from state.activeFamiliars
    if (state.activeFamiliars) {
        state.activeFamiliars = state.activeFamiliars.filter(u => u !== unit);
    }

    // Remove the unit's slot from the initiative queue and correct turnIndex
    const slotIdx = combat.queue.findIndex(s => s.combatant === unit);
    if (slotIdx >= 0) {
        combat.queue.splice(slotIdx, 1);
        if (slotIdx < combat.turnIndex) {
            combat.turnIndex = Math.max(0, combat.turnIndex - 1);
        }
        if (combat.turnIndex >= combat.queue.length && combat.queue.length > 0) {
            combat.turnIndex = combat.queue.length - 1;
        }
    }

    // Clear bat DEF-reduction aura if no bats remain alive
    if (state.batAuraActive) {
        const aliveBats = (state.activeFamiliars || []).filter(
            u => u.familiarKey === 'bat' && u.currentHP > 0
        );
        if (aliveBats.length === 0) state.batAuraActive = false;
    }

    // Keep the legacy single-familiar reference in sync (non-herald preferred)
    state.activeFamiliar = (state.activeFamiliars || []).find(
        u => u.familiarKey !== 'herald' && u.currentHP > 0
    ) || (state.activeFamiliars || []).find(u => u.currentHP > 0) || null;
}

// Complete recall of all active familiars for a given group key.
function recallFamiliarGroup(familiarKey, summoner, combat, log) {
    const group = (state.activeFamiliars || []).filter(u => u.familiarKey === familiarKey);
    if (!group.length) return;

    for (const unit of group) {
        unit.onRecall(log);
    }

    state.activeFamiliars = (state.activeFamiliars || []).filter(u => u.familiarKey !== familiarKey);

    if (combat && combat.queue) {
        const keys = new Set(group.map(u => u));
        for (let i = combat.queue.length - 1; i >= 0; i--) {
            if (keys.has(combat.queue[i].combatant)) {
                combat.queue.splice(i, 1);
                if (i < combat.turnIndex) combat.turnIndex = Math.max(0, combat.turnIndex - 1);
            }
        }
    }

    if (familiarKey === 'bat') state.batAuraActive = false;

    state.activeFamiliar = (state.activeFamiliars || []).find(
        u => u.familiarKey !== 'herald' && u.currentHP > 0
    ) || (state.activeFamiliars || []).find(u => u.currentHP > 0) || null;
}

// Execute a familiar's autonomous turn — attacks the highest-aggro alive enemy
function executeFamiliarTurn(combat) {
    const actor      = getCurrentActor(combat);
    const wasStunned = startOfTurn(combat, actor);

    if (checkCombatEndAfterTick(combat, actor)) return;

    if (wasStunned) {
        addToLog(combat, actor.name + ' is stunned and cannot act!');
        nextTurn(combat);
        if (combat.phase === 'enemy_turn') scheduleEnemyTurn(combat);
        return;
    }

    if (!actor.isAlive()) {
        nextTurn(combat);
        if (combat.phase === 'enemy_turn') scheduleEnemyTurn(combat);
        return;
    }

    const targets = getAliveEnemies(combat);
    if (!targets.length) {
        nextTurn(combat);
        return;
    }

    const target = targets.reduce((a, b) => b.aggro > a.aggro ? b : a);
    const log    = msg => addToLog(combat, msg);
    const result = basicAttack(actor, target, false, log);

    if (!result.missed) {
        const msg = result.isCrit
            ? 'CRITICAL! ' + actor.name + ' pounces on ' + target.name + ' for ' + result.damage + '!'
            : actor.name + ' pounces on ' + target.name + ' for ' + result.damage + ' damage!';
        addToLog(combat, msg);
    }

    if (!target.isAlive()) addToLog(combat, target.name + ' is defeated!');

    if (isAllEnemiesDefeated(combat)) {
        combat.phase = 'victory';
        addToLog(combat, 'All enemies defeated!');
        return;
    }

    nextTurn(combat);
    if (combat.phase === 'enemy_turn') scheduleEnemyTurn(combat);
}

// ─── Enemy turn scheduling ─────────────────────────────────────────────────────

// Schedule an enemy turn to execute after a short delay
function scheduleEnemyTurn(combat) {
    combat.pendingEnemyTurn = true;
    combat.enemyTurnTime    = performance.now() + (state.settings.enemyTurnDelay);
}

// ─── Charge-up scheduling ──────────────────────────────────────────────────────

// Schedule an automatic charge tick for a charging player
function scheduleChargeTick(combat) {
    combat.pendingChargeTick = true;
    combat.chargeTickTime    = performance.now() + (state.settings.chargeTickDelay);
}

// Process one automatic tick of a charge-up ability on the currently-acting character.
function executeChargeUpTick(combat) {
    const actor    = getCurrentActor(combat);
    const charging = actor.charging;
    if (!charging) return;

    const wasStunned = startOfTurn(combat, actor);
    if (checkCombatEndAfterTick(combat, actor)) return;

    if (wasStunned) {
        actor.charging = null;
        addToLog(combat, actor.name + ' is stunned — ' + charging.abilityName + ' interrupted!');
        nextTurn(combat);
        if (combat.phase === 'enemy_turn') scheduleEnemyTurn(combat);
        return;
    }

    charging.turnsLeft--;

    if (charging.turnsLeft > 0) {
        addToLog(combat, actor.name + ' is charging ' + charging.abilityName + '...');
        nextTurn(combat);
        if (combat.phase === 'enemy_turn') scheduleEnemyTurn(combat);
        return;
    }

    actor.charging = null;
    const ability  = actor.abilities && actor.abilities.find(a => a.key === charging.abilityKey);
    const skillDef = !ability && SKILL_DATA && SKILL_DATA[charging.abilityKey];

    if (!ability && !skillDef) {
        addToLog(combat, charging.abilityName + ' fizzles — ability not found.');
        nextTurn(combat);
        if (combat.phase === 'enemy_turn') scheduleEnemyTurn(combat);
        return;
    }

    const target = (combat.selectedTarget && combat.selectedTarget.isAlive())
        ? combat.selectedTarget
        : getAliveEnemies(combat)[0];
    combat.selectedTarget = null;

    if (ability) {
        addToLog(combat, actor.name + ' unleashes ' + ability.name + '!');
        ability.use(actor, target, msg => addToLog(combat, msg), combat);
    } else {
        const level        = actor.skillLevels[charging.abilityKey] || 1;
        const effectTarget = skillDef.attackType === 'aoe' ? getAliveEnemies(combat) : target;
        addToLog(combat, actor.name + ' unleashes ' + skillDef.levels[level].name + '!');
        skillDef.effect(actor, effectTarget, level, msg => addToLog(combat, msg));
    }
    actor.aggro += 10;

    if (target && !target.isAlive()) addToLog(combat, target.name + ' is defeated!');

    if (isAllEnemiesDefeated(combat)) {
        combat.phase = 'victory';
        addToLog(combat, 'All enemies defeated!');
        return;
    }
    if (isPartyDefeated(combat)) {
        combat.phase = 'defeat';
        addToLog(combat, 'Your party has been defeated...');
        return;
    }

    nextTurn(combat);
    if (combat.phase === 'enemy_turn') scheduleEnemyTurn(combat);
}

// ─── Player actions ────────────────────────────────────────────────────────────

// Execute a skill by key for the currently-acting party member
function executePlayerSkill(combat, skillKey) {
    if (!skillKey) return;
    const skillDef = SKILL_DATA && SKILL_DATA[skillKey];
    if (!skillDef) return;

    const actor     = getCurrentActor(combat);
    const level     = actor.skillLevels[skillKey] || 1;
    const cost      = skillDef.levels[level].manaCost || 3;
    const skillName = skillDef.levels[level].name;

    const hasResource = actor.maxStamina > 0 ? actor.hasStamina(cost) : actor.hasMana(cost);
    if (!hasResource) {
        const res = actor.maxStamina > 0 ? 'stamina' : 'mana';
        addToLog(combat, 'Not enough ' + res + ' for ' + skillName + '!');
        return;
    }

    if (skillDef.chargeUp && !actor.charging) {
        const wasStunned = startOfTurn(combat, actor);
        if (checkCombatEndAfterTick(combat, actor)) return;
        if (wasStunned) {
            addToLog(combat, actor.name + ' is stunned and cannot act!');
            nextTurn(combat);
            if (combat.phase === 'enemy_turn') scheduleEnemyTurn(combat);
            return;
        }
        if (actor.maxStamina > 0) actor.spendStamina(cost);
        else actor.spendMana(cost);
        actor.charging = { abilityKey: skillKey, abilityName: skillName, turnsLeft: 2 };
        addToLog(combat, actor.name + ' begins charging ' + skillName + '!');
        actor.aggro += 10;
        nextTurn(combat);
        if (combat.phase === 'enemy_turn') scheduleEnemyTurn(combat);
        return;
    }

    const wasStunned = startOfTurn(combat, actor);
    if (checkCombatEndAfterTick(combat, actor)) return;

    if (wasStunned) {
        addToLog(combat, actor.name + ' is stunned and cannot act!');
        nextTurn(combat);
        if (combat.phase === 'enemy_turn') scheduleEnemyTurn(combat);
        return;
    }

    if (actor.wasSilenced) {
        addToLog(combat, actor.name + ' is silenced and cannot use skills!');
        nextTurn(combat);
        if (combat.phase === 'enemy_turn') scheduleEnemyTurn(combat);
        return;
    }

    let target;
    if (skillDef.attackType === 'aoe') {
        target = getAliveEnemies(combat);
    } else if (skillDef.attackType === 'self') {
        target = actor;
    } else {
        target = (combat.selectedTarget && combat.selectedTarget.isAlive() && !combat.selectedTarget.untargetable)
            ? combat.selectedTarget
            : getAliveEnemies(combat)[0];
        combat.selectedTarget = null;
    }

    const success = useSkill(actor, skillKey, target, msg => addToLog(combat, msg));
    if (!success) {
        nextTurn(combat);
        if (combat.phase === 'enemy_turn') scheduleEnemyTurn(combat);
        return;
    }

    // Multi-arrow skills hold the turn open — combatUI fires each arrow on click
    if (actor.volleyArrowsLeft > 0 || actor.eclipseArrowsLeft > 0) return;

    // Radiant Word two-step: hold the turn open while the player clicks an ally
    if (actor.radiantWordHealPending) return;

    if (target && !Array.isArray(target) && !target.isAlive()) {
        addToLog(combat, target.name + ' is defeated!');
    }

    if (isAllEnemiesDefeated(combat)) {
        combat.phase = 'victory';
        addToLog(combat, 'All enemies defeated!');
        return;
    }
    if (isPartyDefeated(combat)) {
        combat.phase = 'defeat';
        return;
    }

    nextTurn(combat);
    if (combat.phase === 'enemy_turn') scheduleEnemyTurn(combat);
}

// Execute the currently-acting party member's basic attack
function executePlayerAttack(combat) {
    const actor      = getCurrentActor(combat);
    const wasStunned = startOfTurn(combat, actor);

    if (checkCombatEndAfterTick(combat, actor)) return;

    if (wasStunned) {
        addToLog(combat, actor.name + ' is stunned and cannot act!');
        nextTurn(combat);
        if (combat.phase === 'enemy_turn') scheduleEnemyTurn(combat);
        return;
    }

    const target = (combat.selectedTarget && combat.selectedTarget.isAlive() && !combat.selectedTarget.untargetable)
        ? combat.selectedTarget
        : getAliveEnemies(combat)[0];
    combat.selectedTarget = null;
    if (!target) return;

    const forceCrit = combat.playerFirstHitPending;
    if (forceCrit) combat.playerFirstHitPending = false;

    const result = basicAttack(actor, target, forceCrit, msg => addToLog(combat, msg));

    if (!result.missed) {
        const msg = result.isCrit
            ? 'CRITICAL! ' + actor.name + ' strikes ' + target.name + ' for ' + result.damage + '!'
            : actor.name + ' attacks ' + target.name + ' for ' + result.damage + ' damage.';
        addToLog(combat, msg);
    }

    if (!actor.isAlive()) {
        addToLog(combat, actor.name + ' is slain by Retribution!');
        if (isPartyDefeated(combat)) {
            combat.phase = 'defeat';
            addToLog(combat, 'Your party has been defeated...');
            return;
        }
        nextTurn(combat);
        if (combat.phase === 'enemy_turn') scheduleEnemyTurn(combat);
        return;
    }

    if (!target.isAlive()) {
        addToLog(combat, target.name + ' is defeated!');
        handleEnemyDeath(target, combat, msg => addToLog(combat, msg));
    }

    if (isAllEnemiesDefeated(combat)) {
        combat.phase = 'victory';
        addToLog(combat, 'All enemies defeated!');
        return;
    }

    nextTurn(combat);
    if (combat.phase === 'enemy_turn') scheduleEnemyTurn(combat);
}

// Execute an ability by slot index for the currently-acting party member
function executePlayerAbility(combat, abilityIndex) {
    const actor   = getCurrentActor(combat);
    const ability = actor.abilities && actor.abilities[abilityIndex];
    if (!ability) return;

    if (!actor.hasMana(ability.manaCost)) {
        addToLog(combat, 'Not enough mana for ' + ability.name + '!');
        return;
    }

    if (ability.isReady && !ability.isReady(actor, combat)) {
        const cd = ability.getCooldown ? ability.getCooldown(actor) : 0;
        addToLog(combat, cd > 0
            ? ability.name + ' is on cooldown (' + cd + ' turns)!'
            : 'No valid target for ' + ability.name + '!');
        return;
    }

    if (ability.chargeUp && !actor.charging) {
        const wasStunned = startOfTurn(combat, actor);
        if (checkCombatEndAfterTick(combat, actor)) return;
        if (wasStunned) {
            addToLog(combat, actor.name + ' is stunned and cannot act!');
            nextTurn(combat);
            if (combat.phase === 'enemy_turn') scheduleEnemyTurn(combat);
            return;
        }
        actor.spendMana(ability.manaCost);
        actor.charging = { abilityKey: ability.key, abilityName: ability.name, turnsLeft: ability.chargeTurns || 2 };
        addToLog(combat, actor.name + ' begins charging ' + ability.name + '!');
        nextTurn(combat);
        if (combat.phase === 'enemy_turn') scheduleEnemyTurn(combat);
        return;
    }

    const wasStunned = startOfTurn(combat, actor);
    if (checkCombatEndAfterTick(combat, actor)) return;

    if (wasStunned) {
        addToLog(combat, actor.name + ' is stunned and cannot act!');
        nextTurn(combat);
        if (combat.phase === 'enemy_turn') scheduleEnemyTurn(combat);
        return;
    }

    if (actor.wasSilenced) {
        addToLog(combat, actor.name + ' is silenced and cannot use abilities!');
        nextTurn(combat);
        if (combat.phase === 'enemy_turn') scheduleEnemyTurn(combat);
        return;
    }

    const target = (combat.selectedTarget && combat.selectedTarget.isAlive() && !combat.selectedTarget.untargetable)
        ? combat.selectedTarget
        : getAliveEnemies(combat)[0];
    combat.selectedTarget = null;

    actor.spendMana(ability.manaCost);
    addToLog(combat, actor.name + ' uses ' + ability.name + '!');
    ability.use(actor, target, msg => addToLog(combat, msg), combat);
    actor.aggro += 10;

    if (target && !target.isAlive()) addToLog(combat, target.name + ' is defeated!');

    if (isAllEnemiesDefeated(combat)) {
        combat.phase = 'victory';
        addToLog(combat, 'All enemies defeated!');
        return;
    }

    if (isPartyDefeated(combat)) {
        combat.phase = 'defeat';
        return;
    }

    nextTurn(combat);
    if (combat.phase === 'enemy_turn') scheduleEnemyTurn(combat);
}

// Apply Shield status to the acting character and grant double mana regen this turn
function executePlayerShield(combat) {
    const actor      = getCurrentActor(combat);
    const wasStunned = startOfTurn(combat, actor);

    if (checkCombatEndAfterTick(combat, actor)) return;

    if (wasStunned) {
        addToLog(combat, actor.name + ' is stunned and cannot act!');
        nextTurn(combat);
        if (combat.phase === 'enemy_turn') scheduleEnemyTurn(combat);
        return;
    }

    applyStatusEffect(actor, 'shield', msg => addToLog(combat, msg));
    if (actor.regenMana) actor.regenMana();
    addToLog(combat, actor.name + ' raises their shield and steadies their mind!');

    nextTurn(combat);
    if (combat.phase === 'enemy_turn') scheduleEnemyTurn(combat);
}

// Move the active party member between front and back row — costs their full turn
function executePlayerRowSwitch(combat) {
    const actor      = getCurrentActor(combat);
    const wasStunned = startOfTurn(combat, actor);

    if (checkCombatEndAfterTick(combat, actor)) return;

    if (wasStunned) {
        addToLog(combat, actor.name + ' is stunned and cannot act!');
        nextTurn(combat);
        if (combat.phase === 'enemy_turn') scheduleEnemyTurn(combat);
        return;
    }

    const dest = (actor.row === 'front') ? 'back' : 'front';
    actor.row  = dest;
    if (dest === 'front') actor.aggro += 10;
    addToLog(combat, actor.name + ' moves to the ' + dest + ' row.');

    nextTurn(combat);
    if (combat.phase === 'enemy_turn') scheduleEnemyTurn(combat);
}

// Swap rows between the active party member and a chosen ally
function executePlayerRowSwap(combat, swapTarget) {
    const initiator  = getCurrentActor(combat);
    const wasStunned = startOfTurn(combat, initiator);

    if (checkCombatEndAfterTick(combat, initiator)) return;

    if (wasStunned) {
        addToLog(combat, initiator.name + ' is stunned and cannot act!');
        nextTurn(combat);
        if (combat.phase === 'enemy_turn') scheduleEnemyTurn(combat);
        return;
    }

    const initRow = initiator.row;
    initiator.row  = swapTarget.row;
    swapTarget.row = initRow;

    if (initiator.row === 'front') initiator.aggro  += 10;
    if (swapTarget.row === 'front') swapTarget.aggro += 10;

    addToLog(combat, initiator.name + ' swaps positions with ' + swapTarget.name + '.');

    nextTurn(combat);
    if (combat.phase === 'enemy_turn') scheduleEnemyTurn(combat);
}

// Switch the Warrior's stance between 'battle' and 'guard' — costs their full turn
function executePlayerStanceSwitch(combat) {
    const actor      = getCurrentActor(combat);
    const wasStunned = startOfTurn(combat, actor);

    if (checkCombatEndAfterTick(combat, actor)) return;

    if (wasStunned) {
        addToLog(combat, actor.name + ' is stunned and cannot act!');
        nextTurn(combat);
        if (combat.phase === 'enemy_turn') scheduleEnemyTurn(combat);
        return;
    }

    switchStance(actor);
    const msg = actor.stance === 'battle'
        ? actor.name + ' switches to Battle Stance! (+20% damage dealt)'
        : actor.name + ' switches to Guard Stance! (-25% damage taken)';
    addToLog(combat, msg);

    nextTurn(combat);
    if (combat.phase === 'enemy_turn') scheduleEnemyTurn(combat);
}

// Execute a potion use — removes from pool, applies effect, ends the turn
function executePlayerPotion(combat, potionKey, targetEnemy) {
    const actor  = getCurrentActor(combat);
    const potion = POTION_DATA[potionKey];
    if (!potion) return;

    const wasStunned = startOfTurn(combat, actor);

    if (checkCombatEndAfterTick(combat, actor)) return;

    if (wasStunned) {
        addToLog(combat, actor.name + ' is stunned and cannot act!');
        nextTurn(combat);
        if (combat.phase === 'enemy_turn') scheduleEnemyTurn(combat);
        return;
    }

    removePotionFromPool(potionKey);

    const wasAlive = new Set(getAliveEnemies(combat));
    const aliveNow = getAliveEnemies(combat);

    applyPotion(potion, actor, targetEnemy, aliveNow, msg => addToLog(combat, msg));

    for (const enemy of wasAlive) {
        if (!enemy.isAlive()) addToLog(combat, enemy.name + ' is defeated!');
    }

    if (isAllEnemiesDefeated(combat)) {
        combat.phase = 'victory';
        addToLog(combat, 'All enemies defeated!');
        return;
    }

    if (isPartyDefeated(combat)) {
        combat.phase = 'defeat';
        addToLog(combat, 'Your party has been defeated...');
        return;
    }

    nextTurn(combat);
    if (combat.phase === 'enemy_turn') scheduleEnemyTurn(combat);
}

// ─── Enemy actions ─────────────────────────────────────────────────────────────

// Execute the currently-acting enemy's turn automatically
function executeEnemyTurn(combat) {
    const actor = getCurrentActor(combat);

    if (actor.isFamiliar) return executeFamiliarTurn(combat);
    if (actor.key === 'goremaw') { executeGoremawTurn(combat); return; }

    actor.turnCount++;

    const wasStunned = startOfTurn(combat, actor);

    if (checkCombatEndAfterTick(combat, actor)) return;

    if (wasStunned) {
        addToLog(combat, actor.name + ' is stunned and cannot act!');
        nextTurn(combat);
        if (combat.phase === 'enemy_turn') executeEnemyTurn(combat);
        return;
    }

    const alive = getAlivePartyMembers(combat);
    checkEnemyPassive(actor, combat, msg => addToLog(combat, msg));

    let action;
    if (actor._prerolledAction) {
        action = actor._prerolledAction;
        actor._prerolledAction = null;
        if (action.target && !action.target.isAlive()) {
            action = getEnemyAction(actor, alive);
        }
    } else {
        action = getEnemyAction(actor, alive);
    }

    if (action.type === 'defend') {
        actor.addStatusEffect('shield', msg => addToLog(combat, msg));
        if (action.isPassiveDefend) {
            actor.addStatusEffect('fortify', msg => addToLog(combat, msg));
        } else {
            addToLog(combat, actor.name + ' braces for the next strike!');
        }
    } else {
        const target = action.target;

        if (actor.isPinned && actor.attackType === 'melee') {
            addToLog(combat, actor.name + ' is pinned and cannot attack!');
        } else if (action.ability) {
            action.ability.use(actor, target, msg => addToLog(combat, msg), combat);

            for (const member of combat.party) {
                if (!member.isAlive() && !member._deathLogged) {
                    addToLog(combat, member.name + ' has fallen!');
                    member._deathLogged = true;
                }
            }

            if (isPartyDefeated(combat)) {
                combat.phase = 'defeat';
                addToLog(combat, 'Your party has been defeated...');
                return;
            }
        } else {
            // Front row interception: when a melee enemy targets a back-row party member
            if ((actor.attackType || 'melee') === 'melee' && target.row === 'back') {
                const frontAllies = combat.party.filter(m => m.isAlive() && m.row === 'front');
                if (frontAllies.length > 0) {
                    const interceptor = frontAllies.reduce((a, b) => b.aggro > a.aggro ? b : a);
                    addToLog(combat, interceptor.name + ' intercepts for ' + target.name + '!');
                    if (rollDodge(actor, 'interception')) {
                        addToLog(combat, actor.name + ' dodged the interception!');
                    } else {
                        const icResult = basicAttack(interceptor, actor, false, msg => addToLog(combat, msg), true);
                        if (!icResult.missed) {
                            const msg = icResult.isCrit
                                ? 'CRITICAL! ' + interceptor.name + ' counters ' + actor.name + ' for ' + icResult.damage + '!'
                                : interceptor.name + ' counters ' + actor.name + ' for ' + icResult.damage + ' damage.';
                            addToLog(combat, msg);
                        }
                        if (!actor.isAlive()) {
                            addToLog(combat, actor.name + ' is slain by the interception!');
                            handleEnemyDeath(actor, combat, msg => addToLog(combat, msg));
                            if (isAllEnemiesDefeated(combat)) {
                                combat.phase = 'victory';
                                addToLog(combat, 'All enemies defeated!');
                                return;
                            }
                            nextTurn(combat);
                            if (combat.phase === 'enemy_turn') executeEnemyTurn(combat);
                            return;
                        }
                    }
                }
            }

            const result = basicAttack(actor, target, false, msg => addToLog(combat, msg));

            if (!result.missed) {
                const msg = result.isCrit
                    ? 'CRITICAL! ' + actor.name + ' strikes ' + target.name + ' for ' + result.damage + '!'
                    : actor.name + ' attacks ' + target.name + ' for ' + result.damage + ' damage.';
                addToLog(combat, msg);
            }

            if (!actor.isAlive()) {
                addToLog(combat, actor.name + ' is slain by Retribution!');
                handleEnemyDeath(actor, combat, msg => addToLog(combat, msg));
                if (isAllEnemiesDefeated(combat)) {
                    combat.phase = 'victory';
                    addToLog(combat, 'All enemies defeated!');
                    return;
                }
                nextTurn(combat);
                if (combat.phase === 'enemy_turn') executeEnemyTurn(combat);
                return;
            }

            if (!target.isAlive()) {
                addToLog(combat, target.name + ' has fallen!');
            }

            if (isPartyDefeated(combat)) {
                combat.phase = 'defeat';
                addToLog(combat, 'Your party has been defeated...');
                return;
            }
        }
    }

    nextTurn(combat);
    if (combat.phase === 'enemy_turn') executeEnemyTurn(combat);
}
