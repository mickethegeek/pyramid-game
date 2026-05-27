// AI decision logic — determines what action an enemy takes on its turn

// Convert a snake_case action key to a readable display name ('swamp_bite' → 'Swamp Bite')
function actionKeyToName(key) {
    return key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

// ─── Targeting ────────────────────────────────────────────────────────────────

// Return the correct target from aliveParty based on enemy.personality.
// aliveParty is pre-filtered to living members only — dead characters are never passed in.
// Taunt always overrides personality — taunting member is targeted first.
// Returns null only for 'passive' personality below passiveThreshold (signals defend).
function getTarget(enemy, aliveParty) {
    if (!aliveParty.length) return null;

    // Taunt override — personality is ignored while any party member is taunting
    const tauntTarget = aliveParty.find(m => m.isTaunting);
    if (tauntTarget) return tauntTarget;

    switch (enemy.personality) {

        case 'aggressive':
            // Highest aggro — reads live member.aggro values from the aggro table
            return aliveParty.reduce(
                (best, m) => m.aggro > best.aggro ? m : best,
                aliveParty[0]
            );

        case 'cautious':
            // Lowest current HP — finish off the most wounded target
            return aliveParty.reduce(
                (best, m) => m.currentHP < best.currentHP ? m : best,
                aliveParty[0]
            );

        case 'smart':
            // Highest INT — prioritise spellcasters and supports
            return aliveParty.reduce(
                (best, m) => m.getStat('int') > best.getStat('int') ? m : best,
                aliveParty[0]
            );

        case 'passive':
            // Below passiveThreshold turns: return null to signal a defensive action
            if (enemy.turnCount < (enemy.passiveThreshold || 0)) return null;
            // Once threshold passed: switch to aggressive, target highest aggro
            return aliveParty.reduce(
                (best, m) => m.aggro > best.aggro ? m : best,
                aliveParty[0]
            );

        default:
            return aliveParty[0];
    }
}

// ─── Action selection ─────────────────────────────────────────────────────────

// Pick one action from the enemy's action table using weighted-random selection.
// Actions with a condition() field are skipped when their condition is not met.
// Returns null if the enemy has no action table (falls back to generic attack).
function pickAction(enemy) {
    const data = ENEMY_DATA[enemy.key];
    if (!data || !data.actions || !data.actions.length) return null;

    // Filter to only actions available right now (conditional gates e.g. Enrage)
    const available = data.actions.filter(a => !a.condition || a.condition(enemy));
    if (!available.length) return null;

    const total = available.reduce((sum, a) => sum + a.weight, 0);
    let roll = Math.random() * total;
    for (const action of available) {
        roll -= action.weight;
        if (roll <= 0) return action;
    }
    return available[available.length - 1];
}

// Pick a key from a Goremaw-style weighted action table: [{ weight, key }, ...]
function pickWeightedAction(table) {
    const total = table.reduce((sum, a) => sum + a.weight, 0);
    let roll = Math.random() * total;
    for (const entry of table) {
        roll -= entry.weight;
        if (roll <= 0) return entry.key;
    }
    return table[table.length - 1].key;
}

// ─── Passive abilities ────────────────────────────────────────────────────────

// Fire a passive ability if the enemy's data defines one.
// Called at the start of each enemy turn, before action selection.
function checkEnemyPassive(enemy, combat, log) {
    const data = ENEMY_DATA[enemy.key];
    if (data && typeof data.passive === 'function') data.passive(enemy, combat, log);
}

// ─── Death callbacks ──────────────────────────────────────────────────────────

// Fire the enemy's onDeath callback when it is defeated.
// Delegates to the Enemy class method which reads from ENEMY_DATA.
function handleEnemyDeath(enemy, combat, log) {
    enemy.onDeath(combat.party, combat.enemies, log);
}

// ─── Main decision entry point ────────────────────────────────────────────────

// Choose and return an action descriptor for the enemy this turn.
// aliveParty: array of living party members — getTarget resolves the target.
// Returns { type: 'attack'|'defend', target, ability? }
function getEnemyAction(enemy, aliveParty) {
    const target = getTarget(enemy, aliveParty);

    // null target = passive personality below threshold — flag so executeEnemyTurn
    // can apply the passive DEF bonus on top of the standard shield
    if (target === null) {
        return { type: 'defend', target: enemy, isPassiveDefend: true };
    }

    // Pick from the enemy's defined action table if one exists
    const ability = pickAction(enemy);
    if (ability) {
        return { type: 'attack', target, ability };
    }

    // Fallback for enemies without an action table: 70% attack, 30% defend
    if (Math.random() < 0.7) {
        return { type: 'attack', target };
    }
    return { type: 'defend', target: enemy };
}

// ─── Goremaw boss turn ────────────────────────────────────────────────────────

// Handle all Goremaw-specific turn logic: submerge, Swamp Summon, coil follow-up,
// phase transition, and phase 2 action selection.
// Called from executeEnemyTurn (combat.js) when actor.key === 'goremaw'.
function executeGoremawTurn(combat) {
    const enemy = getCurrentActor(combat);
    const log   = msg => addToLog(combat, msg);

    // Always tick status effects and check for DoT death before any other logic
    const wasStunned = startOfTurn(combat, enemy);
    if (checkCombatEndAfterTick(combat, enemy)) return;

    // Submerge countdown: 2 of Goremaw's turns submerged before resurfacing into phase 2
    if (enemy.submerging) {
        enemy.submerging--;
        if (enemy.submerging > 0) {
            nextTurn(combat);
            if (combat.phase === 'enemy_turn') scheduleEnemyTurn(combat);
            return;
        }
        enemy.untargetable  = false;
        enemy.baseStats.def = 25;
        enemy.phase         = 2;
        log('Goremaw erupts from the depths — Phase 2 begins!');
        nextTurn(combat);
        if (combat.phase === 'enemy_turn') scheduleEnemyTurn(combat);
        return;
    }

    // Increment turn counter before stun check — stunned turns still count
    enemy.turnCount++;

    if (wasStunned) {
        log(enemy.name + ' is stunned and cannot act!');
        nextTurn(combat);
        if (combat.phase === 'enemy_turn') scheduleEnemyTurn(combat);
        return;
    }

    const alive = getAlivePartyMembers(combat);
    if (!alive.length) {
        nextTurn(combat);
        return;
    }

    // Swamp Summon — phase 1 only: every swampSummonInterval turns spawn 2 Bog Rats
    if (enemy.phase === 1 && enemy.turnCount % enemy.passive.swampSummonInterval === 0) {
        for (let i = 0; i < 2; i++) {
            const rat            = createEnemy('bogRat', state.actNumber);
            rat.spawnedByGoremaw = true;  // Only Goremaw-spawned rats count toward bogRatBuff.
            combat.enemies.push(rat);
            // Push to end of queue so newly spawned rats don't act until next round
            combat.queue.push({ combatant: rat, isPlayer: false });
            enemy.bogRatBuff += enemy.passive.bogRatDmgBonus;
        }
        log('Goremaw calls reinforcements — Bog Rats emerge from the swamp!');
    }

    // Apply bogRatBuff to DMG for this turn's damage calculations
    // bogRatBuff recalculated each turn — living rats only tracked externally.
    const baseDmg       = enemy.baseStats.dmg;
    enemy.baseStats.dmg = baseDmg + enemy.bogRatBuff;
    enemy.effectiveDmg  = enemy.baseStats.dmg;

    // Coil follow-up: clear the flag, restore DEF, mark this action for double damage
    let coilDoubled = false;
    if (enemy.coilActive) {
        enemy.coilActive    = false;
        enemy.baseStats.def = 25;
        coilDoubled         = true;
    }

    // Select action from the correct phase table via weighted random
    // Exclude 'coil' if we just resolved a coil follow-up — no double-coiling
    const rawTable  = enemy.phase === 1 ? enemy.phase1Actions : enemy.phase2Actions;
    const actionTable = coilDoubled ? rawTable.filter(a => a.key !== 'coil') : rawTable;
    const actionKey   = pickWeightedAction(actionTable);
    const actionDef   = enemy.actionDefs[actionKey];

    if (actionDef) {
        // Resolve primary target — swallow targets lowest HP, all others target highest aggro
        let target;
        if (actionKey === 'swallow') {
            target = alive.reduce((a, b) => b.currentHP < a.currentHP ? b : a);
            log('Goremaw eyes ' + target.name + ' hungrily...');
        } else {
            target = alive.reduce((a, b) => b.aggro > a.aggro ? b : a);
        }

        // Execute action — if coil was active, temporarily double all takeDamage calls
        if (coilDoubled) {
            const origTDs = combat.party.map(m => m.takeDamage);
            for (const m of combat.party) {
                const orig = m.takeDamage;
                m.takeDamage = function(amount, l) { orig.call(this, amount * 2, l); };
            }
            actionDef.use(enemy, target, log, combat);
            combat.party.forEach((m, i) => { m.takeDamage = origTDs[i]; });
        } else {
            actionDef.use(enemy, target, log, combat);
        }
    }

    // Restore base DMG after this turn's calculations are done
    enemy.baseStats.dmg = baseDmg;

    // Log any party members killed by the action
    for (const member of combat.party) {
        if (!member.isAlive() && !member._deathLogged) {
            log(member.name + ' has fallen!');
            member._deathLogged = true;
        }
    }

    if (isPartyDefeated(combat)) {
        combat.phase = 'defeat';
        log('Your party has been defeated...');
        return;
    }

    // Phase 1 → submerge transition at ≤50% HP
    if (enemy.phase === 1 && enemy.currentHP <= enemy.getMaxHP() * 0.50) {
        enemy.submerging   = 2;
        enemy.untargetable = true;
        log('Goremaw lets out a massive roar and submerges into the swamp...');
        nextTurn(combat);
        if (combat.phase === 'enemy_turn') scheduleEnemyTurn(combat);
        return;
    }

    nextTurn(combat);
    if (combat.phase === 'enemy_turn') scheduleEnemyTurn(combat);
}
