// Damage formula, crit calculation, and resistances

// Calculate damage dealt by attacker to defender for one hit
// abilityMultiplier: 1.0 for basic attack, higher for special abilities
// Returns { damage: number, isCrit: boolean }
// forceCrit (optional): if true, the hit is always a critical — used by passive effects
function calculateDamage(attacker, defender, abilityMultiplier, forceCrit) {
    // Step 1: raw damage = attacker DMG × ability multiplier
    const raw = attacker.getStat('dmg') * abilityMultiplier;

    // Step 2: subtract flat DEF, minimum 1 damage always gets through
    const reduced = raw - defender.getStat('def');
    const base = Math.max(1, reduced);

    // Step 3: crit check — forced by passive or driven by attacker DEX + LUCK
    const critChance = (attacker.getStat('dex') + attacker.getStat('luck')) / 100;
    const isCrit = forceCrit || Math.random() < critChance;

    if (isCrit) {
        // Crit multiplier is random between 1.5× and 2.5×
        const critMult = 1.5 + Math.random();
        return { damage: Math.floor(base * critMult), isCrit: true };
    }

    return { damage: Math.floor(base), isCrit: false };
}
