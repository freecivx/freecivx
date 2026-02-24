/// AI City Management - Production, growth, and improvements
/// Based on freeciv/freeciv/ai/default/daicity.c

use crate::state::{GameState, City};
use super::aitasks::AIData;

/// Manage all cities for the AI player
/// This includes:
/// - Choosing production (units, buildings, wonders)
/// - Managing city growth
/// - Buying improvements
/// - Selling unnecessary buildings
pub fn manage_cities(state: &mut GameState, _ai_data: &mut AIData) {
    if state.our_player_id.is_none() {
        return;
    }

    println!("[AI Cities] Managing cities");
    
    let cities = state.get_our_cities();
    let city_count = cities.len();
    
    if city_count == 0 {
        println!("[AI Cities] No cities to manage");
        return;
    }
    
    println!("[AI Cities] Processing {} cities", city_count);
    
    // Process each city
    for city in cities {
        manage_city(state, city);
    }
    
    println!("[AI Cities] City management complete");
}

/// Manage a single city
fn manage_city(state: &GameState, city: &City) {
    println!("[AI City] Processing city '{}' (size {})", city.name, city.size);
    
    // Check current production
    if let (Some(kind), Some(value)) = (city.production_kind, city.production_value) {
        println!("[AI City] '{}' is producing: kind={}, value={}", 
            city.name, kind, value);
    } else {
        println!("[AI City] '{}' needs production assignment", city.name);
        choose_production(state, city);
    }
    
    // Manage city workers and specialists
    manage_city_workers(state, city);
    
    // Consider buying production
    consider_buying(state, city);
}

/// Choose what the city should produce
fn choose_production(state: &GameState, city: &City) {
    println!("[AI Production] Choosing production for '{}'", city.name);
    
    // Evaluate priorities:
    // 1. Check if city needs defender
    let needs_defender = check_if_needs_defender(state, city);
    if needs_defender {
        println!("[AI Production] '{}' needs a defender unit", city.name);
        // TODO: Send command to produce defender
        return;
    }
    
    // 2. Check if we need settlers for expansion
    let total_cities = state.get_our_cities().len();
    if total_cities < 3 && city.size >= 4 {
        println!("[AI Production] '{}' should produce a settler for expansion", city.name);
        // TODO: Send command to produce settler
        return;
    }
    
    // 3. Check if we need workers
    let worker_count = count_workers(state);
    if worker_count < total_cities * 2 && city.size >= 3 {
        println!("[AI Production] '{}' should produce a worker", city.name);
        // TODO: Send command to produce worker
        return;
    }
    
    // 4. Produce infrastructure buildings
    if city.size >= 3 {
        println!("[AI Production] '{}' should build infrastructure", city.name);
        // TODO: Choose best building
        return;
    }
    
    // Default: produce military
    println!("[AI Production] '{}' will produce military unit (default)", city.name);
    // TODO: Send command to produce military unit
}

/// Check if a city needs a defender
fn check_if_needs_defender(state: &GameState, city: &City) -> bool {
    // Count military units in or near the city
    let defenders = state.units.values()
        .filter(|u| {
            u.owner == city.owner && 
            ((u.tile - city.tile).abs()) < 2 &&
            is_military_unit(u.unit_type)
        })
        .count();
    
    defenders == 0
}

/// Check if a unit type is military
fn is_military_unit(_unit_type: u16) -> bool {
    // TODO: Implement proper unit type checking
    // For now, assume some unit types are military
    true
}

/// Count worker units
fn count_workers(state: &GameState) -> usize {
    if let Some(player_id) = state.our_player_id {
        state.units.values()
            .filter(|u| {
                u.owner == player_id &&
                is_worker_unit(u.unit_type)
            })
            .count()
    } else {
        0
    }
}

/// Check if a unit type is a worker
fn is_worker_unit(_unit_type: u16) -> bool {
    // TODO: Implement proper unit type checking
    false
}

/// Manage city workers and specialists
fn manage_city_workers(state: &GameState, city: &City) {
    println!("[AI Workers] Managing workers for '{}'", city.name);
    
    // Calculate optimal worker allocation
    let food_priority = calculate_food_priority(state, city);
    let production_priority = calculate_production_priority(state, city);
    let trade_priority = calculate_trade_priority(state, city);
    
    println!("[AI Workers] '{}' priorities - Food: {:.1}, Production: {:.1}, Trade: {:.1}", 
        city.name, food_priority, production_priority, trade_priority);
    
    // TODO: Send commands to assign workers based on priorities
}

/// Calculate food priority for a city
fn calculate_food_priority(_state: &GameState, city: &City) -> f32 {
    // Higher priority for smaller cities that need to grow
    if city.size < 4 {
        10.0
    } else if city.size < 8 {
        5.0
    } else {
        2.0
    }
}

/// Calculate production priority for a city
fn calculate_production_priority(_state: &GameState, city: &City) -> f32 {
    // Higher priority for cities building units or improvements
    if city.production_kind.is_some() {
        8.0
    } else {
        5.0
    }
}

/// Calculate trade priority for a city
fn calculate_trade_priority(_state: &GameState, city: &City) -> f32 {
    // Higher priority for larger cities
    if city.size >= 8 {
        7.0
    } else {
        3.0
    }
}

/// Consider buying current production
fn consider_buying(_state: &GameState, city: &City) {
    // TODO: Implement buy logic
    // - Calculate if buying is worth the cost
    // - Check if we have enough gold
    // - Buy if urgent (e.g., defender needed)
    
    if city.size > 5 {
        println!("[AI Buy] City '{}' could benefit from buying (not implemented)", city.name);
    }
}

/// Sell unnecessary buildings in a city
pub fn sell_buildings(_state: &GameState, city: &City) {
    println!("[AI Sell] Checking for unnecessary buildings in '{}'", city.name);
    
    // TODO: Implement building selling logic
    // - Identify obsolete or redundant buildings
    // - Sell if gold is needed
}
