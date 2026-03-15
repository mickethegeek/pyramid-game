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

    return combat;
}

// Build one shared initiative queue from all party members and all enemies, sorted by SPD desc
function buildInitiativeQueue(party, enemies) {
    const slots = [
        ...party.map(member => ({ combatant: member, isPlayer: true  })),
        ...enemies.map(enemy  => ({ combatant: enemy,  isPlayer: false })),
    ];
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

// Return all enemies who are still alive
function getAliveEnemies(combat) {
    return combat.enemies.filter(e => e.isAlive());
}

// Return true if every party member has been defeated
function isPartyDefeated(combat) {
    return combat.party.every(m => !m.isAlive());
}

// Return true if every enemy has been defeated
function isAllEnemiesDefeated(combat) {
    return combat.enemies.every(e => !e.isAlive());
}

// Advance to the next living combatant in the queue, skipping dead ones
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
}

// Append a message to the combat log, keeping only the last 4 entries
function addToLog(combat, message) {
    combat.log.push(message);
    if (combat.log.length > 4) combat.log.shift();
}

// Run start-of-turn housekeeping: tick status effects and regenerate mana.
// Returns true if the combatant was stunned at the START of this turn.
// Stun flag captured BEFORE ticking because duration:1 ticking clears it.
function startOfTurn(combat, combatant) {
    combat.turnStarted = true;
    const wasStunned   = combatant.isStunned;
    combatant.tickStatusEffects(msg => addToLog(combat, msg));
    if (combatant.regenMana) combatant.regenMana();
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

    // Pick a random alive enemy to attack
    const target = targets[Math.floor(Math.random() * targets.length)];
    const dmg    = Math.max(1, actor.getStat('dmg'));
    target.takeDamage(dmg, msg => addToLog(combat, msg));
    addToLog(combat, actor.name + ' pounces on ' + target.name + ' for ' + dmg + ' damage!');

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
    combat.enemyTurnTime    = performance.now() + 700;
}

// ─── End-of-tick death check ───────────────────────────────────────────────────

// Check if any combatant died from a status-effect tick and resolve combat if so.
// Returns true if combat has ended (caller should return immediately).
function checkCombatEndAfterTick(combat, actor) {
    if (!actor.isAlive()) {
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

    // Use the player's selected target if still alive, otherwise auto-target first alive enemy
    const target = (combat.selectedTarget && combat.selectedTarget.isAlive())
        ? combat.selectedTarget
        : getAliveEnemies(combat)[0];
    combat.selectedTarget = null;   // clear selection after acting
    if (!target) return;   // all enemies already gone — shouldn't happen but safe

    const forceCrit = combat.playerFirstHitPending;
    if (forceCrit) combat.playerFirstHitPending = false;

    const result = basicAttack(actor, target, forceCrit, msg => addToLog(combat, msg));
    const msg    = result.isCrit
        ? 'CRITICAL! ' + actor.name + ' strikes ' + target.name + ' for ' + result.damage + '!'
        : actor.name + ' attacks ' + target.name + ' for ' + result.damage + ' damage.';
    addToLog(combat, msg);

    if (!target.isAlive()) {
        addToLog(combat, target.name + ' is defeated!');
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

    const wasStunned = startOfTurn(combat, actor);

    if (checkCombatEndAfterTick(combat, actor)) return;

    if (wasStunned) {
        addToLog(combat, actor.name + ' is stunned and cannot act!');
        nextTurn(combat);
        if (combat.phase === 'enemy_turn') scheduleEnemyTurn(combat);
        return;
    }

    // Use the player's selected target if still alive, otherwise auto-target first alive enemy
    const target = (combat.selectedTarget && combat.selectedTarget.isAlive())
        ? combat.selectedTarget
        : getAliveEnemies(combat)[0];
    combat.selectedTarget = null;   // clear selection after acting

    actor.spendMana(ability.manaCost);
    addToLog(combat, actor.name + ' uses ' + ability.name + '!');
    // Pass combat as 4th arg so abilities (e.g. Summon Familiar, Devour) can access queue/state
    ability.use(actor, target, msg => addToLog(combat, msg), combat);

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

    const wasStunned = startOfTurn(combat, actor);

    if (checkCombatEndAfterTick(combat, actor)) return;

    if (wasStunned) {
        addToLog(combat, actor.name + ' is stunned and cannot act!');
        nextTurn(combat);
        // Chain to the next combatant if it is also an enemy
        if (combat.phase === 'enemy_turn') executeEnemyTurn(combat);
        return;
    }

    // Respect Taunt — if any alive party member is taunting, the enemy must target them
    const alive        = getAlivePartyMembers(combat);
    const tauntTarget  = alive.find(m => m.isTaunting);
    const forcedTarget = tauntTarget || alive[0];

    const action = getEnemyAction(actor, forcedTarget);

    if (action.type === 'defend') {
        actor.addStatusEffect('shield', msg => addToLog(combat, msg));
        addToLog(combat, actor.name + ' braces for the next strike!');
    } else {
        const target = forcedTarget;
        const result = basicAttack(actor, target, false, msg => addToLog(combat, msg));
        const msg    = result.isCrit
            ? 'CRITICAL! ' + actor.name + ' strikes ' + target.name + ' for ' + result.damage + '!'
            : actor.name + ' attacks ' + target.name + ' for ' + result.damage + ' damage.';
        addToLog(combat, msg);

        if (!target.isAlive()) {
            addToLog(combat, target.name + ' has fallen!');
        }

        if (isPartyDefeated(combat)) {
            combat.phase = 'defeat';
            addToLog(combat, 'Your party has been defeated...');
            return;
        }
    }

    nextTurn(combat);
    // Chain to the next combatant if it is also an enemy (handles 2+ enemies in a row)
    if (combat.phase === 'enemy_turn') executeEnemyTurn(combat);
}
