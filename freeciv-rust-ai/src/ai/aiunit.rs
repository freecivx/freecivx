/// AI Unit Management - Unit movement, orders, and tactics
/// Based on freeciv/freeciv/ai/default/daiunit.c

use crate::state::{GameState, Unit};
use super::aitasks::{AIData, AIUnitTask};

/// Manage all units for the AI player
/// Based on dai_manage_units() in C AI
/// 
/// This includes:
/// - Setting city defenders first
/// - Moving military units
/// - Managing settlers and workers
/// - Handling explorers
/// - Processing caravans and diplomats
pub fn manage_units(state: &mut GameState, ai_data: &mut AIData) {
    if state.our_player_id.is_none() {
        return;
    }

    println!("[AI Units] Managing units");
    
    let units: Vec<_> = state.get_our_units().iter().map(|u| u.id).collect();
    let unit_count = units.len();
    
    if unit_count == 0 {
        println!("[AI Units] No units to manage");
        return;
    }
    
    println!("[AI Units] Processing {} units", unit_count);
    
    // First pass: Set defenders for cities (like C AI does)
    set_defenders(state, ai_data, &units);
    
    // Second pass: Process remaining units
    for unit_id in units {
        if let Some(done) = ai_data.get_unit_data(unit_id).map(|d| d.done) {
            if done {
                continue; // Skip units already processed
            }
        }
        
        if let Some(unit) = state.units.get(&unit_id) {
            manage_unit(state, ai_data, unit.clone());
        }
    }
    
    println!("[AI Units] Unit management complete");
}

/// Set defenders for all cities (first priority)
/// Based on dai_set_defenders() from C AI
fn set_defenders(state: &GameState, ai_data: &mut AIData, unit_ids: &[u16]) {
    println!("[AI Defenders] Setting city defenders");
    
    let cities: Vec<_> = state.get_our_cities().iter().map(|c| (c.id, c.tile)).collect();
    
    for (city_id, city_tile) in cities {
        // Find a military unit near this city to defend it
        for &unit_id in unit_ids {
            if let Some(unit) = state.units.get(&unit_id) {
                // Check if unit is near city and not yet assigned
                let distance = ((unit.tile - city_tile).abs()) as f32;
                if distance < 3.0 && is_military_unit(unit.unit_type) {
                    if ai_data.get_unit_data(unit_id).map(|d| d.task) == Some(AIUnitTask::None) {
                        ai_data.set_unit_task(unit_id, AIUnitTask::DefendHome, Some(city_tile));
                        ai_data.mark_unit_done(unit_id);
                        println!("[AI Defenders] Unit #{} assigned to defend city #{}", unit_id, city_id);
                        break; // One defender per city for now
                    }
                }
            }
        }
    }
}

/// Manage a single unit
fn manage_unit(state: &GameState, ai_data: &mut AIData, unit: Unit) {
    println!("[AI Unit] Processing unit #{} at tile {}", unit.id, unit.tile);
    
    // Check if unit has moves left
    if unit.moves_left == 0 {
        println!("[AI Unit] Unit #{} has no moves left", unit.id);
        ai_data.mark_unit_done(unit.id);
        return;
    }
    
    // Get current task
    let task = ai_data.get_unit_data(unit.id)
        .map(|d| d.task)
        .unwrap_or(AIUnitTask::None);
    
    // If no task assigned, determine one based on unit type
    let task = if task == AIUnitTask::None {
        classify_unit_role(unit.unit_type)
    } else {
        task
    };
    
    // Execute task
    match task {
        AIUnitTask::BuildCity => manage_settler(state, ai_data, &unit),
        AIUnitTask::AutoSettler => manage_worker(state, ai_data, &unit),
        AIUnitTask::DefendHome => manage_defender(state, ai_data, &unit),
        AIUnitTask::Attack => manage_attacker(state, ai_data, &unit),
        AIUnitTask::Explore => manage_explorer(state, ai_data, &unit),
        AIUnitTask::Recover => manage_recover(state, ai_data, &unit),
        AIUnitTask::Trade => manage_caravan(state, ai_data, &unit),
        _ => manage_other_unit(state, ai_data, &unit),
    }
    
    ai_data.mark_unit_done(unit.id);
}

/// Classify unit type into a default task
fn classify_unit_role(_unit_type: u16) -> AIUnitTask {
    // TODO: Implement proper unit type classification based on unit flags
    // For now, assume military units
    AIUnitTask::Attack
}

/// Check if a unit type is military
fn is_military_unit(_unit_type: u16) -> bool {
    // TODO: Implement proper unit type checking
    true
}

/// Manage settler unit
fn manage_settler(state: &GameState, ai_data: &mut AIData, unit: &Unit) {
    println!("[AI Settler] Unit #{} - evaluating city founding", unit.id);
    
    // Calculate distance to nearest city
    let distance_to_city = find_nearest_city_distance(state, unit.tile);
    
    if let Some(dist) = distance_to_city {
        println!("[AI Settler] Unit #{} is {:.0} tiles from nearest city", unit.id, dist);
        
        if dist > 3.0 {
            println!("[AI Settler] Unit #{} should consider founding a city here", unit.id);
            // TODO: Evaluate tile quality and send build city command
        } else {
            println!("[AI Settler] Unit #{} should move to better location", unit.id);
            // TODO: Move to a better location
        }
    } else {
        println!("[AI Settler] Unit #{} should found first city!", unit.id);
        // TODO: Found the first city
    }
    
    ai_data.set_unit_task(unit.id, AIUnitTask::BuildCity, Some(unit.tile));
}

/// Manage worker unit  
fn manage_worker(_state: &GameState, ai_data: &mut AIData, unit: &Unit) {
    println!("[AI Worker] Unit #{} - worker management not fully implemented", unit.id);
    ai_data.set_unit_task(unit.id, AIUnitTask::AutoSettler, None);
}

/// Manage defender unit
fn manage_defender(_state: &GameState, _ai_data: &mut AIData, unit: &Unit) {
    println!("[AI Defender] Unit #{} holding position", unit.id);
    // Defender stays in place
}

/// Manage attacking military unit
fn manage_attacker(state: &GameState, ai_data: &mut AIData, unit: &Unit) {
    println!("[AI Settler] Unit #{} - evaluating city founding", unit.id);
    
    // Calculate distance to nearest city
    let distance_to_city = find_nearest_city_distance(state, unit.tile);
    
    if let Some(dist) = distance_to_city {
        println!("[AI Settler] Unit #{} is {} tiles from nearest city", unit.id, dist);
        
        if dist > 3.0 {
            println!("[AI Settler] Unit #{} should consider founding a city here", unit.id);
            // TODO: Evaluate tile quality and send build city command
        } else {
            println!("[AI Settler] Unit #{} should move to better location", unit.id);
            // TODO: Move to a better location
        }
    } else {
        println!("[AI Settler] Unit #{} should found first city!", unit.id);
        // TODO: Found the first city
    }
}

/// Find distance to nearest friendly city
fn find_nearest_city_distance(state: &GameState, tile: i32) -> Option<f32> {
    if let Some(player_id) = state.our_player_id {
        state.cities.values()
            .filter(|c| c.owner == player_id)
            .map(|c| ((c.tile - tile).abs()) as f32)
            .min_by(|a, b| a.partial_cmp(b).unwrap())
    } else {
        None
    }
}

/// Manage recovering unit (healing)
fn manage_recover(_state: &GameState, _ai_data: &mut AIData, unit: &Unit) {
    println!("[AI Recover] Unit #{} recovering (HP: {})", unit.id, unit.hp);
    // TODO: Find safe place to heal
    // TODO: Fortify until healed
}

/// Manage caravan/trade unit
fn manage_caravan(_state: &GameState, _ai_data: &mut AIData, unit: &Unit) {
    println!("[AI Trade] Unit #{} - trade route not implemented", unit.id);
}

/// Find enemy units near a tile
fn find_nearby_enemies(state: &GameState, tile: i32) -> Vec<&Unit> {
    state.units.values()
        .filter(|u| {
            // Check if unit belongs to a different player
            if let Some(our_id) = state.our_player_id {
                if u.owner != our_id {
                    // Use map distance if available, otherwise simple distance
                    let distance = state.map.distance(u.tile, tile);
                    return distance < 5;
                }
            }
            false
        })
        .collect()
}

/// Manage explorer unit
fn manage_explorer(state: &GameState, ai_data: &mut AIData, unit: &Unit) {
    println!("[AI Explorer] Unit #{} - exploring from tile {}", unit.id, unit.tile);
    
    ai_data.set_unit_task(unit.id, AIUnitTask::Explore, None);
    
    // Check if unit is near our cities
    if let Some(player_id) = state.our_player_id {
        let near_city = state.cities.values()
            .filter(|c| c.owner == player_id)
            .any(|c| state.map.distance(c.tile, unit.tile) < 3);
        
        if near_city {
            println!("[AI Explorer] Unit #{} is near a city, should move outward", unit.id);
            // TODO: Move away from cities to explore
        } else {
            println!("[AI Explorer] Unit #{} should continue exploring", unit.id);
            // TODO: Move to unexplored areas
        }
    }
    
    // Check for nearby dangers
    let enemies = find_nearby_enemies(state, unit.tile);
    if !enemies.is_empty() {
        println!("[AI Explorer] Unit #{} should avoid {} nearby enemies", 
            unit.id, enemies.len());
        // TODO: Move away from danger
    }
}

/// Manage diplomat/spy unit
fn manage_diplomat(_state: &GameState, _ai_data: &mut AIData, unit: &Unit) {
    println!("[AI Diplomat] Unit #{} - diplomat actions not implemented", unit.id);
}

/// Manage other unit types
fn manage_other_unit(_state: &GameState, _ai_data: &mut AIData, unit: &Unit) {
    println!("[AI Unit] Unit #{} - unknown type", unit.id);
}
