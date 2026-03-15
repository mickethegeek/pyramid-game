// Treasure room resolution — pre-rolls rewards and stores them in state.currentTreasure

// Compute average LUCK modifier from living party members (used as flat % bonus)
function getAvgLuckMod() {
    const living = state.party.filter(m => m.currentHP > 0);
    if (!living.length) return 0;
    const avgLuck = living.reduce((sum, m) => sum + m.getStat('luck'), 0) / living.length;
    return Math.floor(avgLuck / 3);
}

// Roll item rarity for the current act, shifting toward the better tier by luckMod %
function rollTreasureRarity(luckMod) {
    const act = state.actNumber;
    if (act === 1) {
        const uncommonChance = Math.min(100, 30 + luckMod);
        return Math.random() * 100 < uncommonChance ? 'uncommon' : 'common';
    } else if (act === 2) {
        const rareChance = Math.min(100, 40 + luckMod);
        return Math.random() * 100 < rareChance ? 'rare' : 'uncommon';
    } else {
        const legendaryChance = Math.min(100, 30 + luckMod);
        return Math.random() * 100 < legendaryChance ? 'legendary' : 'rare';
    }
}

// Roll sequential potion awards — each roll uses a decaying chance; stop on fail or at 5
function rollTreasurePotions(luckMod) {
    const keys    = Object.keys(POTION_DATA);
    const awarded = [];
    let   chance  = 40 + luckMod;

    for (let i = 0; i < 5; i++) {
        if (Math.random() * 100 >= chance) break;
        awarded.push(keys[Math.floor(Math.random() * keys.length)]);
        chance = Math.round((chance / 1.6) * 10) / 10;
    }
    return awarded;
}

// Pick actNumber distinct positive relics the party doesn't already own
function rollTreasureRelics(actNumber) {
    const owned = (state.activeRelics || []).map(function (r) { return r.key; });
    const keys  = Object.keys(RELIC_DATA).filter(function (k) {
        return !RELIC_DATA[k].cursed && !owned.includes(k);
    });
    for (let i = keys.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const tmp = keys[i]; keys[i] = keys[j]; keys[j] = tmp;
    }
    return keys.slice(0, actNumber);
}

// Apply the pre-rolled chest rewards to the live game state
function applyTreasureChest(t) {
    state.gold += t.gold;
    state.inventory.push(t.item);
    for (const key of t.potions) {
        if (state.partyPotions.length < getPartyPotionLimit()) addPotionToParty(key);
    }
}

// Set up the treasure choice and switch to the treasure scene — rewards NOT applied yet
function resolveTreasureRoom() {
    const luckMod = getAvgLuckMod();

    const actGoldBonuses = { 1: 0, 2: 15, 3: 35 };
    const gold    = 20 + Math.floor(Math.random() * 15) + (actGoldBonuses[state.actNumber] || 0);
    const rarity  = rollTreasureRarity(luckMod);
    const item    = generateItem(null, rarity);
    const potions = rollTreasurePotions(luckMod);

    state.currentTreasure = {
        treasurePhase: 'choice',
        gold,
        item,
        potions,
        relicOptions: rollTreasureRelics(state.actNumber),
    };
    state.currentScene = 'treasure';
    saveRunProgress();
}
