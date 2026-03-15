// Potion definitions — data only, no logic
// Each entry: key, name, description, selfOnly (bool), aoe (bool)
// Effect values are computed in potionLogic.js using the thrower's INT and DEX stats

const POTION_DATA = {

    small_heal: {
        key:         'small_heal',
        name:        'Small Healing Vial',
        description: 'Restore 15 + INT/4 HP to yourself.',
        selfOnly:    true,
        aoe:         false,
    },

    large_heal: {
        key:         'large_heal',
        name:        'Large Healing Vial',
        description: 'Restore 35 + INT/3 HP to yourself.',
        selfOnly:    true,
        aoe:         false,
    },

    antidote: {
        key:         'antidote',
        name:        'Antidote Flask',
        description: 'Remove Poison and Burn from yourself. INT has no effect.',
        selfOnly:    true,
        aoe:         false,
    },

    damage_vial: {
        key:         'damage_vial',
        name:        'Damage Vial',
        description: 'Throw at an enemy for 20 + INT/3 damage. DEX roll DC 10 — miss = no effect.',
        selfOnly:    false,
        aoe:         false,
    },

    explosive_flask: {
        key:         'explosive_flask',
        name:        'Explosive Flask',
        description: 'Hits all enemies for 15 + INT/4 damage. DEX roll DC 12 — fail hits one fewer (min 1).',
        selfOnly:    false,
        aoe:         true,
    },
};
