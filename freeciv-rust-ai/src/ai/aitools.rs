/// AI Tools - Utility functions and helpers for AI decision making
/// Based on freeciv/freeciv/ai/default/aitools.c

use crate::state::{GameState, City, Unit};

/// Calculate distance between two tiles
pub fn tile_distance(tile1: i32, tile2: i32) -> i32 {
    // TODO: Implement proper tile distance calculation
    // This is a placeholder
    (tile1 - tile2).abs()
}

/// Find the nearest city to a tile
pub fn find_nearest_city(state: &GameState, tile: i32, owner: u16) -> Option<&City> {
    state.cities
        .values()
        .filter(|c| c.owner == owner)
        .min_by_key(|c| tile_distance(c.tile, tile))
}

/// Find units at a specific tile
pub fn units_at_tile(state: &GameState, tile: i32) -> Vec<&Unit> {
    state.units
        .values()
        .filter(|u| u.tile == tile)
        .collect()
}

/// Check if a tile has a city
pub fn city_at_tile(state: &GameState, tile: i32) -> Option<&City> {
    state.cities
        .values()
        .find(|c| c.tile == tile)
}

/// Calculate military strength at a tile
pub fn military_strength_at_tile(state: &GameState, tile: i32, owner: u16) -> i32 {
    state.units
        .values()
        .filter(|u| u.tile == tile && u.owner == owner)
        .map(|u| calculate_unit_strength(u))
        .sum()
}

/// Calculate the strength of a unit
pub fn calculate_unit_strength(unit: &Unit) -> i32 {
    // Simple strength calculation based on HP
    // TODO: Consider unit type, veteran level, etc.
    unit.hp as i32
}

/// Check if a city is threatened
pub fn city_threatened(state: &GameState, city: &City) -> bool {
    let our_strength = military_strength_at_tile(state, city.tile, city.owner);
    
    // Check for enemy units nearby
    let enemy_strength: i32 = state.units
        .values()
        .filter(|u| u.owner != city.owner && tile_distance(u.tile, city.tile) < 3)
        .map(|u| calculate_unit_strength(u))
        .sum();
    
    enemy_strength > our_strength * 2
}

/// Check if we can build a specific unit type
pub fn can_build_unit(_state: &GameState, _city: &City, _unit_type: u16) -> bool {
    // TODO: Implement proper tech/resource checking
    true
}

/// Check if we can build a specific building
pub fn can_build_building(_state: &GameState, _city: &City, _building_id: u16) -> bool {
    // TODO: Implement proper tech/resource checking
    true
}

/// Get all friendly units
pub fn get_friendly_units(state: &GameState, owner: u16) -> Vec<&Unit> {
    state.units
        .values()
        .filter(|u| u.owner == owner)
        .collect()
}

/// Get all enemy units (relative to owner)
pub fn get_enemy_units(state: &GameState, owner: u16) -> Vec<&Unit> {
    state.units
        .values()
        .filter(|u| u.owner != owner)
        .collect()
}

/// Calculate total population
pub fn total_population(state: &GameState, owner: u16) -> u32 {
    state.cities
        .values()
        .filter(|c| c.owner == owner)
        .map(|c| c.size as u32)
        .sum()
}

/// Log AI state for debugging
pub fn log_ai_state(state: &GameState) {
    println!("\n=== AI State ===");
    println!("Turn: {}, Year: {}", state.current_turn, state.current_year);
    
    if let Some(player_id) = state.our_player_id {
        println!("Our Player ID: {}", player_id);
        
        let cities = state.get_our_cities();
        let units = state.get_our_units();
        
        println!("Cities: {}", cities.len());
        for city in cities.iter().take(5) {
            println!("  - {} (size {}, tile {})", city.name, city.size, city.tile);
        }
        
        println!("Units: {}", units.len());
        for unit in units.iter().take(5) {
            println!("  - Unit #{} (type {}, tile {}, HP {}/{})", 
                unit.id, unit.unit_type, unit.tile, unit.hp, unit.moves_left);
        }
        
        if let Some(player) = state.players.get(&player_id) {
            println!("Gold: {}", player.gold);
        }
    }
    
    println!("================\n");
}
