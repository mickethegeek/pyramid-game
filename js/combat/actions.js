// Combat actions — attack, ability, item, defend
// Each action function resolves the action and returns a result object

// Basic attack: attacker hits defender at 1× damage multiplier
// forceCrit (optional): passed through from passive effects like first_hit_crit
// log (optional): combat log callback — required for on-hit passives to fire
// Returns { damage: number, isCrit: boolean }
function basicAttack(attacker, defender, forceCrit, log) {
    const result = calculateDamage(attacker, defender, 1.0, forceCrit);
    defender.takeDamage(result.damage, log);
    if (log && attacker.equipment) applyOnHitPassives(attacker, defender, log);
    return result;
}

// Check attacker's equipped items for passive suffix effects and apply them to the defender
function applyOnHitPassives(attacker, defender, log) {
    if (!defender.isAlive()) {
        // lifesteal_on_kill: restore 5% of max HP when the hit kills the target
        if (hasPassive(attacker, 'lifesteal_on_kill')) {
            const heal = Math.max(1, Math.floor(attacker.getMaxHP() * 0.05));
            attacker.currentHP = Math.min(attacker.getMaxHP(), attacker.currentHP + heal);
            log(attacker.name + ' drains life for +' + heal + ' HP!');
        }
        return;  // target dead — no point applying debuffs
    }
    if (hasPassive(attacker, 'burn_on_hit'))    applyStatusEffect(defender, 'burn',   log);
    if (hasPassive(attacker, 'poison_on_hit'))  applyStatusEffect(defender, 'poison', log);
    if (hasPassive(attacker, 'stun_chance') && Math.random() < 0.25) {
        applyStatusEffect(defender, 'stun', log);
    }
}

// Defend: apply a Shield status effect to the combatant (absorbs next hit)
function defend(combatant, log) {
    applyStatusEffect(combatant, 'shield', log);
}
