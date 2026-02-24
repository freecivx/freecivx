/// AI Unit Management - Unit movement, orders, and tactics
/// Based on freeciv/freeciv/ai/default/daiunit.c

use crate::state::{GameState, Unit, City};
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
/// Based on C AI's settler management in daisettler.c
fn manage_settler(state: &GameState, ai_data: &mut AIData, unit: &Unit) {
    println!("[AI Settler] Unit #{} - evaluating city founding", unit.id);
    
    // Evaluate current tile for city placement
    let current_value = crate::ai::aitools::evaluate_city_tile(state, unit.tile);
    println!("[AI Settler] Current tile value: {}", current_value);
    
    // Check if current location is good enough to found city
    // C AI uses RESULT_IS_ENOUGH threshold (250 in settler code)
    if current_value >= 80 {
        println!("[AI Settler] Unit #{} - good location found, should build city", unit.id);
        // TODO: Send build city command
        ai_data.set_unit_task(unit.id, AIUnitTask::BuildCity, Some(unit.tile));
        return;
    }
    
    // Calculate distance to nearest city
    let distance_to_city = find_nearest_city_distance(state, unit.tile);
    
    if let Some(dist) = distance_to_city {
        println!("[AI Settler] Unit #{} is {:.0} tiles from nearest city", unit.id, dist);
        
        // C AI settlers look for optimal location within reasonable distance
        // If far enough from cities but location isn't great, keep searching
        if dist > 4.0 && current_value > 40 {
            println!("[AI Settler] Unit #{} - acceptable location, considering building", unit.id);
            ai_data.set_unit_task(unit.id, AIUnitTask::BuildCity, Some(unit.tile));
        } else if dist < 3.0 {
            println!("[AI Settler] Unit #{} - too close to city, must move away", unit.id);
            // TODO: Move to a better location away from cities
            ai_data.set_unit_task(unit.id, AIUnitTask::BuildCity, None);
        } else {
            println!("[AI Settler] Unit #{} - searching for better location", unit.id);
            // TODO: Use pathfinding to find better location
            ai_data.set_unit_task(unit.id, AIUnitTask::BuildCity, None);
        }
    } else {
        // No cities yet - found first city at current location
        println!("[AI Settler] Unit #{} - founding first city!", unit.id);
        ai_data.set_unit_task(unit.id, AIUnitTask::BuildCity, Some(unit.tile));
    }
}

/// Manage worker unit
/// Based on C AI's autoworkers.c
fn manage_worker(state: &GameState, ai_data: &mut AIData, unit: &Unit) {
    println!("[AI Worker] Unit #{} - managing terrain improvements", unit.id);
    
    ai_data.set_unit_task(unit.id, AIUnitTask::AutoSettler, None);
    
    // C AI worker priorities (from autoworkers.c):
    // 1. Road to connect cities (commerce and movement)
    // 2. Irrigate tiles near cities (food for growth)
    // 3. Mine hills/mountains (production)
    // 4. Railroad (late game - faster movement)
    // 5. Pollution cleanup (if present)
    
    // Find nearest city to work near
    if let Some(player_id) = state.our_player_id {
        let (nearest_dist, nearest_city) = find_nearest_city_and_distance(state, unit.tile, player_id);
        
        if let (Some(dist), Some(city)) = (nearest_dist, nearest_city) {
            if dist < 2.0 {
                println!("[AI Worker] Unit #{} near city '{}', improving local tiles", 
                    unit.id, city.name);
                
                // Priority 1: Improve tiles within city radius
                // C AI evaluates each tile's improvement potential
                // TODO: Evaluate tiles in city radius and improve best one
                
            } else if dist < 5.0 {
                println!("[AI Worker] Unit #{} {:.0} tiles from '{}', building road connection", 
                    unit.id, dist, city.name);
                
                // Priority 2: Build road to connect to city
                // C AI uses pathfinding to find best road path
                // TODO: Move toward city building road
                
            } else {
                println!("[AI Worker] Unit #{} far from cities ({:.0} tiles), moving closer", 
                    unit.id, dist);
                
                // Priority 3: Move toward nearest city
                // TODO: Move toward nearest city
            }
        } else {
            println!("[AI Worker] Unit #{} has no cities to work near", unit.id);
            // No cities - worker should wait or follow settlers
        }
    }
    
    // C AI worker evaluation factors:
    // - Food/shield/trade gain from improvement
    // - Time to complete improvement
    // - City need (growing city needs food, production city needs shields)
    // - Current tile usage (being worked vs idle)
}

/// Evaluate improvement priority for a tile near a city
/// Based on C AI's tile improvement evaluation
fn _evaluate_tile_improvement(_state: &GameState, _tile: i32, _city: &City) -> i32 {
    // C AI calculates improvement value based on:
    // 1. Output increase (food/shield/trade)
    // 2. City needs (food for growth, shields for production)
    // 3. Tile usage (is it being worked?)
    // 4. Time to complete
    
    // Simplified placeholder
    50
}

/// Manage defender unit
fn manage_defender(_state: &GameState, _ai_data: &mut AIData, unit: &Unit) {
    println!("[AI Defender] Unit #{} holding position", unit.id);
    // Defender stays in place
}

/// Manage attacking military unit
/// Based on C AI's military unit management in daimilitary.c and daiunit.c
fn manage_attacker(state: &GameState, ai_data: &mut AIData, unit: &Unit) {
    println!("[AI Attacker] Unit #{} - managing military unit", unit.id);
    
    // Priority 1: Check if unit needs healing (from C AI)
    // Units below 50% HP should recover before engaging
    let max_hp = 100; // Assumed max HP
    let hp_percent = (unit.hp * 100) / max_hp;
    
    if hp_percent < 50 {
        println!("[AI Attacker] Unit #{} critically damaged (HP: {}%), recovering", 
            unit.id, hp_percent);
        ai_data.set_unit_task(unit.id, AIUnitTask::Recover, None);
        // TODO: Move to safe location to heal
        return;
    } else if hp_percent < 80 {
        println!("[AI Attacker] Unit #{} slightly damaged (HP: {}%), prefer defense", 
            unit.id, hp_percent);
    }
    
    // Priority 2: Check if we need to defend our cities
    // C AI prioritizes city defense over offensive operations
    if let Some(player_id) = state.our_player_id {
        for city in state.cities.values() {
            if city.owner == player_id {
                let dist = state.map.distance(city.tile, unit.tile);
                let danger = crate::ai::aitools::assess_city_danger(state, city);
                
                // If city is in danger and unit is nearby, defend it
                if danger > 30 && dist <= 3 {
                    println!("[AI Attacker] Unit #{} defending threatened city {} (danger: {}, dist: {})", 
                        unit.id, city.name, danger, dist);
                    ai_data.set_unit_task(unit.id, AIUnitTask::DefendHome, Some(city.tile));
                    // TODO: Move to city tile or fortify nearby
                    return;
                }
            }
        }
    }
    
    // Priority 3: Look for enemy units to attack
    // C AI uses complex attack value calculations
    println!("[AI Attacker] Unit #{} looking for enemies", unit.id);
    let enemies = find_nearby_enemies(state, unit.tile);
    
    if !enemies.is_empty() {
        // Find weakest enemy within range
        if let Some(target) = enemies.iter()
            .min_by_key(|e| calculate_attack_priority(unit, e, state)) 
        {
            let dist = state.map.distance(unit.tile, target.tile);
            println!("[AI Attacker] Unit #{} found target unit #{} at distance {}", 
                unit.id, target.id, dist);
            
            // C AI checks if attack is favorable before committing
            if should_attack(unit, target, state) {
                println!("[AI Attacker] Unit #{} engaging target #{}", unit.id, target.id);
                ai_data.set_unit_task(unit.id, AIUnitTask::Attack, Some(target.tile));
                // TODO: Move toward and attack enemy
            } else {
                println!("[AI Attacker] Unit #{} attack unfavorable, holding position", unit.id);
            }
            return;
        }
    }
    
    // Priority 4: No immediate threats or targets - patrol or explore
    println!("[AI Attacker] Unit #{} no enemies nearby, patrolling", unit.id);
    // TODO: Move toward enemy territory or patrol borders
    // C AI uses strategic map analysis to find good attack positions
}

/// Calculate attack priority (lower = better target)
/// Based on C AI's attack value calculation
fn calculate_attack_priority(attacker: &Unit, defender: &Unit, state: &GameState) -> i32 {
    let dist = state.map.distance(attacker.tile, defender.tile);
    let defender_hp = defender.hp;
    
    // Prefer weaker, closer targets
    // Formula: distance * 10 + hp
    // Lower values are better targets
    (dist * 10) + defender_hp as i32
}

/// Determine if attack is favorable
/// Based on C AI's combat odds calculation
fn should_attack(attacker: &Unit, defender: &Unit, _state: &GameState) -> bool {
    let attacker_strength = crate::ai::aitools::calculate_unit_strength(attacker);
    let defender_strength = crate::ai::aitools::calculate_unit_strength(defender);
    
    // Simple rule: attack if we have 1.5x strength advantage
    // C AI uses detailed combat calculations with terrain modifiers
    attacker_strength >= (defender_strength * 3) / 2
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
/// Based on C AI's autoexplorer.c
fn manage_explorer(state: &GameState, ai_data: &mut AIData, unit: &Unit) {
    println!("[AI Explorer] Unit #{} - exploring from tile {}", unit.id, unit.tile);
    
    ai_data.set_unit_task(unit.id, AIUnitTask::Explore, None);
    
    // C AI exploration strategy:
    // 1. Avoid danger areas
    // 2. Move toward unexplored territory
    // 3. Spiral outward from cities
    // 4. Prioritize strategic locations (rivers, coasts)
    
    // Check for nearby dangers first (safety priority)
    let enemies = find_nearby_enemies(state, unit.tile);
    if !enemies.is_empty() {
        println!("[AI Explorer] Unit #{} avoiding {} nearby enemies", 
            unit.id, enemies.len());
        // TODO: Move away from danger using pathfinding
        // C AI uses danger maps to avoid threats
        return;
    }
    
    // Determine exploration direction based on distance from cities
    if let Some(player_id) = state.our_player_id {
        let (nearest_city_dist, _) = find_nearest_city_and_distance(state, unit.tile, player_id);
        
        if let Some(dist) = nearest_city_dist {
            if dist < 5.0 {
                println!("[AI Explorer] Unit #{} is {:.0} tiles from city, moving outward", 
                    unit.id, dist);
                // TODO: Move away from cities to explore
                // C AI uses spiral pattern from cities
            } else if dist > 15.0 {
                println!("[AI Explorer] Unit #{} is {:.0} tiles from city, may be too far", 
                    unit.id, dist);
                // Don't go too far from civilization
                // TODO: Consider returning toward friendly territory
            } else {
                println!("[AI Explorer] Unit #{} is {:.0} tiles from city, good exploration range", 
                    unit.id, dist);
                // TODO: Continue exploring in current direction
            }
        } else {
            println!("[AI Explorer] Unit #{} has no cities nearby, exploring freely", unit.id);
            // TODO: Explore in any direction
        }
    }
    
    // C AI priorities for exploration:
    // - Unknown tiles (highest priority)
    // - Strategic resources (rivers, bonus resources)
    // - Potential city sites (good tiles)
    // - Enemy territory (scouting)
}

/// Find nearest city and its distance
/// Returns (distance, city) tuple
fn find_nearest_city_and_distance(
    state: &GameState, 
    tile: i32, 
    owner: u16
) -> (Option<f32>, Option<&City>) {
    state.cities.values()
        .filter(|c| c.owner == owner)
        .map(|c| {
            let dist = state.map.distance(c.tile, tile) as f32;
            (dist, c)
        })
        .min_by(|a, b| a.0.partial_cmp(&b.0).unwrap())
        .map(|(dist, city)| (Some(dist), Some(city)))
        .unwrap_or((None, None))
}

/// Manage diplomat/spy unit
fn manage_diplomat(_state: &GameState, _ai_data: &mut AIData, unit: &Unit) {
    println!("[AI Diplomat] Unit #{} - diplomat actions not implemented", unit.id);
}

/// Manage other unit types
fn manage_other_unit(_state: &GameState, _ai_data: &mut AIData, unit: &Unit) {
    println!("[AI Unit] Unit #{} - unknown type", unit.id);
}
