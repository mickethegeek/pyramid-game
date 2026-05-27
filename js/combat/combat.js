// Turn loop and initiative queue — the core combat state machine

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
        log:         [],       // recent combat messages (max 4 shown)
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

// Build one shared initiative queue from all party members, enemies, and active familiar, sorted by SPD desc
function buildInitiativeQueue(party, enemies) {
    const slots = [
        ...party.map(member => ({ combatant: member, isPlayer: true  })),
        ...enemies.map(enemy  => ({ combatant: enemy,  isPlayer: false })),
    ];
    // If a familiar is already active (carried in from a previous combat), slot it in by SPD
    if (state.activeFamiliar && state.activeFamiliar.isAlive()) {
        slots.push({ combatant: state.activeFamiliar, isPlayer: false, isFamiliar: true });
    }
    return slots.sort((a, b) => b.combatant.getStat('spd') - a.combatant.getStat('spd'));
}

// Return the combatant whose turn it currently is
function getCurrentActor(combat) {
    return combat.queue[combat.turnIndex].combatant;
}

// Return all party members who are still alive
function getAlivePartyMembers(combat) {
    return combat.party.filter(m => m.isAlive());
}

// Return all enemies who are still alive and targetable
// Enemies with untargetable === true (e.g. Goremaw while submerging) are excluded
function getAliveEnemies(combat) {
    return combat.enemies.filter(e => e.isAlive() && !e.untargetable);
}

// Return true if every party member has been defeated
function isPartyDefeated(combat) {
    return combat.party.every(m => !m.isAlive());
}

// Return true if every enemy has been defeated
function isAllEnemiesDefeated(combat) {
    return combat.enemies.every(e => !e.isAlive());
}

// Advance to the next living combatant in the queue, skipping dead ones.
// Pre-rolls all enemy intentions when a player turn begins so telegraphs are ready to display.
// Triggers aggro decay after every full pass through the queue (one complete round).
function nextTurn(combat) {
    const total = combat.queue.length;
    let   steps = 0;
    do {
        combat.turnIndex = (combat.turnIndex + 1) % total;
        steps++;
    } while (!combat.queue[combat.turnIndex].combatant.isAlive() && steps < total);

    combat.turnStarted = false;
    const current = combat.queue[combat.turnIndex];
    combat.phase  = current.isPlayer ? 'player_turn' : 'enemy_turn';

    // Count turns; when a full queue cycle completes, run all round-end effects
    combat.turnsSinceDecay = (combat.turnsSinceDecay || 0) + 1;
    if (combat.turnsSinceDecay >= total) {
        decayAggro(combat);
        processRoundEnd(combat);
        combat.turnsSinceDecay = 0;
    }

    // Charge-up: if a charging player's turn just started, auto-schedule the tick
    if (current.isPlayer && current.combatant.charging) {
        scheduleChargeTick(combat);
    }

    // Pre-roll intentions so badges are visible to the player before enemies act
    if (combat.phase === 'player_turn') prerollEnemyIntentions(combat);
}

// Reduce all living combatants' aggro by 5% at the end of each full round.
// Keeps the threat table dynamic — idle party members gradually lose threat.
function decayAggro(combat) {
    for (const slot of combat.queue) {
        const c = slot.combatant;
        if (c.isAlive()) c.aggro = Math.max(0, Math.floor(c.aggro * 0.95));
    }
}

// Tick all per-round party buffs at the end of every full initiative cycle.
// Handles Sacred Aura heal-over-time and the shared damageReduction expiry.
function processRoundEnd(combat) {
    const log = msg => addToLog(combat, msg);

    for (const member of combat.party) {
        if (!member.isAlive()) continue;

        // ── Sacred Aura heal tick ─────────────────────────────────────────────
        if ((member.sacredAuraTurns || 0) > 0) {
            // Heal this party member
            member.currentHP = Math.min(member.getMaxHP(), member.currentHP + member.sacredAuraHeal);
            log(member.name + ' is healed for ' + member.sacredAuraHeal + ' HP by Sacred Aura!');

            // Aggro goes to the Paladin who cast Sacred Aura (identified by the 'sacred_aura' effect)
            const caster = state.party.find(
                m => m.activeEffects && m.activeEffects.some(e => e.key === 'sacred_aura')
            );
            if (caster) caster.aggro += Math.floor(member.sacredAuraHeal * 0.8);

            member.sacredAuraTurns--;

            // Sacred Aura expired — clean up; only zero DR if its own timer is also done
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
        // Bog Rat death tracking: recalculate bogRatBuff from living Goremaw-spawned rats only.
        // Only Goremaw-spawned rats count toward bogRatBuff.
        const livingSpawnedRats = combat.enemies.filter(
            e => e.key === 'bogRat' && e.spawnedByGoremaw && e.isAlive()
        );
        goremaw.bogRatBuff = livingSpawnedRats.length * goremaw.passive.bogRatDmgBonus;

        // Phase 2 regen: Goremaw heals every round while in phase 2.
        // Phase 2 regen applied in combat.js onRoundEnd.
        if (goremaw.phase === 2) {
            goremaw.currentHP = Math.min(goremaw.getMaxHP(), goremaw.currentHP + goremaw.passive.phase2Regen);
            log('Goremaw regenerates ' + goremaw.passive.phase2Regen + ' HP from the swamp!');
        }
    }

    // Added in Prompt 19c — Herald passive: while the Herald is alive, every non-herald familiar's
    // onDeath effect echoes at the end of each round. The familiar itself is NOT removed — this is
    // a passive trigger only. herald's template guards heraldActive; we also verify the Herald unit
    // is still alive so the echo stops the turn it dies.
    if (state.heraldActive) {
        const heraldAlive = (state.activeFamiliars || []).some(
            u => u.familiarKey === 'herald' && u.currentHP > 0
        );
        if (heraldAlive) {
            for (const unit of (state.activeFamiliars || [])) {
                if (unit.familiarKey !== 'herald' && unit.currentHP > 0) {
                    log('The Herald pulses — ' + unit.name + "'s death echo fires!");
                    unit.onDeath(log);   // fires template effect without cleanup
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

        // Cache the full action so executeEnemyTurn uses it instead of re-rolling
        enemy._prerolledAction = action;

        // Build the display badge from the same roll
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

// Append a message to the combat log; keep up to 200 entries so the player can scroll history
function addToLog(combat, message) {
    combat.log.push(message);
    if (combat.log.length > 200) combat.log.shift();
}

// Run start-of-turn housekeeping: tick status effects and regenerate mana.
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

// ─── Familiar queue management ─────────────────────────────────────────────────

// Insert a newly-summoned familiar into the queue right after the current actor's slot
function injectFamiliarIntoQueue(combat, familiar) {
    const slot = { combatant: familiar, isPlayer: false, isFamiliar: true };
    combat.queue.splice(combat.turnIndex + 1, 0, slot);
}

// Added in Prompt 19c — Centralised familiar death cleanup.
// Call AFTER nextTurn() has advanced the index past the dead unit so queue removal is safe.
// Handles: onDeath hook, Dark Covenant double-fire, state.activeFamiliars pruning,
// queue slot removal with turnIndex correction, bat aura clear, legacy activeFamiliar update.
// Herald's template.onDeath already calls summonFamiliarGroup(dog+crow) and clears heraldActive.
function handleFamiliarDeath(unit, combat, log) {
    // 1. Fire the unit's onDeath hook (bridges to template.onDeath via this.summoner)
    unit.onDeath(log);

    // 2. Dark Covenant: if summoner's bloodPactBonus carries onDeathDouble, fire the hook a second time
    // Added in Prompt 19c
    const summoner = state.party && state.party.find(m => m.className === 'summoner' && m.isAlive());
    if (summoner && summoner.bloodPactBonus && summoner.bloodPactBonus.onDeathDouble) {
        log(unit.name + "'s death effect echoes (Dark Covenant)!");
        unit.onDeath(log);
    }

    // 3. Remove from state.activeFamiliars
    // Added in Prompt 19c
    if (state.activeFamiliars) {
        state.activeFamiliars = state.activeFamiliars.filter(u => u !== unit);
    }

    // 4. Remove the unit's slot from the initiative queue and correct turnIndex.
    // We call this AFTER nextTurn() so the slot is now behind the current index.
    // If the removed slot was before turnIndex, decrement to compensate for the shift.
    // Added in Prompt 19c
    const slotIdx = combat.queue.findIndex(s => s.combatant === unit);
    if (slotIdx >= 0) {
        combat.queue.splice(slotIdx, 1);
        if (slotIdx < combat.turnIndex) {
            combat.turnIndex = Math.max(0, combat.turnIndex - 1);
        }
        // Guard: turnIndex must stay in bounds after any insertions/removals
        if (combat.turnIndex >= combat.queue.length && combat.queue.length > 0) {
            combat.turnIndex = combat.queue.length - 1;
        }
    }

    // 5. Clear bat DEF-reduction aura if no bats remain alive
    // Added in Prompt 19c
    if (state.batAuraActive) {
        const aliveBats = (state.activeFamiliars || []).filter(
            u => u.familiarKey === 'bat' && u.currentHP > 0
        );
        if (aliveBats.length === 0) state.batAuraActive = false;
    }

    // 6. Keep the legacy single-familiar reference in sync (non-herald preferred)
    state.activeFamiliar = (state.activeFamiliars || []).find(
        u => u.familiarKey !== 'herald' && u.currentHP > 0
    ) || (state.activeFamiliars || []).find(u => u.currentHP > 0) || null;
}

// Added in Prompt 19c — Complete recall of all active familiars for a given group key.
// Fires each unit's onRecall hook (bat template clears batAuraActive; herald clears heraldActive),
// purges units from state.activeFamiliars and the initiative queue.
// Called by skillData effects; also available as a shared helper for future recall sites.
function recallFamiliarGroup(familiarKey, summoner, combat, log) {
    const group = (state.activeFamiliars || []).filter(u => u.familiarKey === familiarKey);
    if (!group.length) return;

    // Fire onRecall on each unit (the first call sets group-level flags via the template)
    // Added in Prompt 19c
    for (const unit of group) {
        unit.onRecall(log);
    }

    // Remove group from state
    // Added in Prompt 19c
    state.activeFamiliars = (state.activeFamiliars || []).filter(u => u.familiarKey !== familiarKey);

    // Remove group slots from queue (iterate backwards to avoid index drift)
    // Added in Prompt 19c
    if (combat && combat.queue) {
        const keys = new Set(group.map(u => u));
        for (let i = combat.queue.length - 1; i >= 0; i--) {
            if (keys.has(combat.queue[i].combatant)) {
                combat.queue.splice(i, 1);
                if (i < combat.turnIndex) combat.turnIndex = Math.max(0, combat.turnIndex - 1);
            }
        }
    }

    // Ensure batAuraActive is cleared if this was a bat recall (template should have done it,
    // but guard here in case the template was not invoked correctly)
    // Added in Prompt 19c
    if (familiarKey === 'bat') state.batAuraActive = false;

    // Update legacy reference
    state.activeFamiliar = (state.activeFamiliars || []).find(
        u => u.familiarKey !== 'herald' && u.currentHP > 0
    ) || (state.activeFamiliars || []).find(u => u.currentHP > 0) || null;
}

// Execute a familiar's autonomous turn — attacks a random alive enemy
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

    // If familiar was devoured mid-queue, its HP is 0 — skip and clean up
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

    // Attack the alive enemy with the highest aggro (same threat logic as aggressive AI)
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

// Schedule an enemy turn to execute after a short delay.
// Call this instead of executeEnemyTurn() so the player can read what just happened.
function scheduleEnemyTurn(combat) {
    combat.pendingEnemyTurn = true;
    combat.enemyTurnTime    = performance.now() + (state.settings.enemyTurnDelay);
}

// ─── Charge-up scheduling ──────────────────────────────────────────────────────

// Schedule an automatic charge tick for a charging player — same delay as enemy turns.
function scheduleChargeTick(combat) {
    combat.pendingChargeTick = true;
    combat.chargeTickTime    = performance.now() + (state.settings.chargeTickDelay);
}

// Process one automatic tick of a charge-up ability on the currently-acting character.
// Called by the game loop when pendingChargeTick fires.
// On the final tick (turnsLeft reaches 0) the ability fires automatically.
function executeChargeUpTick(combat) {
    const actor    = getCurrentActor(combat);
    const charging = actor.charging;
    if (!charging) return;   // stale tick — actor already acted this turn via a click

    const wasStunned = startOfTurn(combat, actor);
    if (checkCombatEndAfterTick(combat, actor)) return;

    // Stun interrupts a charge
    if (wasStunned) {
        actor.charging = null;
        addToLog(combat, actor.name + ' is stunned — ' + charging.abilityName + ' interrupted!');
        nextTurn(combat);
        if (combat.phase === 'enemy_turn') scheduleEnemyTurn(combat);
        return;
    }

    charging.turnsLeft--;

    if (charging.turnsLeft > 0) {
        // Still charging — skip this turn
        addToLog(combat, actor.name + ' is charging ' + charging.abilityName + '...');
        nextTurn(combat);
        if (combat.phase === 'enemy_turn') scheduleEnemyTurn(combat);
        return;
    }

    // turnsLeft hit 0 — fire the ability (old ability system) or skill (new skill system)
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
        // Skill-based charge-up: AoE skills receive all alive enemies; single-target gets selected enemy
        const level       = actor.skillLevels[charging.abilityKey] || 1;
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

// ─── End-of-tick death check ───────────────────────────────────────────────────

// Check if any combatant died from a status-effect tick and resolve combat if so.
// Returns true if combat has ended (caller should return immediately).
function checkCombatEndAfterTick(combat, actor) {
    if (!actor.isAlive()) {
        // Added in Prompt 19c — Familiar death: advance the turn FIRST so turnIndex is past
        // the dead slot, then let handleFamiliarDeath clean up state and the queue safely.
        // Herald's template.onDeath spawns Dog + Crow via summonFamiliarGroup automatically.
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
            // If a charging caster dies, their charge is lost
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

    // Pre-turn resource check — fail silently without consuming the turn
    const hasResource = actor.maxStamina > 0 ? actor.hasStamina(cost) : actor.hasMana(cost);
    if (!hasResource) {
        const res = actor.maxStamina > 0 ? 'stamina' : 'mana';
        addToLog(combat, 'Not enough ' + res + ' for ' + skillName + '!');
        return;
    }

    // Charge-up (turn 1): start charging before startOfTurn so the tick is scheduled correctly
    if (skillDef.chargeUp && !actor.charging) {
        const wasStunned = startOfTurn(combat, actor);
        if (checkCombatEndAfterTick(combat, actor)) return;
        if (wasStunned) {
            addToLog(combat, actor.name + ' is stunned and cannot act!');
            nextTurn(combat);
            if (combat.phase === 'enemy_turn') scheduleEnemyTurn(combat);
            return;
        }
        // Spend resource and store charging state
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

    // Resolve target: AoE = all alive enemies; self = caster; single/ranged/magic = selected or first
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

    // Multi-arrow skills (Volley L2, Eclipse) hold the turn open — combatUI fires each arrow on click
    if (actor.volleyArrowsLeft > 0 || actor.eclipseArrowsLeft > 0) return;

    // Radiant Word two-step: hold the turn open while the player clicks an ally for healing
    if (actor.radiantWordHealPending) return;

    // Log a defeat if the (single) target was killed
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

// Execute the currently-acting party member's basic attack against the first alive enemy
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

    // Use the player's selected target if still alive and targetable, otherwise auto-target first alive enemy
    const target = (combat.selectedTarget && combat.selectedTarget.isAlive() && !combat.selectedTarget.untargetable)
        ? combat.selectedTarget
        : getAliveEnemies(combat)[0];
    combat.selectedTarget = null;   // clear selection after acting
    if (!target) return;   // all enemies already gone — shouldn't happen but safe

    const forceCrit = combat.playerFirstHitPending;
    if (forceCrit) combat.playerFirstHitPending = false;

    const result = basicAttack(actor, target, forceCrit, msg => addToLog(combat, msg));

    // Only log the hit message if the attack connected (Blind miss already logged in basicAttack)
    if (!result.missed) {
        const msg = result.isCrit
            ? 'CRITICAL! ' + actor.name + ' strikes ' + target.name + ' for ' + result.damage + '!'
            : actor.name + ' attacks ' + target.name + ' for ' + result.damage + ' damage.';
        addToLog(combat, msg);
    }

    // Retribution reflection may have killed the acting player
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

    // Check mana before starting the turn so a failed cast doesn't consume it
    if (!actor.hasMana(ability.manaCost)) {
        addToLog(combat, 'Not enough mana for ' + ability.name + '!');
        return;
    }

    // Check ability-specific preconditions (e.g. cooldown, valid target)
    if (ability.isReady && !ability.isReady(actor, combat)) {
        const cd = ability.getCooldown ? ability.getCooldown(actor) : 0;
        addToLog(combat, cd > 0
            ? ability.name + ' is on cooldown (' + cd + ' turns)!'
            : 'No valid target for ' + ability.name + '!');
        return;
    }

    // Charge-up abilities: start charging on first use; the actual cast fires automatically later
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

    // Silence: cannot use abilities this turn (flag captured before clearing in startOfTurn)
    if (actor.wasSilenced) {
        addToLog(combat, actor.name + ' is silenced and cannot use abilities!');
        nextTurn(combat);
        if (combat.phase === 'enemy_turn') scheduleEnemyTurn(combat);
        return;
    }

    // Use the player's selected target if still alive and targetable, otherwise auto-target first alive enemy
    const target = (combat.selectedTarget && combat.selectedTarget.isAlive() && !combat.selectedTarget.untargetable)
        ? combat.selectedTarget
        : getAliveEnemies(combat)[0];
    combat.selectedTarget = null;   // clear selection after acting

    actor.spendMana(ability.manaCost);
    addToLog(combat, actor.name + ' uses ' + ability.name + '!');
    // Pass combat as 4th arg so abilities (e.g. Summon Familiar, Devour) can access queue/state
    ability.use(actor, target, msg => addToLog(combat, msg), combat);
    // Aggro: using any ability generates a flat threat bump
    actor.aggro += 10;

    // Log any enemy killed by the ability (including Devour)
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

// ─── Enemy actions ─────────────────────────────────────────────────────────────

// ─── Shield action ─────────────────────────────────────────────────────────────

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

    // Apply shield status effect
    applyStatusEffect(actor, 'shield', msg => addToLog(combat, msg));
    // startOfTurn already gave 1× regen — give 1 more for 2× total
    if (actor.regenMana) actor.regenMana();
    addToLog(combat, actor.name + ' raises their shield and steadies their mind!');

    nextTurn(combat);
    if (combat.phase === 'enemy_turn') scheduleEnemyTurn(combat);
}

// ─── Row switch action ─────────────────────────────────────────────────────────

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
    // Moving into the front row generates a small aggro bump (stepping into the fight)
    if (dest === 'front') actor.aggro += 10;
    addToLog(combat, actor.name + ' moves to the ' + dest + ' row.');

    nextTurn(combat);
    if (combat.phase === 'enemy_turn') scheduleEnemyTurn(combat);
}

// Swap rows between the active party member and a chosen ally — only the initiator loses their turn
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

// ─── Warrior stance switch ─────────────────────────────────────────────────────

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

// ─── Potion action ─────────────────────────────────────────────────────────────

// Execute a potion use — removes from pool, applies effect, ends the turn
// targetEnemy: the clicked enemy (used for damage_vial; ignored for self/AoE potions)
function executePlayerPotion(combat, potionKey, targetEnemy) {
    const actor  = getCurrentActor(combat);
    const potion = POTION_DATA[potionKey];
    if (!potion) return;

    const wasStunned = startOfTurn(combat, actor);

    // Don't consume the potion if a tick killed the actor or ended combat
    if (checkCombatEndAfterTick(combat, actor)) return;

    if (wasStunned) {
        addToLog(combat, actor.name + ' is stunned and cannot act!');
        nextTurn(combat);
        if (combat.phase === 'enemy_turn') scheduleEnemyTurn(combat);
        return;
    }

    removePotionFromPool(potionKey);

    // Snapshot which enemies are alive before the potion lands
    const wasAlive    = new Set(getAliveEnemies(combat));
    const aliveNow    = getAliveEnemies(combat);

    applyPotion(potion, actor, targetEnemy, aliveNow, msg => addToLog(combat, msg));

    // Log any enemies killed by the potion
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

    // Familiar slots sit in the enemy-phase queue but act as autonomous allies
    if (actor.isFamiliar) return executeFamiliarTurn(combat);

    // Goremaw has its own full turn handler — delegates all phase/submerge/summon logic
    if (actor.key === 'goremaw') { executeGoremawTurn(combat); return; }

    // Count every turn this enemy takes (before stun check — stunned turns still count)
    actor.turnCount++;

    const wasStunned = startOfTurn(combat, actor);

    if (checkCombatEndAfterTick(combat, actor)) return;

    if (wasStunned) {
        addToLog(combat, actor.name + ' is stunned and cannot act!');
        nextTurn(combat);
        // Chain to the next combatant if it is also an enemy
        if (combat.phase === 'enemy_turn') executeEnemyTurn(combat);
        return;
    }

    // Fire passive ability if its trigger condition is met (e.g. every-3-turns heal)
    const alive = getAlivePartyMembers(combat);
    checkEnemyPassive(actor, combat, msg => addToLog(combat, msg));

    // Use the pre-rolled action from prerollEnemyIntentions if available (keeps telegraph in sync).
    // If the pre-rolled target is now dead, fall back to a fresh getEnemyAction so we never
    // attack a corpse. If no pre-roll exists (e.g. combat started on an enemy turn), roll fresh.
    let action;
    if (actor._prerolledAction) {
        action = actor._prerolledAction;
        actor._prerolledAction = null;
        // If the intended target died before this turn, re-resolve completely
        if (action.target && !action.target.isAlive()) {
            action = getEnemyAction(actor, alive);
        }
    } else {
        action = getEnemyAction(actor, alive);
    }

    if (action.type === 'defend') {
        actor.addStatusEffect('shield', msg => addToLog(combat, msg));
        if (action.isPassiveDefend) {
            // Passive personality below threshold: apply fortify (+10 DEF, 1 turn — auto-reverses)
            actor.addStatusEffect('fortify', msg => addToLog(combat, msg));
        } else {
            addToLog(combat, actor.name + ' braces for the next strike!');
        }
    } else {
        const target = action.target;

        // Pinned: melee enemies skip their attack entirely this turn
        if (actor.isPinned && actor.attackType === 'melee') {
            addToLog(combat, actor.name + ' is pinned and cannot attack!');
        } else if (action.ability) {
            // Enemy-specific ability from the action table
            action.ability.use(actor, target, msg => addToLog(combat, msg), combat);

            // Check for party members killed by the ability
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
            // Front row interception: when a melee enemy targets a back-row party member,
            // the highest-aggro front-row ally gets a free counter-attack before the hit lands.
            if ((actor.attackType || 'melee') === 'melee' && target.row === 'back') {
                const frontAllies = combat.party.filter(m => m.isAlive() && m.row === 'front');
                if (frontAllies.length > 0) {
                    // Pick the front-row ally carrying the most threat
                    const interceptor = frontAllies.reduce((a, b) => b.aggro > a.aggro ? b : a);
                    addToLog(combat, interceptor.name + ' intercepts for ' + target.name + '!');
                    // High-SPD enemies can dodge the interception — check with interception rules
                    if (rollDodge(actor, 'interception')) {
                        addToLog(combat, actor.name + ' dodged the interception!');
                    } else {
                        // skipDodge=true: the interception roll above already resolved dodge for this hit
                        const icResult = basicAttack(interceptor, actor, false, msg => addToLog(combat, msg), true);
                        if (!icResult.missed) {
                            const msg = icResult.isCrit
                                ? 'CRITICAL! ' + interceptor.name + ' counters ' + actor.name + ' for ' + icResult.damage + '!'
                                : interceptor.name + ' counters ' + actor.name + ' for ' + icResult.damage + ' damage.';
                            addToLog(combat, msg);
                        }
                        // Enemy slain by the counter-attack — resolve death and bail out
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

            // Generic basic attack fallback
            const result = basicAttack(actor, target, false, msg => addToLog(combat, msg));

            // Only log the hit message if the attack connected (Blind miss already logged)
            if (!result.missed) {
                const msg = result.isCrit
                    ? 'CRITICAL! ' + actor.name + ' strikes ' + target.name + ' for ' + result.damage + '!'
                    : actor.name + ' attacks ' + target.name + ' for ' + result.damage + ' damage.';
                addToLog(combat, msg);
            }

            // Retribution reflection may have killed the attacking enemy
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
    // Chain to the next combatant if it is also an enemy (handles 2+ enemies in a row)
    if (combat.phase === 'enemy_turn') executeEnemyTurn(combat);
}
