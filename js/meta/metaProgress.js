// Meta progression — Soul Shards, class discovery, permanent stat upgrades

// ─── Shard rewards ─────────────────────────────────────────────────────────────

const SHARD_REWARDS = {
    normal: 1,   // per enemy killed (scales with multi-enemy rooms later)
    elite:  8,   // flat reward per elite win
    boss:   15,  // flat reward per boss win
};

// Award shards for completing a combat encounter and save meta immediately
// combatType: 'normal' | 'elite' | 'boss'
// enemiesKilled: number of enemies defeated (only matters for 'normal')
function awardCombatShards(combatType, enemiesKilled) {
    let shards = 0;
    if      (combatType === 'normal') shards = SHARD_REWARDS.normal * (enemiesKilled || 1);
    else if (combatType === 'elite')  shards = SHARD_REWARDS.elite;
    else if (combatType === 'boss')   shards = SHARD_REWARDS.boss;

    state.meta.soulShards   += shards;
    state.soulShardsThisRun += shards;
    saveMetaProgress(state.meta);
    return shards;
}

// ─── Class discovery ──────────────────────────────────────────────────────────

// Return true if a class has already been discovered
function isClassDiscovered(classKey) {
    return state.meta.discoveredClasses.includes(classKey);
}

// Mark a class as discovered for the first time — returns true if newly unlocked
function discoverClass(classKey) {
    if (isClassDiscovered(classKey)) return false;
    state.meta.discoveredClasses.push(classKey);
    saveMetaProgress(state.meta);
    return true;
}

// ─── Permanent upgrades ───────────────────────────────────────────────────────

// Cost to buy the next upgrade level for a stat (gets more expensive each time)
function upgradeCost(currentLevel) {
    return 10 + (currentLevel * 5);
}

// Return the permanent upgrade levels for a class, initialising to zero if needed
function getUpgradesForClass(classKey) {
    if (!state.meta.permanentUpgrades[classKey]) {
        state.meta.permanentUpgrades[classKey] = {
            hp: 0, def: 0, dmg: 0, dex: 0, spd: 0, int: 0, luck: 0,
        };
    }
    return state.meta.permanentUpgrades[classKey];
}

// Spend shards to buy one level of a permanent stat upgrade
// Returns true on success, false if the player can't afford it
function purchaseUpgrade(classKey, stat) {
    const upgrades   = getUpgradesForClass(classKey);
    const currentLvl = upgrades[stat] || 0;
    const cost       = upgradeCost(currentLvl);

    if (state.meta.soulShards < cost) return false;

    state.meta.soulShards                  -= cost;
    upgrades[stat]                          = currentLvl + 1;
    state.meta.permanentUpgrades[classKey]  = upgrades;
    saveMetaProgress(state.meta);
    return true;
}

// ─── Apply bonuses to a player ────────────────────────────────────────────────

// Copy the permanent upgrade levels into the player's permanentBonus layer
// Call this right after creating a fresh player — sets HP/mana to the new full max.
// For save restores, call restoreResourcesAfterBonus() immediately after to re-apply saved values.
function applyPermanentBonus(player) {
    if (!player || !player.classKey) return;
    const upgrades = getUpgradesForClass(player.classKey);
    for (const stat of Object.keys(upgrades)) {
        player.permanentBonus[stat] = upgrades[stat];
    }
    // Set resources to the new maximums so permanent HP/mana gains take effect immediately
    player.currentHP   = player.getMaxHP();
    player.currentMana = player.getMaxMana();
}

// After a save restore, clamp HP/mana back to the saved mid-run values (not full max)
function restoreResourcesAfterBonus(player, savedHP, savedMana) {
    player.currentHP   = Math.min(savedHP,   player.getMaxHP());
    player.currentMana = Math.min(savedMana, player.getMaxMana());
}

// ─── General upgrades ─────────────────────────────────────────────────────────

// All non-class permanent upgrades available for purchase
const GENERAL_UPGRADES = [
    {
        key:      'goldCarry',
        label:    'Gold Carry',
        desc:     'Keep a portion of gold when a new run starts',
        maxLevel: 4,
        costs:    [20, 35, 55, 80],
        effectLabel: function (lv) {
            return lv === 0 ? 'None' : ['10%', '25%', '50%', '100%'][lv - 1] + ' gold carried';
        },
    },
    {
        key:      'startingPartySize',
        label:    'Starting Party',
        desc:     'Begin each run with more heroes at the select screen',
        maxLevel: 3,
        costs:    [30, 60, 100],
        effectLabel: function (lv) {
            const n = lv + 1;
            return 'Pick ' + n + ' hero' + (n > 1 ? 'es' : '') + ' to start';
        },
    },
    {
        key:      'startingLoot',
        label:    'Starting Loot',
        desc:     'Begin each run with free items in your inventory',
        maxLevel: 3,
        costs:    [25, 45, 70],
        effectLabel: function (lv) {
            return lv === 0 ? 'No bonus items' : '+' + lv + ' random item' + (lv > 1 ? 's' : '');
        },
    },
    {
        key:      'startingRelic',
        label:    'Starting Relic',
        desc:     'Begin each run by choosing a free relic',
        maxLevel: 3,
        costs:    [300, 500, 1000],
        effectLabel: function (lv) {
            if (lv === 0) return 'Not unlocked';
            return 'Pick ' + lv + ' of 3 relics at run start';
        },
    },
];

// Return the current level of a general upgrade (0 if not purchased)
function getGeneralUpgradeLevel(key) {
    return (state.meta.generalUpgrades && state.meta.generalUpgrades[key]) || 0;
}

// Spend shards to buy one level of a general upgrade — returns true on success
function purchaseGeneralUpgrade(key) {
    const upgrade = GENERAL_UPGRADES.find(function (u) { return u.key === key; });
    if (!upgrade) return false;

    const level = getGeneralUpgradeLevel(key);
    if (level >= upgrade.maxLevel) return false;

    const cost = upgrade.costs[level];
    if (state.meta.soulShards < cost) return false;

    state.meta.soulShards -= cost;
    if (!state.meta.generalUpgrades) state.meta.generalUpgrades = {};
    state.meta.generalUpgrades[key] = level + 1;
    saveMetaProgress(state.meta);
    return true;
}

// Return the fraction of gold carried into the next run (0.0 – 1.0)
function getGoldCarryRate() {
    const lv = getGeneralUpgradeLevel('goldCarry');
    return [0, 0.10, 0.25, 0.50, 1.0][lv];
}

// Return how many heroes the player may pick at run start (minimum 1)
function getMaxStartingPartySize() {
    return 1 + getGeneralUpgradeLevel('startingPartySize');
}

// Return how many free random items to grant at the start of a run
function getStartingLootCount() {
    return getGeneralUpgradeLevel('startingLoot');
}

// Return how many relics the player may pick at run start (0 = feature locked)
function getStartingRelicTier() {
    return getGeneralUpgradeLevel('startingRelic');
}

// Pick 2 random distinct non-cursed relics the party doesn't already own, reset shop counter
function assignActRelics() {
    const owned = (state.activeRelics || []).map(function (r) { return r.key; });
    const keys  = Object.keys(RELIC_DATA).filter(function (k) {
        return !RELIC_DATA[k].cursed && !owned.includes(k);
    });
    // Fisher-Yates shuffle
    for (let i = keys.length - 1; i > 0; i--) {
        const j   = Math.floor(Math.random() * (i + 1));
        const tmp = keys[i]; keys[i] = keys[j]; keys[j] = tmp;
    }
    state.actRelicA    = keys[0] || null;
    state.actRelicB    = keys[1] || null;
    state.actShopCount = 0;
}
