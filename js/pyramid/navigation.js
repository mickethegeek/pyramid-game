// Navigation and adjacency rules for pyramid rooms

// Get all adjacent rooms that the player can move to from current room
function getAdjacentRooms(pyramid, currentRoom) {
    const adjacent = [];
    const layer = currentRoom.layer;
    const index = currentRoom.index;
    const orientation = currentRoom.orientation;
    const roomCount = (2 * layer) - 1;

    // Horizontal neighbors (same layer) - always available
    // Left neighbor
    if (index > 0) {
        adjacent.push(getRoom(pyramid, layer, index - 1));
    }

    // Right neighbor
    if (index < roomCount - 1) {
        adjacent.push(getRoom(pyramid, layer, index + 1));
    }

    // Vertical movement: only downward triangles (▽) can climb UP
    if (orientation === 'down' && layer > 1) {
        // Downward triangle at layer L, index i connects to upward triangle at layer L-1, index i-1
        // This works because layers are centered and each layer has 2 more triangles than the one above
        const targetIndex = index - 1;
        const targetRoom = getRoom(pyramid, layer - 1, targetIndex);

        // Verify it's an upward triangle and exists
        if (targetRoom && targetRoom.orientation === 'up') {
            adjacent.push(targetRoom);
        }
    }

    // Remove nulls — visited rooms remain navigable so the player can backtrack
    return adjacent.filter(room => room !== null);
}

// Helper function to get a room from pyramid
function getRoom(pyramid, layer, index) {
    if (layer < 1 || layer > pyramid.length) return null;
    const layerRooms = pyramid[layer - 1];
    if (index < 0 || index >= layerRooms.length) return null;
    return layerRooms[index];
}

// Check if two rooms are adjacent
function areRoomsAdjacent(pyramid, room1, room2) {
    const adjacent = getAdjacentRooms(pyramid, room1);
    return adjacent.some(room =>
        room.layer === room2.layer && room.index === room2.index
    );
}
