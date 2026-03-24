// Room composition definitions — curated Act 1 enemy encounters with row assignments
// Each composition is a named encounter with a kill-order hint for the player.
// Keys match ENEMY_DATA entries (camelCase). Row: 'front' | 'back'.

const ROOM_COMPOSITIONS = {

    the_pack: {
        name:        'The Pack',
        description: 'Four Bog Rats. Kill fast before Scatter cascades.',
        enemies: [
            { key: 'bogRat', row: 'front' },
            { key: 'bogRat', row: 'front' },
            { key: 'bogRat', row: 'front' },
            { key: 'bogRat', row: 'front' },
        ],
        killOrderHint: 'Kill any one — survivors Scatter. Burst them all before that happens.',
    },

    the_bloat: {
        name:        'The Bloat',
        description: 'Two Swamp Crawlers. On-death explosions chain if you stagger kills.',
        enemies: [
            { key: 'swampCrawler', row: 'front' },
            { key: 'swampCrawler', row: 'front' },
        ],
        killOrderHint: 'Kill one completely before damaging the second. Chain explosions are lethal.',
    },

    the_warden: {
        name:        'The Warden',
        description: 'Vine Strangler buffs all allies. Kill it first to strip the DEF bonus.',
        enemies: [
            { key: 'vineStrangler', row: 'front' },
            { key: 'bogRat',        row: 'front' },
            { key: 'bogRat',        row: 'front' },
        ],
        killOrderHint: 'Strangler first. Its root network gives all allies +10% DEF while it lives.',
    },

    the_hex_room: {
        name:        'The Hex Room',
        description: 'Bog Witch buffs and curses. Kill her before she spirals the room.',
        enemies: [
            { key: 'bogWitch',  row: 'back'  },
            { key: 'mudGolem',  row: 'front' },
        ],
        killOrderHint: 'Witch first — she buffs every 3 turns. Golem is a wall but predictable.',
    },

    the_slow_death: {
        name:        'The Slow Death',
        description: 'Silence and poison together. Strangler is the priority.',
        enemies: [
            { key: 'swampCrawler', row: 'front' },
            { key: 'vineStrangler', row: 'front' },
        ],
        killOrderHint: 'Strangler silences your healers. Kill it first or the poison wins.',
    },

    the_wall: {
        name:        'The Wall',
        description: 'Two Mud Golems share damage. Full focus-fire one at a time.',
        enemies: [
            { key: 'mudGolem', row: 'front' },
            { key: 'mudGolem', row: 'front' },
        ],
        killOrderHint: 'Never split damage. 100% focus on one until dead, then the other.',
    },

    the_spiral: {
        name:        'The Spiral',
        description: 'Late Act 1. Three threats. Kill order is everything.',
        enemies: [
            { key: 'bogWitch',     row: 'back'  },
            { key: 'swampCrawler', row: 'front' },
            { key: 'bogRat',       row: 'front' },
        ],
        killOrderHint: 'Witch → Crawler → Rat. Deviate and the room compounds against you.',
    },
};

// Build and return an array of Enemy instances from a named composition.
// Sets each enemy's row as specified in the composition entry.
function loadComposition(key, actNumber) {
    const comp = ROOM_COMPOSITIONS[key];
    if (!comp) return [];
    return comp.enemies.map(entry => {
        const enemy = createEnemy(entry.key, actNumber);
        enemy.row   = entry.row;
        return enemy;
    });
}

// Build 2–4 random Act 1 enemies when the composition queue is exhausted.
// Row assignment: 70% front, 30% back per enemy.
function pickAct1RandomEnemies() {
    const pool  = ['bogRat', 'swampCrawler', 'vineStrangler', 'bogWitch', 'mudGolem'];
    const count = 2 + Math.floor(Math.random() * 3);  // 2, 3, or 4
    const enemies = [];
    for (let i = 0; i < count; i++) {
        const key   = pool[Math.floor(Math.random() * pool.length)];
        const enemy = createEnemy(key, 1);
        enemy.row   = Math.random() < 0.7 ? 'front' : 'back';
        enemies.push(enemy);
    }
    return enemies;
}
