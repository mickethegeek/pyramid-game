// Skill management — equip, unequip, upgrade, discover, and loadout helpers.

// ─── 1. canEquipSkill ─────────────────────────────────────────────────────────

// Returns true if character is allowed to equip skillKey right now.
function canEquipSkill(character, skillKey) {
    const skill = SKILL_DATA[skillKey];

    // Skill must exist in the data file
    if (!skill) {
        console.log(`[canEquipSkill] FAIL — "${skillKey}" not found in SKILL_DATA`);
        return false;
    }

    // Skill must be transferable (null) or locked to this character's class
    if (skill.class !== null && skill.class !== character.classKey) {
        console.log(`[canEquipSkill] FAIL — ${skillKey} is locked to "${skill.class}", ${character.name} is "${character.classKey}"`);
        return false;
    }

    // Character must not already have this skill equipped
    if (character.equippedSkills.includes(skillKey)) {
        console.log(`[canEquipSkill] FAIL — ${character.name} already has ${skillKey} equipped`);
        return false;
    }

    // Slot limit: 1 currently. Meta upgrade to 2 will be checked here later.
    // (Future: replace 1 with getMaxSkillSlots() from metaProgress.js)
    const maxSlots = 1;
    if (character.equippedSkills.length >= maxSlots) {
        console.log(`[canEquipSkill] FAIL — ${character.name} has no open skill slots (${character.equippedSkills.length}/${maxSlots})`);
        return false;
    }

    return true;
}

// ─── 2. equipSkill ────────────────────────────────────────────────────────────

// Moves skillKey from the shared inventory into the character's equippedSkills.
// Returns false if canEquipSkill fails or the skill isn't in the shared inventory.
function equipSkill(character, skillKey) {
    if (!canEquipSkill(character, skillKey)) return false;

    // Skill must be present in the shared pool before equipping
    const idx = state.sharedSkillInventory.indexOf(skillKey);
    if (idx === -1) {
        console.log(`[equipSkill] FAIL — ${skillKey} not found in sharedSkillInventory`);
        return false;
    }

    state.sharedSkillInventory.splice(idx, 1);
    character.equippedSkills.push(skillKey);

    discoverSkill(skillKey);

    // Warrior loadout may change based on skills equipped
    if (character.classKey === 'warrior') updateWarriorLoadout(character);

    const skillName = SKILL_DATA[skillKey].levels[1].name;
    console.log(`[equipSkill] ${character.name} equipped ${skillName}`);
    return true;
}

// ─── 3. unequipSkill ──────────────────────────────────────────────────────────

// Removes skillKey from the character's equipped slots and returns it to the shared inventory.
function unequipSkill(character, skillKey) {
    const idx = character.equippedSkills.indexOf(skillKey);
    if (idx === -1) {
        console.log(`[unequipSkill] FAIL — ${character.name} does not have ${skillKey} equipped`);
        return;
    }

    character.equippedSkills.splice(idx, 1);
    state.sharedSkillInventory.push(skillKey);

    if (character.classKey === 'warrior') updateWarriorLoadout(character);

    const skillName = SKILL_DATA[skillKey].levels[1].name;
    console.log(`[unequipSkill] ${character.name} unequipped ${skillName}`);
}

// ─── 4. upgradeSkill ──────────────────────────────────────────────────────────

// Advances skillKey by one level on its upgradeChain.
// The character must own the skill (equipped or base). Returns false if at max level.
function upgradeSkill(character, skillKey) {
    const skill = SKILL_DATA[skillKey];
    if (!skill) {
        console.log(`[upgradeSkill] FAIL — "${skillKey}" not found in SKILL_DATA`);
        return false;
    }

    // Confirm the character actually owns this skill
    const ownsSkill = character.baseSkill === skillKey
                   || character.equippedSkills.includes(skillKey);
    if (!ownsSkill) {
        console.log(`[upgradeSkill] FAIL — ${character.name} does not own ${skillKey}`);
        return false;
    }

    // Initialise to level 1 if this character hasn't used the skill yet
    if (!character.skillLevels[skillKey]) {
        character.skillLevels[skillKey] = 1;
    }

    const currentLevel = character.skillLevels[skillKey];

    if (currentLevel >= skill.maxLevel) {
        console.log(`[upgradeSkill] FAIL — ${character.name}'s ${skill.levels[currentLevel].name} is already at max level (${skill.maxLevel})`);
        return false;
    }

    const oldName = skill.levels[currentLevel].name;
    character.skillLevels[skillKey] = currentLevel + 1;
    const newName = skill.levels[currentLevel + 1].name;

    console.log(`[upgradeSkill] ${character.name}'s ${oldName} upgraded to ${newName}`);
    return true;
}

// ─── 5. discoverSkill ─────────────────────────────────────────────────────────

// Permanently records a skill as seen. No-op if already known. Saves meta.
function discoverSkill(skillKey) {
    if (state.meta.discoveredSkills.includes(skillKey)) return;

    state.meta.discoveredSkills.push(skillKey);
    saveMetaProgress(state.meta);

    const skillName = SKILL_DATA[skillKey] ? SKILL_DATA[skillKey].levels[1].name : skillKey;
    console.log(`[discoverSkill] New skill discovered: ${skillName}`);
}

// ─── 6. getCompatibleSkills ───────────────────────────────────────────────────

// Returns all skill keys in sharedSkillInventory that this character can equip right now.
function getCompatibleSkills(character) {
    return state.sharedSkillInventory.filter(skillKey => canEquipSkill(character, skillKey));
}

// ─── 7. updateWarriorLoadout ──────────────────────────────────────────────────

// Reads the Warrior's equipment and sets warrior.activeLoadout to
// 'shield' | 'dualwield' | null.
// If a previously-equipped variant skill is now incompatible it gets unequipped
// and returned to the shared inventory.
//
// Offhand slot does not exist yet — this will always resolve to null until
// warrior.equipment.offhand is introduced alongside shield/dual-wield items.
function updateWarriorLoadout(warrior) {
    const offhand = warrior.equipment.offhand || null;

    let newLoadout = null;
    if (offhand) {
        if (offhand.type === 'shield') {
            newLoadout = 'shield';
        } else if (offhand.type === 'weapon') {
            newLoadout = 'dualwield';
        }
    }

    warrior.activeLoadout = newLoadout;

    // Remove any now-incompatible loadout-variant skill from equipped slots
    const incompatible = [];
    for (const skillKey of [...warrior.equippedSkills]) {
        const skill = SKILL_DATA[skillKey];
        if (!skill || !skill.loadoutVariant) continue;
        if (skill.loadoutVariant !== newLoadout) {
            incompatible.push(skillKey);
        }
    }

    for (const skillKey of incompatible) {
        const idx = warrior.equippedSkills.indexOf(skillKey);
        if (idx !== -1) {
            warrior.equippedSkills.splice(idx, 1);
            state.sharedSkillInventory.push(skillKey);
            console.log(`[updateWarriorLoadout] ${SKILL_DATA[skillKey].levels[1].name} returned to shared inventory (loadout mismatch)`);
        }
    }

    console.log(`[updateWarriorLoadout] ${warrior.name} activeLoadout = ${warrior.activeLoadout}`);
}
