// Pyramid data structure and lazy room-type generation

// Single source of truth for pyramid depth — change here to affect everything
const PYRAMID_LAYERS = 15;

// Generate a pyramid with the specified number of layers.
// All room structures (position, orientation) are created upfront so the
// visual pyramid is always fully drawn. Room TYPES are assigned lazily —
// only the bottom layer and the one above it are typed on creation.
function generatePyramid(numLayers) {
    const pyramid = [];

    // Build the full structure for every layer
    for (let layer = 1; layer <= numLayers; layer++) {
        const roomCount = (2 * layer) - 1;
        const layerRooms = [];
        for (let index = 0; index < roomCount; index++) {
            layerRooms.push(createRoom(layer, index, numLayers));
        }
        pyramid.push(layerRooms);
    }

    // Assign types to the bottom layer (where the player starts) and the
    // layer directly above it so they can see what's coming on their first move.
    generateLayerTypes(pyramid, numLayers);
    if (numLayers > 1) generateLayerTypes(pyramid, numLayers - 1);

    return pyramid;
}

// Calculate the triangle edge length that fits the pyramid on the canvas.
// Scales down automatically as layer count increases.
function calcTriangleSize(totalLayers) {
    const canvasWidth  = 1200;
    const canvasHeight = 640;
    const marginX = 20;  // pixels to leave on each side horizontally
    const marginY = 40;  // pixels to leave on each side vertically

    const usableH = canvasHeight - marginY * 2;
    const usableW = canvasWidth  - marginX * 2;

    // Height constraint: totalLayers × (size × √3/2) ≤ usableH
    const sizeByHeight = usableH / (totalLayers * Math.sqrt(3) / 2);

    // Width constraint: bottom layer has (2×totalLayers − 1) rooms,
    // each occupying size/2 pixels horizontally
    const sizeByWidth = (usableW * 2) / (2 * totalLayers - 1);

    return Math.floor(Math.min(sizeByHeight, sizeByWidth));
}

// Create a single room with position, orientation, and a null type.
// Type is assigned later by generateLayerTypes — null means "undiscovered".
function createRoom(layer, index, totalLayers) {
    const orientation    = (index % 2 === 0) ? 'up' : 'down';
    const triangleSize   = calcTriangleSize(totalLayers);
    const triangleHeight = triangleSize * Math.sqrt(3) / 2;

    const canvasWidth  = 1200;
    const canvasHeight = 640;

    const roomCount   = (2 * layer) - 1;
    const layerWidth  = roomCount * (triangleSize / 2);
    const layerStartX = (canvasWidth - layerWidth) / 2;
    const x           = layerStartX + (index * triangleSize / 2);

    const pyramidHeight = totalLayers * triangleHeight;
    const pyramidStartY = (canvasHeight - pyramidHeight) / 2;
    const y             = pyramidStartY + (layer - 1) * triangleHeight;

    return {
        layer,
        index,
        orientation,
        x,
        y,
        size: triangleSize,
        type:    null,   // null = undiscovered; assigned lazily by generateLayerTypes
        visited: false,  // true once the player has entered this room
    };
}

// Assign room types to every untyped room in the given layer.
// Safe to call multiple times — rooms that already have a type are skipped.
// Layer 1 is always the boss (apex). All other layers use weighted random picks.
function generateLayerTypes(pyramid, layerNum) {
    const layer = pyramid[layerNum - 1];
    if (!layer) return;

    for (let i = 0; i < layer.length; i++) {
        const room = layer[i];
        if (room.type !== null) continue;   // already assigned — skip

        // Layer 1 apex = boss. Layer 2 index 1 = camp (the gateway room before the boss).
        // All other rooms are randomly assigned.
        if (layerNum === 1) {
            room.type = 'boss';
        } else if (layerNum === 2 && i === 1) {
            room.type = 'camp';
        } else {
            room.type = pickRoomType();
        }
    }
}

// Generate the layer above the player's current position if it hasn't been typed yet.
// Call this every time the player enters a new room.
function ensureNextLayerGenerated(pyramid, currentLayerNum) {
    const nextLayerNum = currentLayerNum - 1;  // layer 1 is the apex
    if (nextLayerNum < 1) return;              // already at the apex — nothing above
    generateLayerTypes(pyramid, nextLayerNum);
}

// Get a specific room from the pyramid by layer number and index
function getRoom(pyramid, layer, index) {
    if (layer < 1 || layer > pyramid.length) return null;
    const layerRooms = pyramid[layer - 1];
    if (index < 0 || index >= layerRooms.length) return null;
    return layerRooms[index];
}

// Get all rooms in the pyramid as a flat array
function getAllRooms(pyramid) {
    const rooms = [];
    for (const layer of pyramid) {
        for (const room of layer) {
            rooms.push(room);
        }
    }
    return rooms;
}
