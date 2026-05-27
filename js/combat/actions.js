// Combat actions — attack, ability, item, defend
// Each action function resolves the action and returns a result object

// Basic attack: attacker hits defender at 1× damage multiplier
// forceCrit (optional): passed through from passive effects like first_hit_crit
// log (optional): combat log callback — required for on-hit passives to fire
// Returns { damage, isCrit, rawDamage, missed? }
// skipDodge (optional): pass true when the caller already resolved the dodge roll (e.g. interception)
function basicAttack(attacker, defender, forceCrit, log, skipDodge = false) {
    // Blind: 35% chance the attack misses entirely — applies to both party and enemies
    if (attacker.isBlinded && Math.random() < 0.35) {
        if (log) log(attacker.name + ' swings blindly and misses!');
        return { damage: 0, isCrit: false, rawDamage: 0, missed: true };
    }

    // Use the attacker's own attackType so ranged/magic enemies bypass back-row protection
    const attackType = attacker.attackType || 'melee';
    const result = calculateDamage(attacker, defender, 1.0, forceCrit, attackType);

    // Dodge: map the attacker's type to a dodge category and roll; skip if caller handled it
    if (!skipDodge) {
        const dodgeType = (attackType === 'magic') ? 'magic' : 'single';
        if (rollDodge(defender, dodgeType)) {
            if (log) log(defender.name + ' dodged!');
            return { damage: 0, isCrit: false, rawDamage: 0, missed: true };
        }
    }

    // Retribution reflect handled in damageCalc.js
    applyDamage(attacker, defender, result.damage, result.rawDamage, log);

    // Aggro: attacker generates threat equal to half the damage dealt
    if (result.damage > 0) attacker.aggro += Math.floor(result.damage * 0.5);

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

// ─── Skill execution ───────────────────────────────────────────────────────────

// Execute a skill for a character: validate ownership, check/spend resource,
// handle charge-up initiation, or call the skill's effect().
// target: single enemy/ally, or array of enemies for AoE.
// Returns true if the skill fired (or charge started), false if blocked.
function useSkill(character, skillKey, target, log) {
    const skillDef = SKILL_DATA && SKILL_DATA[skillKey];
    if (!skillDef) {
        if (log) log(character.name + ' tried to use an unknown skill: ' + skillKey);
        return false;
    }

    const level     = character.skillLevels[skillKey] || 1;
    const levelData = skillDef.levels[level];
    const cost      = levelData.manaCost || 3;

    // Physical classes (maxStamina > 0) spend stamina; casters spend mana
    if (character.maxStamina > 0) {
        if (!character.hasStamina(cost)) {
            if (log) log(character.name + ' does not have enough stamina for ' + levelData.name + '!');
            return false;
        }
        character.spendStamina(cost);
    } else {
        if (!character.hasMana(cost)) {
            if (log) log(character.name + ' does not have enough mana for ' + levelData.name + '!');
            return false;
        }
        character.spendMana(cost);
    }

    // Charge-up: set charging state and return — the actual effect fires on the next turn.
    // Handles all chargeUp: true skills generically, including singularity.
    if (skillDef.chargeUp) {
        character.charging = { abilityKey: skillKey, abilityName: levelData.name, turnsLeft: 2 };
        if (log) log(character.name + ' begins charging ' + levelData.name + '!');
        character.aggro += 10;
        return true;
    }

    // Execute the skill effect — pass log so effects can write to the combat log
    if (log) log(character.name + ' uses ' + levelData.name + '!');
    skillDef.effect(character, target, level, log);
    // Safety net: zero pendingOvercharge in case the effect didn't consume it
    if (character.pendingOvercharge) character.pendingOvercharge = 0;
    character.aggro += 10;
    return true;
}
