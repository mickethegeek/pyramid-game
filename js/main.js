// Game loop, canvas setup, and scene switching — the entry point for everything

// ─── Canvas setup ──────────────────────────────────────────────────────────────

var gameCanvas = document.getElementById('gameCanvas');
gameCanvas.width  = 1200;
gameCanvas.height = 640;

initRenderer(gameCanvas);

// ─── Initialisation ────────────────────────────────────────────────────────────

// Load persistent data, register factories, wire input, show main menu
function init() {
    state.meta = loadMetaProgress();
    saveMetaProgress(state.meta);

    registerClassFactory('warrior',   createWarrior);
    registerClassFactory('barbarian', createBarbarian);
    registerClassFactory('cleric',    createCleric);
    registerClassFactory('archer',    createArcher);
    registerClassFactory('wizard',    createWizard);
    registerClassFactory('paladin',   createPaladin);
    registerClassFactory('summoner',  createSummoner);

    initInput(gameCanvas, handleCanvasClick);

    state.currentScene = 'mainMenu';
}

// ─── Scene routing ─────────────────────────────────────────────────────────────

// All clicks pass through here — pause and corner button always take priority
function handleCanvasClick(x, y) {
    // Corner button is active on every scene except the main menu
    if (state.currentScene !== 'mainMenu' && isMenuButtonClick(x, y)) {
        state.paused = !state.paused;
        return;
    }

    // When paused, all clicks go to the pause overlay
    if (state.paused) {
        const action = handlePauseOverlayClick(x, y);
        if      (action === 'resume')    state.paused = false;
        else if (action === 'mainMenu')  goToMainMenu();
        else if (action === 'resetRun')  resetRun();
        else if (action === 'fullReset') fullReset();
        return;
    }

    // Normal scene routing
    if      (state.currentScene === 'mainMenu')  handleMainMenuAreaClick(x, y);
    else if (state.currentScene === 'runStart')  handleRunStartAreaClick(x, y);
    else if (state.currentScene === 'pyramid')   handlePyramidClick(x, y);
    else if (state.currentScene === 'combat')    handleCombatAreaClick(x, y);
    else if (state.currentScene === 'trap')      handleTrapAreaClick(x, y);
    else if (state.currentScene === 'shop')      handleShopAreaClick(x, y);
    else if (state.currentScene === 'event')     handleEventAreaClick(x, y);
    else if (state.currentScene === 'camp')      handleCampAreaClick(x, y);
    else if (state.currentScene === 'treasure')  handleTreasureAreaClick(x, y);
    else if (state.currentScene === 'equipment') handleEquipmentAreaClick(x, y);
    else if (state.currentScene === 'gameOver')  handleGameOverAreaClick(x, y);
    else if (state.currentScene === 'victory')   handleVictoryAreaClick(x, y);
    else if (state.currentScene === 'meta')      handleMetaAreaClick(x, y);
    else if (state.currentScene === 'relicPick') handleRelicPickAreaClick(x, y);
}

// ─── Main menu scene ───────────────────────────────────────────────────────────

// Handle a click on the main menu
function handleMainMenuAreaClick(x, y) {
    const result = handleMainMenuClick(x, y);
    if (result === 'continue') {
        resumeSavedRun();
    } else if (result === 'newRun') {
        startFreshRun();
    }
}

// Load an existing run save and drop the player back into the pyramid
function resumeSavedRun() {
    const runSave = loadRunSave();
    if (!runSave) return;
    applyRunSave(runSave);  // restores state.party and state.player

    // Assign act relics if this save predates the relic-shop feature
    if (!state.actRelicA && !state.actRelicB) assignActRelics();

    // Re-apply permanent bonuses then clamp resources to saved mid-run values
    const savedParty = runSave.party || (runSave.player ? [runSave.player] : []);
    for (let i = 0; i < state.party.length; i++) {
        const saved = savedParty[i];
        applyPermanentBonus(state.party[i]);
        if (saved) restoreResourcesAfterBonus(state.party[i], saved.currentHP, saved.currentMana);
    }

    state.currentScene = 'pyramid';
}

// ─── Run start scene ───────────────────────────────────────────────────────────

// Handle a click on the character select screen
function handleRunStartAreaClick(x, y) {
    // resolveClassClick returns true when the party is confirmed and ready to start
    const ready = handleRunStartClick(x, y);
    if (ready) {
        // Apply permanent stat bonuses to every member of the starting party
        for (const member of state.party) {
            applyPermanentBonus(member);
        }
        // Grant free starting items from the general upgrade
        const lootCount = getStartingLootCount();
        for (let i = 0; i < lootCount; i++) {
            state.inventory.push(rollLoot());
        }
        state.currentRoom.visited = true;
        const relicTier = getStartingRelicTier();
        if (relicTier >= 1) {
            initRelicPick();
            state.currentScene = 'relicPick';
        } else {
            state.currentScene = 'pyramid';
            saveRunProgress();
        }
    }
}

// ─── Pyramid scene ─────────────────────────────────────────────────────────────

// Handle a click while the pyramid map is showing
function handlePyramidClick(x, y) {
    if (state.roomMessage) {
        state.roomMessage = '';
        saveRunProgress();
        return;
    }

    // GEAR button opens equipment management
    if (state.player && isGearButtonClick(x, y)) {
        state.currentScene = 'equipment';
        return;
    }

    const allRooms    = getAllRoomsFlat(state.pyramid);
    const clickedRoom = findClickedRoom(x, y, allRooms);

    if (!clickedRoom) return;
    if (!isRoomInList(clickedRoom, state.adjacentRooms)) return;

    state.currentRoom   = clickedRoom;
    state.adjacentRooms = getAdjacentRooms(state.pyramid, state.currentRoom);
    ensureNextLayerGenerated(state.pyramid, state.currentRoom.layer);

    // Revisited rooms can be traversed but don't trigger their event again
    if (clickedRoom.visited) {
        saveRunProgress();
        return;
    }

    enterRoom(state.currentRoom);
}

// ─── Room routing ──────────────────────────────────────────────────────────────

// Threshold of visited rooms before the pyramid's wrath activates
const PYRAMID_WRATH_THRESHOLD = 30;

// Check whether the player has angered the pyramid; trigger effects once if so
function checkPyramidWrath() {
    if (state.pyramidWrathActive) return;
    const visited = getAllRoomsFlat(state.pyramid).filter(r => r.visited).length;
    if (visited < PYRAMID_WRATH_THRESHOLD) return;

    state.pyramidWrathActive = true;

    // Deal 10 damage to every living party member
    for (const member of state.party) {
        if (member.isAlive()) member.currentHP = Math.max(1, member.currentHP - 10);
    }

    // Queue the message — picked up by returnToPyramid so it isn't overwritten by the room event
    state.wrathMessage =
        'The pyramid senses your presence — it is not happy. It rumbles under your feet! '
        + '(-10 HP to all. Traps surge. Treasures dwindle. The boss strikes first.)';
}

// Dispatch to the correct handler based on room type
function enterRoom(room) {
    if (room.type !== 'camp') room.visited = true;
    checkPyramidWrath();
    state.adjacentRooms = getAdjacentRooms(state.pyramid, state.currentRoom);

    switch (room.type) {
        case 'combat':   startCombat('normal', false); break;
        case 'elite':    startCombat('elite',  false); break;
        case 'ambush':   startCombat('normal', true);  break;
        case 'boss':     startCombat('boss',   false); break;
        case 'treasure': doTreasure();                 break;
        case 'rest':     doRest();                     break;
        case 'trap':     initTrap();                   break;
        case 'warp':     doWarp();                     break;
        case 'shop':     stockShop(); state.currentScene = 'shop'; break;
        case 'event':    startEvent();                 break;
        case 'camp':     state.currentScene = 'camp';  break;
        default:         startCombat('normal', false); break;
    }
}

// ─── Combat scene ──────────────────────────────────────────────────────────────

// Initialise a combat encounter for the given room type
// roomType: 'normal' | 'elite' | 'boss' — used to pick the enemy group and set isBoss
function startCombat(roomType, ambush) {
    let enemies;

    if (state.actNumber === 1 && (roomType === 'normal' || roomType === 'ambush')) {
        // Act 1 normal combat: use the curated composition queue
        if (state.act1CompositionsRemaining.length > 0) {
            const compKey = state.act1CompositionsRemaining.shift();
            enemies = loadComposition(compKey, state.actNumber);
            state.lastCompositionKey = compKey;  // stored here; copied to combat below after initCombat
        } else {
            // Queue exhausted — fall back to random Act 1 enemies
            enemies = pickAct1RandomEnemies();
        }
    } else {
        // Elites, bosses, and Acts 2–3: existing random selection
        const keys = pickEnemyGroup(roomType, state.actNumber);
        enemies    = createEnemyGroup(keys, state.actNumber);
    }

    state.combat                 = initCombat(state.party, enemies);
    state.combat.combatType      = roomType;
    state.combat.isBoss          = (roomType === 'boss');
    state.combat.compositionKey  = state.lastCompositionKey || null;  // which named encounter this is
    state.lastCompositionKey     = null;  // clear temp storage
    resetCombatUIState();

    // Show intro flavour text for boss fights
    if (state.combat.isBoss) {
        for (const enemy of enemies) {
            if (enemy.intro) { addToLog(state.combat, enemy.intro); break; }
        }
    }

    // Ambush: find the first enemy slot in the sorted queue and let them go first
    if (ambush) {
        addToLog(state.combat, 'AMBUSH! Enemies strike first!');
        const firstEnemyIdx = state.combat.queue.findIndex(slot => !slot.isPlayer);
        if (firstEnemyIdx >= 0) {
            state.combat.turnIndex = firstEnemyIdx;
            state.combat.phase     = 'enemy_turn';
        }
    }

    // Wrath: boss strikes before all party members regardless of speed
    if (state.pyramidWrathActive && roomType === 'boss') {
        addToLog(state.combat, 'The pyramid\'s fury empowers the boss — it strikes first!');
        const firstEnemyIdx = state.combat.queue.findIndex(slot => !slot.isPlayer);
        if (firstEnemyIdx >= 0) {
            state.combat.turnIndex = firstEnemyIdx;
            state.combat.phase     = 'enemy_turn';
        }
    }

    if (state.combat.phase === 'enemy_turn') scheduleEnemyTurn(state.combat);

    if (state.combat.phase === 'defeat') handleDefeat();
    else state.currentScene = 'combat';
}

// Handle a click on the combat screen
function handleCombatAreaClick(x, y) {
    const outcome = handleCombatClick(x, y, state.combat);
    if (outcome === 'victory') {
        awardCombatShards(state.combat.combatType, 1);
        awardCombatGold(state.combat);

        // heal_on_victory passive: restore 10 HP after each combat win
        if (hasPassive(state.player, 'heal_on_victory')) {
            const healed = Math.min(10, state.player.getMaxHP() - state.player.currentHP);
            state.player.currentHP += healed;
        }

        if (state.combat.isBoss) {
            handleBossVictory();
        } else {
            const item = awardLoot();
            returnToPyramid();
            state.roomMessage = 'Victory!  Found: ' + item.name
                + '  \u2014  ' + rarityLabel(item.rarity);
        }
    } else if (outcome === 'defeat') {
        handleDefeat();
    }
}

// Clear combat and return to the pyramid map
function returnToPyramid() {
    state.combat       = null;
    state.currentScene = 'pyramid';
    // Show the wrath message after any scene (combat, shop, event, etc.)
    if (state.wrathMessage) {
        state.roomMessage  = state.wrathMessage;
        state.wrathMessage = '';
    }
    saveRunProgress();
}

// Player won the boss — advance act or end the run
function handleBossVictory() {
    state.combat = null;
    if (state.actNumber < 3) {
        startNextAct();
    } else {
        clearRunSave();
        state.currentScene = 'victory';
    }
}

// Increment the act counter, generate a fresh pyramid, and show a transition message
function startNextAct() {
    state.actNumber++;
    assignActRelics();

    state.pyramidWrathActive = false;
    state.pyramid = generatePyramid(PYRAMID_LAYERS);
    const bottomLayer = state.pyramid[PYRAMID_LAYERS - 1];
    const middleIndex = Math.floor(bottomLayer.length / 2);
    state.currentRoom = bottomLayer[middleIndex];
    state.currentRoom.visited = true;
    state.adjacentRooms = getAdjacentRooms(state.pyramid, state.currentRoom);

    saveRunProgress();

    const messages = {
        2: 'ACT II — The pyramid grows darker.  Enemies are 50% stronger.',
        3: 'ACT III — The apex awaits.  All enemies are twice as dangerous.',
    };
    state.roomMessage  = messages[state.actNumber];
    state.currentScene = 'pyramid';
}

// Player was defeated — clear run save, show game over
function handleDefeat() {
    clearRunSave();
    state.currentScene = 'gameOver';
}

// ─── Instant room handlers ─────────────────────────────────────────────────────

// Treasure: resolve rewards and switch to the treasure result screen
function doTreasure() {
    resolveTreasureRoom();
}

// Rest: heal 30% of max HP
function doRest() {
    const heal = Math.floor(state.player.getMaxHP() * 0.3);
    state.player.currentHP = Math.min(state.player.getMaxHP(), state.player.currentHP + heal);
    state.roomMessage = 'You rest and recover ' + heal + ' HP.  ('
        + state.player.currentHP + ' / ' + state.player.getMaxHP() + ')';
    if (state.wrathMessage) { state.roomMessage += '  |  ' + state.wrathMessage; state.wrathMessage = ''; }
}

// Trap: delegate to the full interactive trap system in trapUI.js
function handleTrapAreaClick(x, y) {
    const result = handleTrapClick(x, y);
    if      (result === 'done')   returnToPyramid();
    else if (result === 'defeat') handleDefeat();
}

// Warp: teleport to a random room one layer up
function doWarp() {
    const targetLayer = state.currentRoom.layer - 1;
    // Never warp to layer 1 (boss) — that would bypass camp and leave the player stuck
    if (targetLayer < 2) {
        state.roomMessage = 'The warp fizzles — the apex cannot be reached this way.';
        return;
    }
    const layerRooms = state.pyramid[targetLayer - 1];
    const randRoom   = layerRooms[Math.floor(Math.random() * layerRooms.length)];
    state.currentRoom   = randRoom;
    state.adjacentRooms = getAdjacentRooms(state.pyramid, state.currentRoom);
    ensureNextLayerGenerated(state.pyramid, state.currentRoom.layer);
    state.roomMessage = 'You are warped to a distant chamber!';
    if (state.wrathMessage) { state.roomMessage += '  |  ' + state.wrathMessage; state.wrathMessage = ''; }
}

// ─── Other scene handlers ──────────────────────────────────────────────────────

function handleEquipmentAreaClick(x, y) {
    if (handleEquipmentClick(x, y) === 'back') state.currentScene = 'pyramid';
}

function handleShopAreaClick(x, y)  { if (handleShopClick(x, y))  returnToPyramid(); }
function handleEventAreaClick(x, y) {
    const result = handleEventClick(x, y);
    if (result === 'recruit') {
        recruitHero();
        state.currentEvent = null;
        returnToPyramid();
    } else if (result === 'leave') {
        clearDiceRoll();
        state.currentEvent = null;
        returnToPyramid();
    }
}
function handleCampAreaClick(x, y)  { if (handleCampClick(x, y))  returnToPyramid(); }

function handleTreasureAreaClick(x, y) {
    if (handleTreasureClick(x, y)) returnToPyramid();
}

function handleVictoryAreaClick(x, y) {
    if (handleVictoryClick(x, y)) state.currentScene = 'meta';
}

function handleGameOverAreaClick(x, y) {
    if (handleGameOverClick(x, y)) state.currentScene = 'meta';
}

function handleMetaAreaClick(x, y) {
    if (handleMetaClick(x, y) === 'newRun') {
        startFreshRun();
    }
}

function handleRelicPickAreaClick(x, y) {
    if (handleRelicPickClick(x, y)) {
        state.currentScene = 'pyramid';
        saveRunProgress();
    }
}

// ─── Pause menu actions ────────────────────────────────────────────────────────

// Return to main menu without touching saves
function goToMainMenu() {
    state.paused = false;
    state.currentScene = 'mainMenu';
}

// Clear the run save and return to main menu
function resetRun() {
    state.paused             = false;
    state.party              = [];
    state.player             = null;
    state.combat             = null;
    state.roomMessage        = '';
    state.soulShardsThisRun  = 0;
    state.gold               = 0;
    state.currentEvent       = null;
    state.activeRelics       = [];
    state.partyPotions       = [];
    state.pyramidWrathActive = false;
    state.wrathMessage       = '';
    state.actShopCount       = 0;
    state.actRelicA          = null;
    state.actRelicB          = null;
    clearRunSave();
    state.currentScene  = 'mainMenu';
}

// Wipe both saves and return to main menu
function fullReset() {
    state.paused             = false;
    state.party              = [];
    state.player             = null;
    state.combat             = null;
    state.roomMessage        = '';
    state.soulShardsThisRun  = 0;
    state.gold               = 0;
    state.currentEvent       = null;
    state.activeRelics       = [];
    state.partyPotions       = [];
    state.pyramidWrathActive = false;
    state.wrathMessage       = '';
    state.actShopCount       = 0;
    state.actRelicA          = null;
    state.actRelicB          = null;
    clearRunSave();
    state.meta = defaultMeta();
    saveMetaProgress(state.meta);
    state.currentScene  = 'mainMenu';
}

// ─── Run helpers ───────────────────────────────────────────────────────────────

// Award gold for the enemies defeated in combat — 10 / 15 / 20 per enemy by room type
// Veil of Greed relic reduces all gold rewards by 40%
function awardCombatGold(combat) {
    const rates = { normal: 10, elite: 15, boss: 20 };
    const rate  = rates[combat.combatType] || 10;
    let gold = rate * combat.enemies.length;
    if (hasRelic('veil_of_greed')) gold = Math.floor(gold * 0.6);
    state.gold += gold;
}

// ─── Event system ──────────────────────────────────────────────────────────────

// Generate event data and switch to the event scene
// Event selection and creation handled in eventUI.js via pickAndCreateEvent()
function startEvent() {
    state.currentEvent = pickAndCreateEvent();
    state.currentScene = 'event';
}

// Recruit the hero from the current event — deduct gold, add to party, discover class
function recruitHero() {
    const ev = state.currentEvent;
    if (!ev || ev.type !== 'heroEncounter') return;

    state.gold -= 50;

    // Discover the class if new — award 25 bonus Soul Shards
    const isNew = discoverClass(ev.classKey);
    if (isNew) {
        state.meta.soulShards   += 25;
        state.soulShardsThisRun += 25;
        saveMetaProgress(state.meta);
    }

    // Create the character, apply permanent bonuses, add to party
    const hero = CLASS_FACTORIES[ev.classKey]();
    applyPermanentBonus(hero);
    state.party.push(hero);
    if (!state.player) state.player = state.party[0];

    // Feedback shown as pyramid overlay when returning to map
    state.roomMessage = ev.heroName + ' joins your party!'
        + (isNew ? '  \u2605 NEW CLASS  +25 Soul Shards' : '');
}

// Set up a brand-new pyramid and send the player to character select
function startFreshRun() {
    // Carry over a portion of gold from the finished run before resetting
    const carriedGold = Math.floor(state.gold * getGoldCarryRate());

    state.party              = [];
    state.player             = null;
    state.combat             = null;
    state.roomMessage        = '';
    state.soulShardsThisRun  = 0;
    state.gold               = carriedGold;
    state.currentEvent       = null;
    state.inventory          = [];
    state.activeRelics       = [];
    state.partyPotions       = [];
    state.pyramidWrathActive = false;
    state.wrathMessage       = '';

    state.pyramid = generatePyramid(PYRAMID_LAYERS);
    const bottomLayer = state.pyramid[PYRAMID_LAYERS - 1];
    const middleIndex = Math.floor(bottomLayer.length / 2);
    state.currentRoom   = bottomLayer[middleIndex];
    state.adjacentRooms = getAdjacentRooms(state.pyramid, state.currentRoom);
    state.actNumber     = 1;
    assignActRelics();
    buildCompositionQueue();   // shuffle Act 1 encounter order for this run

    state.currentScene  = 'runStart';
}

// ─── Game loop ─────────────────────────────────────────────────────────────────

// Draw the current scene, then the corner button, then the pause overlay if open
function gameLoop() {
    clearCanvas();

    if      (state.currentScene === 'mainMenu')  drawMainMenuScreen();
    else if (state.currentScene === 'runStart')  drawRunStartScreen();
    else if (state.currentScene === 'pyramid') {
        drawPyramid(state.pyramid, state.currentRoom, state.adjacentRooms);
        drawActBadge(state.actNumber);
        drawRelicStrip();
        if (state.roomMessage) drawRoomMessage(state.roomMessage);
        if (state.player) drawGearButton();
    }
    else if (state.currentScene === 'equipment') drawEquipmentScreen();
    else if (state.currentScene === 'combat') {
        // Execute pending enemy turn once the delay has elapsed
        if (state.combat && state.combat.pendingEnemyTurn && performance.now() >= state.combat.enemyTurnTime) {
            state.combat.pendingEnemyTurn = false;
            executeEnemyTurn(state.combat);
            if (state.combat.phase === 'defeat') { handleDefeat(); }
        }
        // Auto-fire a charge-up tick when the delay has elapsed
        if (state.combat && state.combat.pendingChargeTick && performance.now() >= state.combat.chargeTickTime) {
            state.combat.pendingChargeTick = false;
            executeChargeUpTick(state.combat);
            if (state.combat.phase === 'defeat') { handleDefeat(); }
        }
        if (state.currentScene === 'combat') drawCombatScreen(state.combat);
    }
    else if (state.currentScene === 'treasure')  drawTreasureScreen();
    else if (state.currentScene === 'trap')       drawTrapScreen();
    else if (state.currentScene === 'shop')      drawShopScreen();
    else if (state.currentScene === 'event')     drawEventScreen();
    else if (state.currentScene === 'camp')      drawCampScreen();
    else if (state.currentScene === 'gameOver')  drawGameOverScreen();
    else if (state.currentScene === 'victory')   drawVictoryScreen();
    else if (state.currentScene === 'meta')      drawMetaScreen();
    else if (state.currentScene === 'relicPick') drawRelicPickScreen();

    // Corner button sits on top of every scene except main menu
    if (state.currentScene !== 'mainMenu') drawMenuButton();

    // Pause overlay is drawn last so it covers everything
    if (state.paused) drawPauseOverlay();

    requestAnimationFrame(gameLoop);
}

// ─── Start ─────────────────────────────────────────────────────────────────────

init();
gameLoop();
