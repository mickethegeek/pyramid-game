// All global game state — the single source of truth for the entire game

const state = {
    // Current screen being rendered
    // 'mainMenu' | 'runStart' | 'pyramid' | 'combat' | 'shop' | 'event' | 'camp' | 'gameOver' | 'victory' | 'meta'
    currentScene: 'mainMenu',

    // Whether the pause overlay is currently open
    paused: false,

    // Pyramid navigation state
    pyramid: null,
    currentRoom: null,
    adjacentRooms: [],

    // The active party — up to 6 characters, populated on the run-start screen.
    // state.player is kept in sync as state.party[0] for legacy helpers (doRest, doTrap, etc.).
    party:  [],
    player: null,

    // Active combat data (null when not in combat)
    combat: null,

    // Message shown as an overlay on the pyramid after instant room events
    // (Treasure, Rest, Trap, Warp). Cleared when the player clicks to continue.
    roomMessage: '',

    // Meta progress — loaded from localStorage at startup, persists forever
    meta: null,

    // Which act the player is currently on (1, 2, or 3)
    actNumber: 1,

    // Soul Shards earned during the current run (added to meta on run end)
    soulShardsThisRun: 0,

    // Gold earned during the current run — resets on run end, used in shops and events
    gold: 0,

    // Data for the currently active event room — null when not in an event
    currentEvent: null,

    // Shared party item pool — items picked up during the run, not yet equipped
    inventory: [],

    // Active relics for this run — party-wide passive effects
    activeRelics: [],

    // How many shops the player has visited in the current act (resets each act)
    actShopCount: 0,

    // Relic keys offered in shops this act — A for visits 1-4, B for visits 5-8
    actRelicA: null,
    actRelicB: null,

    // Shared party potion pool — flat array of potion keys e.g. ['small_heal', 'damage_vial']
    partyPotions: [],

    // Active trap encounter data — null when not in a trap room
    currentTrap: null,

    // True once the player has visited enough rooms to anger the pyramid (≥ 30)
    // Persists until the run ends; triggers modified room odds and boss-first turns
    pyramidWrathActive: false,

    // Wrath flavour message queued to show after the current room resolves
    // (stored separately so it isn't overwritten by the room's own message)
    wrathMessage: '',
};
