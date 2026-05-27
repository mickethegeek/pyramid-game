// Damage formula, crit calculation, and resistances

// Calculate damage dealt by attacker to defender for one hit
// abilityMultiplier: 1.0 for basic attack, higher for special abilities
// forceCrit (optional): if true, the hit is always a critical — used by passive effects
// attackType: 'melee' | 'ranged' | 'magic' — defaults to 'melee'
// options (optional): { ignoreArmor: bool } — set by last_stand to bypass DEF entirely
// Returns { damage: number, isCrit: boolean, rawDamage: number }
function calculateDamage(attacker, defender, abilityMultiplier, forceCrit, attackType = 'melee', options = {}) {
    // Row attack modifier: front row attacker gets +20%, back row gets -10%
    const attackRowMult  = (attacker.row === 'back') ? 0.9 : 1.2;

    // Row defense modifier: front row defender takes +30% more damage
    const defenseRowMult = (defender.row === 'front') ? 1.3 : 1.0;

    // Battle stance: Warrior in battle stance deals +20% outgoing damage
    const stanceMult = (attacker.stance === 'battle') ? 1.2 : 1.0;

    // Step 1: raw damage = attacker DMG × ability multiplier × row modifiers × stance
    const raw = attacker.getStat('dmg') * abilityMultiplier * attackRowMult * defenseRowMult * stanceMult;

    // Step 2: subtract DEF (or skip entirely for armor-piercing abilities)
    let base;
    if (options.ignoreArmor) {
        base = Math.max(1, raw);
    } else {
        // armorDebuff: cumulative negative fraction reducing effective DEF (e.g. -0.10 per stack)
        const defMult      = 1.0 + (defender.armorDebuff || 0);
        const effectiveDef = Math.max(0, defender.getStat('def') * defMult);
        base               = Math.max(1, raw - effectiveDef);
    }

    // Step 3: crit check — forced by passive or driven by attacker DEX + LUCK
    const critChance = (attacker.getStat('dex') + attacker.getStat('luck')) / 100;
    const isCrit     = forceCrit || Math.random() < critChance;

    let damage;
    if (isCrit) {
        // Crit multiplier is random between 1.5× and 2.5×
        const critMult = 1.5 + Math.random();
        damage = Math.floor(base * critMult);
    } else {
        damage = Math.floor(base);
    }

    // Guard stance: Warrior in guard stance takes 25% less incoming damage
    if (defender.stance === 'guard') damage = Math.floor(damage * 0.75);

    // damageReduction: temporary multiplier set by status effects (iron_will_buff, battle_hardened)
    if (defender.damageReduction) damage = Math.floor(damage * (1 - defender.damageReduction));

    // rawDamage = pre-armor value; used by Retribution to reflect the correct amount
    return { damage: Math.max(1, damage), isCrit, rawDamage: Math.floor(raw) };
}

// Apply a pre-calculated damage value to a target, handling temp-HP shields and Retribution.
// attacker: the combatant dealing the hit (needed for Retribution reflect and Fortress stun).
// finalDamage: post-crit, post-armor value from calculateDamage (or manually computed).
// rawDamage: pre-armor value — used as the base for Retribution reflection.
// log: combat log callback.
function applyDamage(attacker, target, finalDamage, rawDamage, log) {

    // ── Temp-HP shield drain ──────────────────────────────────────────────────
    if ((target.tempHP || 0) > 0) {
        // Apply shield's own damage reduction while the buffer is intact
        if (target.shieldDamageReduction) {
            finalDamage = Math.round(finalDamage * (1 - target.shieldDamageReduction));
        }

        const absorbed = Math.min(target.tempHP, finalDamage);
        target.tempHP  -= absorbed;
        finalDamage    -= absorbed;

        if (log && absorbed > 0) {
            log(target.name + "'s shield absorbs " + absorbed + ' damage! (' + target.tempHP + ' temp HP remaining)');
        }

        // Shield broke — trigger Fortress stun and clean up state
        if (target.tempHP <= 0) {
            if (target.shieldFortress && attacker) {
                applyStatusEffect(attacker, 'stun', log, { turnsLeft: 1 });
                if (log) log('Fortress shatters — ' + attacker.name + ' is stunned!');
            }
            if (target.activeEffects) {
                target.activeEffects = target.activeEffects.filter(e => e.key !== 'temp_shield');
            }
            target.shieldDamageReduction = 0;
            target.shieldFortress        = false;
        }
    }

    // ── Apply remaining damage to HP ─────────────────────────────────────────
    target.takeDamage(finalDamage, log);

    // ── Retribution reflect ───────────────────────────────────────────────────
    if ((target.retributionReflect || 0) > 0 && attacker) {
        // Martyr's surge: dropping below 25% HP flips reflect to 100% armor-piercing
        if (target.retributionMartyrs && target.currentHP < target.getMaxHP() * 0.25) {
            target.retributionReflect     = 1.0;
            target.retributionArmorPierce = true;
            if (log) log(target.name + "'s Martyr's Resolve surges — 100% reflect!");
        }

        let reflectDamage = Math.round(rawDamage * target.retributionReflect);

        // Armor-reduced reflect: use the same DEF formula as calculateDamage
        if (!target.retributionArmorPierce) {
            const defMult      = 1.0 + (attacker.armorDebuff || 0);
            const effectiveDef = Math.max(0, attacker.getStat('def') * defMult);
            reflectDamage      = Math.max(1, Math.floor(reflectDamage - effectiveDef));
        }

        reflectDamage      = Math.max(1, reflectDamage);
        attacker.currentHP = Math.max(0, attacker.currentHP - reflectDamage);
        if (log) log(target.name + "'s Retribution reflects " + reflectDamage + ' damage at ' + attacker.name + '!');
    }
}

// Roll whether the defender dodges an incoming attack based on attack type and SPD.
// 'magic': never dodged. 'single': floor(SPD/4)% chance.
// 'aoe': floor(SPD/8)% chance, rolled independently per target.
// 'interception': false if defender SPD ≤ 25; else floor(SPD/8)% chance.
// Returns true if the attack is dodged.
function rollDodge(defender, attackType) {
    if (attackType === 'magic') return false;
    const spd = defender.getStat('spd');
    if (attackType === 'single') {
        return Math.random() * 100 < Math.floor(spd / 4);
    }
    if (attackType === 'aoe') {
        return Math.random() * 100 < Math.floor(spd / 8);
    }
    if (attackType === 'interception') {
        if (spd <= 25) return false;
        return Math.random() * 100 < Math.floor(spd / 8);
    }
    return false;
}
