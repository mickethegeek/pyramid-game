// Base item class — all equipment inherits this structure

class Item {

    // Build an item from a definition pulled from ITEM_DATA
    constructor(data) {
        this.key         = data.key;
        this.name        = data.name;
        this.type        = data.type;        // 'weapon' | 'armor' | 'accessory'
        this.rarity      = data.rarity;      // 'common' | 'uncommon' | 'rare' | 'legendary'
        this.description = data.description || '';

        // Flat stat bonuses applied while this item is equipped
        this.statBonus = {
            hp: 0, def: 0, dmg: 0,
            dex: 0, spd: 0, int: 0, luck: 0,
            ...(data.statBonus || {}),
        };

        // Optional passive effect — key used by game logic, desc shown to the player
        this.passiveKey      = data.passiveKey      || null;
        this.passiveDesc     = data.passiveDesc     || null;

        // True if the suffix is negative — UI renders it in red
        this.suffixNegative  = data.suffixNegative  || false;
    }
}
