// Potion logic — effect execution and party pool management
// Depends on: potionData.js, statusEffects.js, state.js

// ─── Pool management ───────────────────────────────────────────────────────────

// Return the party's shared flat array of potion keys
function getPartyPotionPool() {
    return state.partyPotions;
}

// Return the maximum number of potions the party can carry at once
function getPartyPotionLimit() {
    const wizardBonus = state.party.some(m => m.classKey === 'wizard') ? 1 : 0;
    return state.party.length * 2 + wizardBonus;
}

// Add a potion key to the pool if under the carry limit
function addPotionToParty(potionKey) {
    if (state.partyPotions.length < getPartyPotionLimit()) {
        state.partyPotions.push(potionKey);
    }
}

// Remove the first occurrence of a potion key from the pool
function removePotionFromPool(potionKey) {
    const idx = state.partyPotions.indexOf(potionKey);
    if (idx !== -1) state.partyPotions.splice(idx, 1);
}

// ─── Effect execution ──────────────────────────────────────────────────────────

// Execute a potion's effect — handles self, targeted, and AoE variants.
// potion:     POTION_DATA entry (must include .key)
// thrower:    the acting Character using the potion
// target:     enemy clicked by the player (used for damage_vial; ignored for AoE / self)
// allEnemies: array of currently alive enemies (used for explosive_flask)
// log:        combat log callback
function applyPotion(potion, thrower, target, allEnemies, log) {
    const int = thrower.getStat('int');
    const dex = thrower.getStat('dex');

    switch (potion.key) {

        case 'small_heal': {
            // Restore 15 + floor(INT/4) HP to the thrower
            const heal = 15 + Math.floor(int / 4);
            thrower.currentHP = Math.min(thrower.getMaxHP(), thrower.currentHP + heal);
            log(thrower.name + ' drinks the Healing Vial and recovers ' + heal + ' HP!');
            break;
        }

        case 'large_heal': {
            // Restore 35 + floor(INT/3) HP to the thrower
            const heal = 35 + Math.floor(int / 3);
            thrower.currentHP = Math.min(thrower.getMaxHP(), thrower.currentHP + heal);
            log(thrower.name + ' drinks the Healing Vial and recovers ' + heal + ' HP!');
            break;
        }

        case 'antidote': {
            // Remove Poison and Burn — INT has no effect
            removeStatusEffect(thrower, 'poison');
            removeStatusEffect(thrower, 'burn');
            log(thrower.name + ' drinks the Antidote and is cleansed of poison and burn!');
            break;
        }

        case 'damage_vial': {
            // DEX roll vs DC 10 — on failure, vial misses entirely
            const roll = Math.floor(Math.random() * 20) + 1 + Math.floor(dex / 3);
            if (roll < 10) {
                log(thrower.name + ' fumbles the Damage Vial — it shatters harmlessly!');
                break;
            }
            const dmg = 20 + Math.floor(int / 3);
            target.takeDamage(dmg, log);
            log(thrower.name + ' hurls a Damage Vial at ' + target.name + ' for ' + dmg + ' damage!');
            break;
        }

        case 'explosive_flask': {
            // DEX roll vs DC 12 — on failure, one random enemy escapes the blast (min 1 still hit)
            const roll    = Math.floor(Math.random() * 20) + 1 + Math.floor(dex / 3);
            const targets = [...allEnemies];
            if (roll < 12 && targets.length > 1) {
                const skipIdx = Math.floor(Math.random() * targets.length);
                targets.splice(skipIdx, 1);
                log(thrower.name + " throws the flask but one enemy ducks out of the blast!");
            } else {
                log(thrower.name + ' hurls an Explosive Flask!');
            }
            const dmg = 15 + Math.floor(int / 4);
            for (const enemy of targets) {
                enemy.takeDamage(dmg, log);
                log(enemy.name + ' takes ' + dmg + ' explosion damage!');
            }
            break;
        }
    }
}
