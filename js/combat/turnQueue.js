// Initiative queue management — build, sort, advance, and query the turn order

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
function decayAggro(combat) {
    for (const slot of combat.queue) {
        const c = slot.combatant;
        if (c.isAlive()) c.aggro = Math.max(0, Math.floor(c.aggro * 0.95));
    }
}

// Insert a newly-summoned familiar into the queue right after the current actor's slot
function injectFamiliarIntoQueue(combat, familiar) {
    const slot = { combatant: familiar, isPlayer: false, isFamiliar: true };
    combat.queue.splice(combat.turnIndex + 1, 0, slot);
}
