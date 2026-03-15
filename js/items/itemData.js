// All item definitions — data only, no logic
// type: 'weapon' | 'armor' | 'accessory'
// rarity: 'common' | 'uncommon' | 'rare' | 'legendary'

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

};
