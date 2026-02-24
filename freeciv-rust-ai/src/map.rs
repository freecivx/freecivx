/// Map representation for the AI
/// Based on freeciv/freeciv/common/map.h and AI map data structures
/// 
/// This module provides the AI's internal representation of the game map,
/// including tiles, terrain, visibility, and strategic information.

use std::collections::HashMap;

/// Map dimensions and topology
#[derive(Debug, Clone)]
pub struct MapInfo {
    /// Map width in tiles
    pub width: i32,
    /// Map height in tiles
    pub height: i32,
    /// Topology flags (rectangular, hex, iso-hex, etc.)
    pub topology: u8,
    /// Wrap flags (wrap in X, wrap in Y)
    pub wrap: u8,
}

impl MapInfo {
    pub fn new() -> Self {
        Self {
            width: 80,
            height: 50,
            topology: 0,
            wrap: 0,
        }
    }
    
    /// Calculate tile index from coordinates
    pub fn tile_index(&self, x: i32, y: i32) -> i32 {
        y * self.width + x
    }
    
    /// Calculate coordinates from tile index
    pub fn tile_coords(&self, tile: i32) -> (i32, i32) {
        let x = tile % self.width;
        let y = tile / self.width;
        (x, y)
    }
    
    /// Calculate distance between two tiles (simple Manhattan distance)
    /// TODO: Implement proper map distance considering topology
    pub fn distance(&self, tile1: i32, tile2: i32) -> i32 {
        let (x1, y1) = self.tile_coords(tile1);
        let (x2, y2) = self.tile_coords(tile2);
        (x1 - x2).abs() + (y1 - y2).abs()
    }
}

impl Default for MapInfo {
    fn default() -> Self {
        Self::new()
    }
}

/// Tile information
#[derive(Debug, Clone)]
pub struct Tile {
    /// Tile index/ID
    pub index: i32,
    /// Terrain type
    pub terrain: u8,
    /// Special resources on this tile
    pub resource: Option<u8>,
    /// Extras (roads, irrigation, mines, etc.)
    pub extras: u32,
    /// City ID if there's a city on this tile
    pub city: Option<u16>,
    /// Units on this tile (list of unit IDs)
    pub units: Vec<u16>,
    /// Known/seen status by our player
    pub known: TileKnown,
    /// Continent/ocean ID
    pub continent: i16,
}

impl Tile {
    pub fn new(index: i32) -> Self {
        Self {
            index,
            terrain: 0,
            resource: None,
            extras: 0,
            city: None,
            units: Vec::new(),
            known: TileKnown::Unknown,
            continent: 0,
        }
    }
    
    /// Check if tile has a specific extra (road, irrigation, etc.)
    pub fn has_extra(&self, extra_bit: u32) -> bool {
        (self.extras & (1 << extra_bit)) != 0
    }
    
    /// Add an extra to this tile
    pub fn add_extra(&mut self, extra_bit: u32) {
        self.extras |= 1 << extra_bit;
    }
    
    /// Remove an extra from this tile
    pub fn remove_extra(&mut self, extra_bit: u32) {
        self.extras &= !(1 << extra_bit);
    }
}

/// Tile knowledge state
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TileKnown {
    /// Tile is completely unknown
    Unknown,
    /// Tile is known but not currently visible
    Known,
    /// Tile is currently visible
    Seen,
}

/// Extra types (roads, irrigation, etc.)
/// These should match the server's extra definitions
#[allow(dead_code)]
pub mod extras {
    pub const ROAD: u32 = 0;
    pub const RAILROAD: u32 = 1;
    pub const IRRIGATION: u32 = 2;
    pub const MINE: u32 = 3;
    pub const POLLUTION: u32 = 4;
    pub const FALLOUT: u32 = 5;
    pub const FORTRESS: u32 = 6;
    pub const AIRBASE: u32 = 7;
}

/// AI-specific tile data
/// This stores AI calculations and strategic information
#[derive(Debug, Clone)]
pub struct AITileData {
    /// Desirability for city placement (0-100)
    pub city_want: i32,
    /// Danger level (military threat)
    pub danger: i32,
    /// Explored status
    pub explored: bool,
    /// Turn when last seen
    pub last_seen: i16,
}

impl AITileData {
    pub fn new() -> Self {
        Self {
            city_want: 0,
            danger: 0,
            explored: false,
            last_seen: -1,
        }
    }
}

impl Default for AITileData {
    fn default() -> Self {
        Self::new()
    }
}

/// The game map
#[derive(Debug)]
pub struct Map {
    /// Map dimensions and topology
    pub info: MapInfo,
    /// All tiles indexed by tile ID
    pub tiles: HashMap<i32, Tile>,
    /// AI-specific tile data
    pub ai_tiles: HashMap<i32, AITileData>,
}

impl Map {
    pub fn new() -> Self {
        Self {
            info: MapInfo::new(),
            tiles: HashMap::new(),
            ai_tiles: HashMap::new(),
        }
    }
    
    /// Update map dimensions
    pub fn set_dimensions(&mut self, width: i32, height: i32, topology: u8) {
        self.info.width = width;
        self.info.height = height;
        self.info.topology = topology;
        println!("[Map] Dimensions set to {}x{}", width, height);
    }
    
    /// Get or create a tile
    pub fn get_tile_mut(&mut self, tile_id: i32) -> &mut Tile {
        self.tiles.entry(tile_id).or_insert_with(|| Tile::new(tile_id))
    }
    
    /// Get a tile (read-only)
    pub fn get_tile(&self, tile_id: i32) -> Option<&Tile> {
        self.tiles.get(&tile_id)
    }
    
    /// Get AI tile data
    pub fn get_ai_tile_mut(&mut self, tile_id: i32) -> &mut AITileData {
        self.ai_tiles.entry(tile_id).or_insert_with(AITileData::new)
    }
    
    /// Get AI tile data (read-only)
    pub fn get_ai_tile(&self, tile_id: i32) -> Option<&AITileData> {
        self.ai_tiles.get(&tile_id)
    }
    
    /// Update tile terrain
    pub fn update_tile_terrain(&mut self, tile_id: i32, terrain: u8) {
        let tile = self.get_tile_mut(tile_id);
        tile.terrain = terrain;
    }
    
    /// Update tile visibility
    pub fn update_tile_visibility(&mut self, tile_id: i32, known: TileKnown) {
        let tile = self.get_tile_mut(tile_id);
        tile.known = known;
    }
    
    /// Add unit to tile
    pub fn add_unit_to_tile(&mut self, tile_id: i32, unit_id: u16) {
        let tile = self.get_tile_mut(tile_id);
        if !tile.units.contains(&unit_id) {
            tile.units.push(unit_id);
        }
    }
    
    /// Remove unit from tile
    pub fn remove_unit_from_tile(&mut self, tile_id: i32, unit_id: u16) {
        if let Some(tile) = self.tiles.get_mut(&tile_id) {
            tile.units.retain(|&id| id != unit_id);
        }
    }
    
    /// Set city on tile
    pub fn set_city_on_tile(&mut self, tile_id: i32, city_id: u16) {
        let tile = self.get_tile_mut(tile_id);
        tile.city = Some(city_id);
    }
    
    /// Remove city from tile
    pub fn remove_city_from_tile(&mut self, tile_id: i32) {
        if let Some(tile) = self.tiles.get_mut(&tile_id) {
            tile.city = None;
        }
    }
    
    /// Calculate distance between two tiles
    pub fn distance(&self, tile1: i32, tile2: i32) -> i32 {
        self.info.distance(tile1, tile2)
    }
    
    /// Get adjacent tiles (4 or 6 depending on topology)
    /// For now, returns 4-way adjacency (North, South, East, West)
    pub fn adjacent_tiles(&self, tile_id: i32) -> Vec<i32> {
        let (x, y) = self.info.tile_coords(tile_id);
        let mut adjacent = Vec::new();
        
        // North
        if y > 0 {
            adjacent.push(self.info.tile_index(x, y - 1));
        }
        // South
        if y < self.info.height - 1 {
            adjacent.push(self.info.tile_index(x, y + 1));
        }
        // West
        if x > 0 {
            adjacent.push(self.info.tile_index(x - 1, y));
        }
        // East
        if x < self.info.width - 1 {
            adjacent.push(self.info.tile_index(x + 1, y));
        }
        
        adjacent
    }
    
    /// Get tiles within a radius
    pub fn tiles_in_radius(&self, center: i32, radius: i32) -> Vec<i32> {
        let mut tiles = Vec::new();
        let (cx, cy) = self.info.tile_coords(center);
        
        for dy in -radius..=radius {
            for dx in -radius..=radius {
                let x = cx + dx;
                let y = cy + dy;
                
                // Check bounds
                if x >= 0 && x < self.info.width && y >= 0 && y < self.info.height {
                    // Check if within radius (Manhattan distance)
                    if dx.abs() + dy.abs() <= radius {
                        tiles.push(self.info.tile_index(x, y));
                    }
                }
            }
        }
        
        tiles
    }
    
    /// Evaluate tile for city placement
    /// Returns a score (higher is better)
    pub fn evaluate_city_tile(&self, tile_id: i32) -> i32 {
        let mut score = 50; // Base score
        
        if let Some(tile) = self.get_tile(tile_id) {
            // Can't build on ocean (terrain 0 is usually ocean)
            if tile.terrain == 0 {
                return 0;
            }
            
            // Already has a city
            if tile.city.is_some() {
                return 0;
            }
            
            // Bonus for resources
            if tile.resource.is_some() {
                score += 20;
            }
            
            // Check nearby tiles for food/production potential
            let nearby = self.tiles_in_radius(tile_id, 2);
            for nearby_tile_id in nearby {
                if let Some(nearby_tile) = self.get_tile(nearby_tile_id) {
                    // Bonus for diverse terrain
                    if nearby_tile.resource.is_some() {
                        score += 5;
                    }
                }
            }
        }
        
        score
    }
}

impl Default for Map {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_map_creation() {
        let map = Map::new();
        assert_eq!(map.info.width, 80);
        assert_eq!(map.info.height, 50);
    }
    
    #[test]
    fn test_tile_coords() {
        let map_info = MapInfo::new();
        let (x, y) = map_info.tile_coords(0);
        assert_eq!(x, 0);
        assert_eq!(y, 0);
        
        let (x, y) = map_info.tile_coords(80);
        assert_eq!(x, 0);
        assert_eq!(y, 1);
    }
    
    #[test]
    fn test_distance() {
        let map_info = MapInfo::new();
        let dist = map_info.distance(0, 10);
        assert_eq!(dist, 10);
    }
    
    #[test]
    fn test_adjacent_tiles() {
        let map = Map::new();
        let adjacent = map.adjacent_tiles(100);
        assert!(!adjacent.is_empty());
    }
}
