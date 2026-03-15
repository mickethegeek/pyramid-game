// Procedural item generator — creates unique items as [Prefix] [Base] [optional Suffix]

// ─── Prefix pools by item category and rarity ────────────────────────────────
// Legendary is shared across all categories.
// Each category defines its own common / uncommon / rare lists.

const LEGENDARY_PREFIXES = ['Godforged', 'Abyssal', 'Eternal', 'Forsaken', 'Divine'];

const PREFIX_POOLS = {
    metalWeapon: {
        common:   ['Rusted',      'Chipped',    'Cracked',   'Dull',        'Bent'       ],
        uncommon: ['Iron',        'Bronze',     'Forged',    'Tempered',    'Sharp'      ],
        rare:     ['Obsidian',    'Vicious',    'Serrated',  'Ancient',     'Bloodstained'],
    },
    rangedWeapon: {
        common:   ['Frayed',      'Warped',     'Worn',      'Loose',       'Splintered' ],
        uncommon: ['Polished',    'Taut',       'Carved',    'Reinforced',  'Balanced'   ],
        rare:     ['Enchanted',   'Swift',      'Shadowwood','Ancient',     'Woven'      ],
    },
    casterWeapon: {
        common:   ['Crumbling',   'Faded',      'Dim',       'Dusty',       'Weathered'  ],
        uncommon: ['Polished',    'Inscribed',  'Carved',    'Humming',     'Focused'    ],
        rare:     ['Enchanted',   'Arcane',     'Sacred',    'Voidtouched', 'Ancient'    ],
    },
    metalArmor: {
        common:   ['Dented',      'Cracked',    'Rusted',    'Battered',    'Worn'       ],
        uncommon: ['Iron',        'Bronze',     'Reinforced','Tempered',    'Riveted'    ],
        rare:     ['Obsidian',    'Ancient',    'Sacred',    'Vicious',     'Engraved'   ],
    },
    clothArmor: {
        common:   ['Tattered',    'Scuffed',    'Frayed',    'Worn',        'Undone'     ],
        uncommon: ['Woven',       'Lined',      'Reinforced','Stitched',    'Treated'    ],
        rare:     ['Enchanted',   'Silken',     'Sacred',    'Ancient',     'Shadowweave'],
    },
    accessory: {
        common:   ['Tarnished',   'Crude',      'Chipped',   'Faded',       'Plain'      ],
        uncommon: ['Polished',    'Carved',     'Inscribed', 'Glinting',    'Balanced'   ],
        rare:     ['Enchanted',   'Ancient',    'Sacred',    'Voidtouched', 'Blessed'    ],
    },
};

// Map a base item name to its prefix-pool category
function getBaseCategory(baseName) {
    if (['Sword', 'Axe', 'Mace', 'Dagger', 'Spear'].includes(baseName))   return 'metalWeapon';
    if (['Bow', 'Crossbow'].includes(baseName))                            return 'rangedWeapon';
    if (['Staff', 'Tome', 'Orb', 'Wand'].includes(baseName))              return 'casterWeapon';
    if (['Shield', 'Plate', 'Mail'].includes(baseName))                    return 'metalArmor';
    if (['Robe', 'Cloak'].includes(baseName))                              return 'clothArmor';
    return 'accessory';
}

// Return the correct prefix array for a base item name at a given rarity
function getPrefixPool(baseName, rarity) {
    if (rarity === 'legendary') return LEGENDARY_PREFIXES;
    return PREFIX_POOLS[getBaseCategory(baseName)][rarity];
}

// ─── Base items ───────────────────────────────────────────────────────────────
// Each entry defines what type the item is and which stats it drives.
// secondary stat only added at uncommon or higher.

const BASE_ITEMS = [
    // Weapons — DMG focus
    { name: 'Sword',    type: 'weapon',    primary: 'dmg'  },
    { name: 'Axe',      type: 'weapon',    primary: 'dmg'  },
    { name: 'Mace',     type: 'weapon',    primary: 'dmg'  },
    { name: 'Dagger',   type: 'weapon',    primary: 'dmg',  secondary: 'spd'  },
    { name: 'Spear',    type: 'weapon',    primary: 'dmg',  secondary: 'dex'  },
    // Ranged — DEX/SPD focus
    { name: 'Bow',      type: 'weapon',    primary: 'dex',  secondary: 'spd'  },
    { name: 'Crossbow', type: 'weapon',    primary: 'dmg',  secondary: 'dex'  },
    // Caster — INT focus
    { name: 'Staff',    type: 'weapon',    primary: 'int',  secondary: 'dmg'  },
    { name: 'Tome',     type: 'weapon',    primary: 'int'                     },
    { name: 'Orb',      type: 'weapon',    primary: 'int',  secondary: 'spd'  },
    { name: 'Wand',     type: 'weapon',    primary: 'int',  secondary: 'dex'  },
    // Armor — DEF focus
    { name: 'Shield',   type: 'armor',     primary: 'def',  secondary: 'hp'   },
    { name: 'Plate',    type: 'armor',     primary: 'def',  secondary: 'hp'   },
    { name: 'Mail',     type: 'armor',     primary: 'def',  secondary: 'hp'   },
    { name: 'Robe',     type: 'armor',     primary: 'def',  secondary: 'int'  },
    { name: 'Cloak',    type: 'armor',     primary: 'spd',  secondary: 'def'  },
    // Accessories — LUCK/passive focus
    { name: 'Amulet',   type: 'accessory', primary: 'luck'                    },
    { name: 'Ring',     type: 'accessory', primary: 'luck', secondary: 'hp'   },
    { name: 'Idol',     type: 'accessory', primary: 'luck', secondary: 'int'  },
    { name: 'Talisman', type: 'accessory', primary: 'luck', secondary: 'dex'  },
];

// ─── Suffixes ─────────────────────────────────────────────────────────────────

// Positive suffixes — only on rare/legendary items, 40% roll
const POSITIVE_SUFFIXES = [
    { name: 'of Burning',      passiveKey: 'burn_on_hit',       passiveDesc: 'Attacks apply Burn.'               },
    { name: 'of Poison',       passiveKey: 'poison_on_hit',     passiveDesc: 'Attacks apply Poison.'             },
    { name: 'of Swiftness',    stat: 'spd'                                                                        },
    { name: 'of the Vampire',  passiveKey: 'lifesteal_on_kill', passiveDesc: 'Restore 5% HP on each kill.'       },
    { name: 'of Storms',       passiveKey: 'stun_chance',       passiveDesc: 'Attacks have a chance to Stun.'    },
    { name: 'of Fortune',      stat: 'luck'                                                                       },
    { name: 'of Giants',       stat: 'hp',   mult: 2                                                             },
    { name: 'of Shadows',      stat: 'dex'                                                                        },
];

// Negative suffixes — only on common/uncommon items, 20% roll (displayed in red)
const NEGATIVE_SUFFIXES = [
    { name: 'of Brittleness',  stat: 'def'  },
    { name: 'of Sluggishness', stat: 'spd'  },
    { name: 'of Confusion',    stat: 'int'  },
    { name: 'of Misfortune',   stat: 'luck' },
    { name: 'of Frailty',      stat: 'hp',  mult: 2 },
];

// ─── Stat value ranges by rarity ──────────────────────────────────────────────

const GEN_STAT_RANGES = {
    common:    [1,  2 ],
    uncommon:  [2,  4 ],
    rare:      [4,  7 ],
    legendary: [8,  14],
};

// ─── Flavour descriptions by rarity ──────────────────────────────────────────

const GEN_FLAVOUR = {
    common:    'A battered piece of equipment that has seen better days.',
    uncommon:  'Serviceable gear that will hold up in a fight.',
    rare:      'A finely crafted piece humming with latent power.',
    legendary: 'An artefact of terrible and wondrous origin.',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Return a random element from an array
function randomFrom(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

// Return a random integer in [min, max] inclusive
function randInt(min, max) {
    return min + Math.floor(Math.random() * (max - min + 1));
}

// ─── Main generator ───────────────────────────────────────────────────────────

// Generate and return a new procedural Item.
// forcedType:   'weapon' | 'armor' | 'accessory'  — constrains the base pool.
// forcedRarity: 'common' | 'uncommon' | 'rare' | 'legendary' — skips the rarity roll.
function generateItem(forcedType, forcedRarity) {
    // 1. Rarity determines stat ceiling
    const rarity       = forcedRarity || rollRarity();
    const [minV, maxV] = GEN_STAT_RANGES[rarity];

    // 2. Pick base item first — the category determines which prefix pool to use
    const basePool = forcedType ? BASE_ITEMS.filter(b => b.type === forcedType) : BASE_ITEMS;
    const base     = randomFrom(basePool);

    // 3. Pick a prefix from the correct pool for this base and rarity
    const prefix = randomFrom(getPrefixPool(base.name, rarity));

    // 4. Generate primary stat; add secondary at uncommon+
    const statBonus = { hp: 0, def: 0, dmg: 0, dex: 0, spd: 0, int: 0, luck: 0 };
    statBonus[base.primary] = randInt(minV, maxV);
    if (base.secondary && rarity !== 'common') {
        statBonus[base.secondary] = randInt(1, Math.max(1, Math.floor(maxV / 2)));
    }

    // 5. Roll for a suffix
    let suffixName     = '';
    let passiveKey     = null;
    let passiveDesc    = null;
    let suffixNegative = false;

    if ((rarity === 'rare' || rarity === 'legendary') && Math.random() < 0.40) {
        const sfx  = randomFrom(POSITIVE_SUFFIXES);
        suffixName = sfx.name;
        if (sfx.passiveKey) {
            passiveKey  = sfx.passiveKey;
            passiveDesc = sfx.passiveDesc;
        } else if (sfx.stat) {
            const add = randInt(minV, maxV) * (sfx.mult || 1);
            statBonus[sfx.stat] = (statBonus[sfx.stat] || 0) + add;
        }
    } else if ((rarity === 'common' || rarity === 'uncommon') && Math.random() < 0.20) {
        const sfx      = randomFrom(NEGATIVE_SUFFIXES);
        suffixName     = sfx.name;
        suffixNegative = true;
        const sub      = randInt(1, Math.ceil(maxV / 2)) * (sfx.mult || 1);
        statBonus[sfx.stat] = (statBonus[sfx.stat] || 0) - sub;
    }

    // 6. Assemble name and flavour text
    const name        = prefix + ' ' + base.name + (suffixName ? ' ' + suffixName : '');
    const description = GEN_FLAVOUR[rarity];

    return new Item({
        key:           null,   // generated items have no static key
        name,
        type:          base.type,
        rarity,
        description,
        statBonus,
        passiveKey,
        passiveDesc,
        suffixNegative,
    });
}

// ─── Reroll / upgrade helpers (used by the Forger in shopUI) ─────────────────

// Reroll the prefix of an existing item to any random tier
// Returns a new Item with the updated prefix, rarity, and stats.
function rerollItemPrefix(item) {
    // Strip the current prefix (first word) and base+suffix (the rest)
    const words     = item.name.split(' ');
    const basePart  = words.slice(1).join(' '); // everything after the first word

    const newRarity    = rollRarity();
    const [minV, maxV] = GEN_STAT_RANGES[newRarity];

    // Rebuild stats from scratch for the new tier, preserving base/suffix structure
    const base = BASE_ITEMS.find(b => basePart.startsWith(b.name)) || { primary: 'dmg' };
    const newPrefix    = randomFrom(getPrefixPool(base.name, newRarity));
    const statBonus = { hp: 0, def: 0, dmg: 0, dex: 0, spd: 0, int: 0, luck: 0 };
    statBonus[base.primary] = randInt(minV, maxV);
    if (base.secondary && newRarity !== 'common') {
        statBonus[base.secondary] = randInt(1, Math.max(1, Math.floor(maxV / 2)));
    }

    // Re-apply suffix stat contributions if the suffix was a stat suffix
    const suffixWord = words.slice(2).join(' ');
    const posSfx = POSITIVE_SUFFIXES.find(s => s.name === suffixWord || basePart.endsWith(s.name));
    if (posSfx && posSfx.stat) {
        const add = randInt(minV, maxV) * (posSfx.mult || 1);
        statBonus[posSfx.stat] = (statBonus[posSfx.stat] || 0) + add;
    }

    return new Item({
        key:           null,
        name:          newPrefix + ' ' + basePart,
        type:          item.type,
        rarity:        newRarity,
        description:   GEN_FLAVOUR[newRarity],
        statBonus,
        passiveKey:    item.passiveKey,
        passiveDesc:   item.passiveDesc,
        suffixNegative: newRarity !== 'rare' && newRarity !== 'legendary' && item.suffixNegative,
    });
}

// Upgrade the prefix of an existing item exactly one tier up
// Returns a new Item, or null if the item is already legendary.
function upgradeItemPrefix(item) {
    const tiers  = ['common', 'uncommon', 'rare', 'legendary'];
    const curIdx = tiers.indexOf(item.rarity);
    if (curIdx === tiers.length - 1) return null;   // already legendary

    const newRarity    = tiers[curIdx + 1];
    const [minV, maxV] = GEN_STAT_RANGES[newRarity];

    // Re-scale primary stat to the new tier range while preserving excess from suffix
    const base = BASE_ITEMS.find(b => item.name.includes(b.name)) || { primary: 'dmg' };
    const newPrefix    = randomFrom(getPrefixPool(base.name, newRarity));
    const statBonus = { hp: 0, def: 0, dmg: 0, dex: 0, spd: 0, int: 0, luck: 0 };
    statBonus[base.primary] = randInt(minV, maxV);
    if (base.secondary && newRarity !== 'common') {
        statBonus[base.secondary] = randInt(1, Math.max(1, Math.floor(maxV / 2)));
    }

    // Re-apply passive suffix stat bonus if applicable
    if (!item.passiveKey) {
        const posSfx = POSITIVE_SUFFIXES.find(s => item.name.endsWith(s.name));
        if (posSfx && posSfx.stat) {
            const add = randInt(minV, maxV) * (posSfx.mult || 1);
            statBonus[posSfx.stat] = (statBonus[posSfx.stat] || 0) + add;
        }
    }

    // Preserve the base+suffix portion of the name, replace only the prefix
    const words    = item.name.split(' ');
    const basePart = words.slice(1).join(' ');

    return new Item({
        key:           null,
        name:          newPrefix + ' ' + basePart,
        type:          item.type,
        rarity:        newRarity,
        description:   GEN_FLAVOUR[newRarity],
        statBonus,
        passiveKey:    item.passiveKey,
        passiveDesc:   item.passiveDesc,
        suffixNegative: false,   // negative suffixes disappear on upgrade
    });
}
