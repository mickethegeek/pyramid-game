// All enemy definitions — data only, no logic

const ENEMY_DATA = {

    goblin: {
        name: 'Goblin',
        stats: {
            hp:   35,   // Low HP — dies quickly if hit
            def:   1,   // Almost no armour
            dmg:   4,   // Weak hits
            dex:   5,   // Average dodge / crit
            spd:  12,   // Very fast — almost always acts first
            int:   1,
            luck: 10,   // Surprisingly lucky — higher crit chance
        },
    },

    skeleton: {
        name: 'Skeleton',
        stats: {
            hp:   40,   // Slightly more durable than a Goblin
            def:   3,   // Bony frame absorbs a little damage
            dmg:   6,   // Hits harder than a Goblin
            dex:   3,   // Clumsy, low dodge
            spd:   8,   // Slow — acts after most characters
            int:   1,
            luck:  3,
        },
    },

    desertWarrior: {
        name: 'Desert Warrior',
        stats: {
            hp:   55,   // Durable front-liner
            def:   5,   // Heavy armour reduces incoming damage
            dmg:   8,   // Strong, deliberate strikes
            dex:   4,
            spd:   7,   // Methodical — acts near the end of the order
            int:   2,
            luck:  4,
        },
    },

    sandMage: {
        name: 'Sand Mage',
        stats: {
            hp:   30,   // Fragile — punish it before it acts
            def:   1,   // Almost no physical defence
            dmg:  12,   // High magical damage output
            dex:   4,
            spd:   9,   // Faster than warriors, slower than Goblin
            int:  10,   // High INT — spells scale well
            luck:  5,
        },
    },

    sphinxGuard: {
        name: 'Sphinx Guard',
        stats: {
            hp:   70,   // Biggest health pool of the starter enemies
            def:   8,   // Heavy stone armour — most hits barely scratch it
            dmg:  10,   // Slow but devastating when it connects
            dex:   2,   // Very low dodge — easy to hit back
            spd:   5,   // Acts last almost every round
            int:   3,
            luck:  2,
        },
    },

    // ── Act bosses ────────────────────────────────────────────────────────────

    sandPharaoh: {
        name: 'Sand Pharaoh',
        intro: 'The Sand Pharaoh stirs from eternal sleep. His curse has claimed countless souls.',
        stats: {
            hp:  150,   // High HP — a war of attrition
            def:   5,   // Moderate armour
            dmg:  15,   // Punishing strikes
            dex:   6,
            spd:   6,
            int:   8,
            luck:  5,
        },
    },

    pyramidColossus: {
        name: 'Pyramid Colossus',
        intro: 'The Pyramid Colossus shakes the chamber as it rises. Stone grinds against stone.',
        stats: {
            hp:  180,   // Very high HP — a long, grinding fight
            def:  12,   // Exceptional armour — chip damage won't work
            dmg:  12,   // Hits hard despite its bulk
            dex:   4,
            spd:   4,   // Slow, but you'll feel every hit
            int:   3,
            luck:  3,
        },
    },

    theApex: {
        name: 'The Apex',
        intro: 'The Apex manifests at the summit — ancient, perfect, and utterly merciless.',
        stats: {
            hp:  160,   // Balanced but imposing across all stats
            def:   8,
            dmg:  14,
            dex:   8,
            spd:   9,   // Faster than most — controls initiative
            int:   8,
            luck:  8,
        },
    },
};

// ─── Spawn group tables ────────────────────────────────────────────────────────
// Each entry is an array of enemy keys that appear together in one encounter.
// Tables are split by act: later acts spawn larger groups.

const ENEMY_SPAWN_GROUPS = {
    normal: {
        1: [
            ['goblin'],
            ['skeleton'],
            ['sandMage'],
            ['goblin', 'goblin'],
            ['goblin', 'skeleton'],
        ],
        2: [
            ['goblin', 'goblin'],
            ['skeleton', 'goblin'],
            ['sandMage', 'goblin'],
            ['skeleton', 'skeleton'],
            ['goblin', 'goblin', 'goblin'],
        ],
        3: [
            ['skeleton', 'skeleton', 'goblin'],
            ['sandMage', 'goblin', 'goblin'],
            ['sandMage', 'skeleton'],
            ['goblin', 'goblin', 'sandMage'],
            ['skeleton', 'sandMage', 'skeleton'],
        ],
    },
    elite: {
        1: [
            ['desertWarrior'],
            ['sphinxGuard'],
        ],
        2: [
            ['desertWarrior', 'goblin'],
            ['sphinxGuard', 'skeleton'],
            ['desertWarrior', 'desertWarrior'],
        ],
        3: [
            ['sphinxGuard', 'desertWarrior'],
            ['desertWarrior', 'desertWarrior', 'skeleton'],
            ['sphinxGuard', 'sphinxGuard'],
        ],
    },
    // Boss rooms always spawn exactly one boss — key is indexed by act number
    boss: {
        1: ['sandPharaoh'],
        2: ['pyramidColossus'],
        3: ['theApex'],
    },
};

// Pick and return a random enemy key array for the given room type and act number
function pickEnemyGroup(roomType, actNumber) {
    if (roomType === 'boss') {
        return ENEMY_SPAWN_GROUPS.boss[actNumber] || ENEMY_SPAWN_GROUPS.boss[1];
    }
    const table    = ENEMY_SPAWN_GROUPS[roomType] || ENEMY_SPAWN_GROUPS.normal;
    const actTable = table[actNumber] || table[1];
    return actTable[Math.floor(Math.random() * actTable.length)];
}
