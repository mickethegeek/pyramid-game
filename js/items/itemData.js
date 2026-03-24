// All item definitions — data only, no logic
// type: 'weapon' | 'armor' | 'accessory' | 'shield' | 'tome' | 'orb' | 'quiver' | 'focus'
// rarity: 'common' | 'uncommon' | 'rare' | 'legendary'
// Offhand types (shield, tome, orb, quiver, focus) equip to character.equipment.offhand

const ITEM_DATA = {

    // ── Weapons ───────────────────────────────────────────────────────────────

    stone_sword: {
        name: 'Stone Sword',
        type: 'weapon',
        rarity: 'common',
        description: 'A crude but reliable blade chipped from sandstone.',
        statBonus: { dmg: 3 },
    },

    bronze_blade: {
        name: 'Bronze Blade',
        type: 'weapon',
        rarity: 'uncommon',
        description: 'Light enough to strike before your enemy can react.',
        statBonus: { dmg: 5, dex: 2 },
    },

    iron_mace: {
        name: 'Iron Mace',
        type: 'weapon',
        rarity: 'uncommon',
        description: 'Heavy blunt force that cracks armour and bone alike.',
        statBonus: { dmg: 6, def: 1 },
    },

    wizard_staff: {
        name: 'Wizard Staff',
        type: 'weapon',
        rarity: 'rare',
        description: 'Ancient wood wound with copper wire — channels raw arcane energy.',
        statBonus: { dmg: 3, int: 6 },
    },

    sun_blade: {
        name: 'Sun Blade',
        type: 'weapon',
        rarity: 'legendary',
        description: 'Forged in the last light of a dying star. Burns with golden fire.',
        statBonus: { dmg: 12, luck: 3 },
    },

    // ── Armors ────────────────────────────────────────────────────────────────

    leather_tunic: {
        name: 'Leather Tunic',
        type: 'armor',
        rarity: 'common',
        description: 'Simple cured hide — better than nothing.',
        statBonus: { def: 2, hp: 8 },
    },

    chain_mail: {
        name: 'Chain Mail',
        type: 'armor',
        rarity: 'uncommon',
        description: 'Interlocked iron rings that absorb heavy strikes.',
        statBonus: { def: 4, hp: 15 },
    },

    scale_armor: {
        name: 'Scale Armor',
        type: 'armor',
        rarity: 'uncommon',
        description: 'Overlapping scales harvested from a desert serpent.',
        statBonus: { def: 5, hp: 12 },
    },

    plate_armor: {
        name: 'Plate Armor',
        type: 'armor',
        rarity: 'rare',
        description: 'Full plate — impenetrable, but it will slow you down.',
        statBonus: { def: 8, hp: 20 },
    },

    pharaoh_shroud: {
        name: "Pharaoh's Shroud",
        type: 'armor',
        rarity: 'legendary',
        description: 'Burial wrappings soaked in divine oils. Death avoids the wearer.',
        statBonus: { def: 6, hp: 25, luck: 4 },
    },

    // ── Accessories ───────────────────────────────────────────────────────────

    lucky_charm: {
        name: 'Lucky Charm',
        type: 'accessory',
        rarity: 'common',
        description: "A rabbit's foot found half-buried in the sand.",
        statBonus: { luck: 5 },
    },

    bone_amulet: {
        name: 'Bone Amulet',
        type: 'accessory',
        rarity: 'uncommon',
        description: 'Strung from the knuckles of a fallen champion.',
        statBonus: {},
        passiveKey:  'first_hit_crit',
        passiveDesc: 'First hit each combat is always a critical strike.',
    },

    blood_ring: {
        name: 'Blood Ring',
        type: 'accessory',
        rarity: 'uncommon',
        description: 'The ruby pulses in time with a heartbeat that is not your own.',
        statBonus: { hp: 5 },
        passiveKey:  'heal_on_victory',
        passiveDesc: 'Restore 10 HP after each combat victory.',
    },

    swift_boots: {
        name: 'Swift Boots',
        type: 'accessory',
        rarity: 'rare',
        description: 'Light sandals that carry you faster than thought.',
        statBonus: { spd: 4 },
    },

    pyramid_eye: {
        name: 'Pyramid Eye',
        type: 'accessory',
        rarity: 'legendary',
        description: 'A carved obsidian eye that sees through stone and deception.',
        statBonus: { dex: 4, luck: 4 },
        passiveKey:  'trap_immunity',
        passiveDesc: 'Immune to all trap damage.',
    },


    // ── Offhand: Shields (Warrior / Paladin) ──────────────────────────────────

    buckler: {
        name: 'Buckler',
        type: 'shield',
        rarity: 'common',
        description: 'A small round shield — light enough not to slow you down.',
        statBonus: { def: 3, hp: 5 },
    },

    kite_shield: {
        name: 'Kite Shield',
        type: 'shield',
        rarity: 'uncommon',
        description: 'A tapered shield that covers the torso and upper leg.',
        statBonus: { def: 5, hp: 10 },
    },

    tower_shield: {
        name: 'Tower Shield',
        type: 'shield',
        rarity: 'rare',
        description: 'A massive slab of iron — almost a wall unto itself.',
        statBonus: { def: 7, hp: 15 },
    },

    // ── Offhand: Tomes (Cleric / Wizard) ──────────────────────────────────────

    worn_tome: {
        name: 'Worn Tome',
        type: 'tome',
        rarity: 'common',
        description: 'Pages soft with handling, filled with half-legible annotations.',
        statBonus: { int: 3, hp: 3 },
    },

    scholars_tome: {
        name: "Scholar's Tome",
        type: 'tome',
        rarity: 'uncommon',
        description: 'A methodically indexed compendium of arcane theory.',
        statBonus: { int: 5, hp: 5 },
    },

    ancient_codex: {
        name: 'Ancient Codex',
        type: 'tome',
        rarity: 'rare',
        description: 'Bound in unknown hide, its script rewrites itself between readings.',
        statBonus: { int: 7, hp: 7 },
    },

    // ── Offhand: Orbs (Barbarian / Cleric / Wizard / Summoner) ────────────────

    chaos_orb: {
        name: 'Chaos Orb',
        type: 'orb',
        rarity: 'common',
        description: 'Swirls of raw energy barely contained within cracked crystal.',
        statBonus: { int: 2, dmg: 2 },
    },

    void_orb: {
        name: 'Void Orb',
        type: 'orb',
        rarity: 'uncommon',
        description: 'A sphere of absolute darkness that hums with suppressed violence.',
        statBonus: { int: 4, dmg: 3 },
    },

    soul_orb: {
        name: 'Soul Orb',
        type: 'orb',
        rarity: 'rare',
        description: 'Three screaming faces orbit the surface — too small to recognise.',
        statBonus: { int: 5, dmg: 5 },
    },

    // ── Offhand: Quivers (Archer) ─────────────────────────────────────────────

    quiver: {
        name: 'Quiver',
        type: 'quiver',
        rarity: 'common',
        description: 'Simple leather tube. Keeps your arrows in reach.',
        statBonus: { dex: 3, spd: 2 },
    },

    hunting_quiver: {
        name: 'Hunting Quiver',
        type: 'quiver',
        rarity: 'uncommon',
        description: 'Custom-fitted for fast draws. Well-balanced and silent.',
        statBonus: { dex: 5, spd: 3 },
    },

    battle_quiver: {
        name: 'Battle Quiver',
        type: 'quiver',
        rarity: 'rare',
        description: 'Heavy-duty quiver with a quick-release mechanism.',
        statBonus: { dex: 7, spd: 4 },
    },

    // ── Offhand: Foci (Summoner) ──────────────────────────────────────────────

    crude_focus: {
        name: 'Crude Focus',
        type: 'focus',
        rarity: 'common',
        description: 'A rough gemstone that helps channel the will outward.',
        statBonus: { int: 2, luck: 2 },
    },

    soul_focus: {
        name: 'Soul Focus',
        type: 'focus',
        rarity: 'uncommon',
        description: 'A preserved eye from something that should not have had eyes.',
        statBonus: { int: 4, luck: 3 },
    },

    void_focus: {
        name: 'Void Focus',
        type: 'focus',
        rarity: 'rare',
        description: 'Cold to the touch. Familiar creatures are drawn to it instinctively.',
        statBonus: { int: 5, luck: 5 },
    },

};
