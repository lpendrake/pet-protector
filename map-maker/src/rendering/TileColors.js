export const TILE_COLORS = {
    'empty': 0x222222,
    'grass_v1': 0x3a5a40,
    'forest_v1': 0x344e41,
    'dirt_path': 0xa68a64,
    'water_shallow': 0x0077b6,
    'water_deep': 0x023e8a,
    'rock_v1': 0x4a4e69,
    'cave_v1': 0x22223b,
    'ruins_v1': 0x495057
};

export const LAYER_COLORS = {
    'decoration': 0xffd166,
    'pickup': 0xef476f,
    'zone': 0x06d6a0,
    'warp': 0x118ab2
};

export function getTileColor(id) {
    return TILE_COLORS[id] || TILE_COLORS['empty'];
}

export function getLayerColor(layer) {
    return LAYER_COLORS[layer] || 0xffffff;
}
