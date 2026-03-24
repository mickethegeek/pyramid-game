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

// ─── Passive abilities ────────────────────────────────────────────────────────

// Fire a passive ability if the enemy's data defines one.
// Called at the start of each enemy turn, before action selection.
function checkEnemyPassive(enemy, combat, log) {
    const data = ENEMY_DATA[enemy.key];
    if (data && data.passive) data.passive(enemy, combat, log);
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
