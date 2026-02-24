/// AI Tools - Utility functions and helpers for AI decision making
/// Based on freeciv/freeciv/ai/default/aitools.c

use crate::state::{GameState, City, Unit};

/// Calculate distance between two tiles
/// Uses Manhattan distance as approximation (like C AI)
pub fn tile_distance(tile1: i32, tile2: i32) -> i32 {
    // Simple Manhattan distance approximation
    // In C AI this uses proper map coordinates with wrapping
    (tile1 - tile2).abs()
}

/// Calculate amortized value (from C AI's amortize function)
/// Discounts future value by time to achieve it
/// Based on freeciv/ai/default/aitools.c military_amortize()
pub fn amortize(value: i32, delay: i32) -> i32 {
    if value <= 0 || delay < 0 {
        return 0;
    }
    
    // Discount future value by delay
    // Formula: value * turns / (turns + delay)
    // This makes immediate gains more valuable than distant ones
    let turns = 40; // Average game length factor
    (value * turns) / (turns + delay)
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
/// Based on C AI's dai_assess_danger() logic
pub fn city_threatened(state: &GameState, city: &City) -> bool {
    let our_strength = military_strength_at_tile(state, city.tile, city.owner);
    
    // Check for enemy units nearby (within 3 tiles like C AI)
    let enemy_strength: i32 = state.units
        .values()
        .filter(|u| u.owner != city.owner && tile_distance(u.tile, city.tile) < 3)
        .map(|u| calculate_unit_strength(u))
        .sum();
    
    // City is threatened if enemy strength is significantly higher
    // C AI uses complex danger assessment, this is simplified
    enemy_strength > our_strength * 2
}

/// Assess danger level for a city (0-100 scale)
/// Based on C AI's danger assessment
pub fn assess_city_danger(state: &GameState, city: &City) -> i32 {
    let our_strength = military_strength_at_tile(state, city.tile, city.owner);
    
    if our_strength == 0 {
        return 100; // Maximum danger if undefended
    }
    
    let enemy_strength: i32 = state.units
        .values()
        .filter(|u| u.owner != city.owner && tile_distance(u.tile, city.tile) < 5)
        .map(|u| {
            let str = calculate_unit_strength(u);
            let dist = tile_distance(u.tile, city.tile);
            // Discount by distance - closer threats are more dangerous
            str / (dist + 1)
        })
        .sum();
    
    // Return danger level 0-100
    let danger = (enemy_strength * 100) / (our_strength + 1);
    danger.min(100)
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
            let danger = assess_city_danger(state, city);
            println!("  - {} (size {}, tile {}, danger: {})", 
                city.name, city.size, city.tile, danger);
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

/// Evaluate tile for city placement
/// Based on C AI's city_desirability() algorithm from daisettler.c
pub fn evaluate_city_tile(state: &GameState, tile: i32) -> i32 {
    // Simple tile evaluation - C AI has much more sophisticated algorithm
    // Factors to consider (from C AI):
    // 1. Food/shield/trade output of tile and surrounding tiles
    // 2. Distance from other cities (citymindist)
    // 3. Terrain defense bonus
    // 4. Proximity to water (naval emphasis)
    // 5. Reservation status (other settlers targeting nearby)
    // 6. Danger at location
    
    let mut value = 100; // Base value
    
    // Check if too close to existing cities
    if let Some(player_id) = state.our_player_id {
        for city in state.cities.values() {
            if city.owner == player_id {
                let dist = tile_distance(city.tile, tile);
                if dist < 3 {
                    return 0; // Too close to existing city (citymindist)
                }
                // Penalty for being close to other cities
                if dist < 5 {
                    value -= (5 - dist) * 20;
                }
            }
        }
    }
    
    // Bonus for being further from existing cities (expansion)
    // But not too far (communication costs)
    if let Some(dist) = find_nearest_city_distance_to_tile(state, tile) {
        if dist > 3.0 && dist < 10.0 {
            value += 20; // Good expansion distance
        }
    } else {
        value += 50; // First city bonus
    }
    
    value.max(0)
}

/// Find distance from tile to nearest friendly city
fn find_nearest_city_distance_to_tile(state: &GameState, tile: i32) -> Option<f32> {
    if let Some(player_id) = state.our_player_id {
        state.cities.values()
            .filter(|c| c.owner == player_id)
            .map(|c| ((c.tile - tile).abs()) as f32)
            .min_by(|a, b| a.partial_cmp(b).unwrap())
    } else {
        None
    }
}
