//! Decision algorithms for AI strategic choices
//! 
//! This module contains high-level decision-making functions that use
//! game state information to make strategic choices about production,
//! movement, combat, settling, and growth.

use std::os::raw::c_int;
use crate::data_structures::{RustCity, RustUnit, RustTile};
use crate::planning::rust_ai_predict_battle;
use crate::evaluation::rust_ai_evaluate_tile;

/// Evaluate whether a city should build a unit or building
/// Uses city and game state to make intelligent production decisions
/// 
/// # Arguments
/// * `city` - City state information
/// * `nearby_enemies` - Number of enemy units near the city
/// * `our_military_count` - Total number of our military units
/// * `turn` - Current game turn
/// 
/// # Returns
/// Production decision: 0=settler, 1=military_unit, 2=building, 3=wonder
#[no_mangle]
pub extern "C" fn rust_ai_decide_city_production(
    city: &RustCity,
    nearby_enemies: c_int,
    our_military_count: c_int,
    turn: c_int,
) -> c_int {
    // Immediate military need
    if nearby_enemies > 2 {
        return 1; // Build military units for defense
    }
    
    // Early game: focus on expansion and growth
    if turn < 50 {
        if city.population >= 3 && city.food_surplus >= 2 {
            return 0; // Build settler for expansion
        }
        return 2; // Build infrastructure (granary, etc.)
    }
    
    // Check if we need more military
    let military_ratio = if city.population > 0 {
        our_military_count / city.population.max(1)
    } else {
        0
    };
    
    if military_ratio < 1 && nearby_enemies > 0 {
        return 1; // Need more military units
    }
    
    // High production cities can build wonders
    if city.shield_surplus > 15 && city.population >= 8 {
        return 3; // Build wonder
    }
    
    // Mid game: balance between military and buildings
    if turn < 150 {
        if city.science_output < 5 {
            return 2; // Need science buildings
        }
        if our_military_count < 5 {
            return 1; // Need some military
        }
        return 2; // Focus on buildings
    }
    
    // Late game: economy and military balance
    if city.gold_output < 10 {
        2 // Economic buildings
    } else if our_military_count < 10 {
        1 // Military units
    } else {
        2 // Default to buildings
    }
}

/// Evaluate the best target tile for a unit to move to
/// Considers terrain, strategic value, and unit capabilities
/// 
/// # Arguments
/// * `unit` - Unit state information
/// * `target_tile` - Potential target tile
/// * `has_enemies` - Are there enemies on or near the target? (0=no, 1=yes)
/// * `strategic_value` - Strategic importance of the tile (0-100)
/// 
/// # Returns
/// Movement score (higher is better, 0 means don't move here)
#[no_mangle]
pub extern "C" fn rust_ai_evaluate_unit_move(
    unit: &RustUnit,
    target_tile: &RustTile,
    has_enemies: c_int,
    strategic_value: c_int,
) -> c_int {
    // Can't move if no movement points left
    if unit.moves_left <= 0 {
        return 0;
    }
    
    // Calculate distance (Manhattan distance approximation)
    let dx = (unit.x - target_tile.x).abs();
    let dy = (unit.y - target_tile.y).abs();
    let distance = dx + dy;
    
    // Check if we can reach the tile with remaining movement
    if distance > unit.moves_left {
        return 0; // Too far to reach
    }
    
    let mut score = strategic_value;
    
    // Military units: evaluate combat potential
    if unit.is_military > 0 {
        if has_enemies > 0 {
            // Factor in unit health and strength
            let combat_readiness = (unit.hitpoints * 100) / unit.max_hitpoints.max(1);
            if combat_readiness > 70 {
                score += 50; // Healthy unit, engage enemies
            } else if combat_readiness < 40 {
                score -= 100; // Wounded, avoid combat
            }
        }
        
        // Prefer tiles with roads for faster movement
        if target_tile.has_railroad > 0 {
            score += 20;
        } else if target_tile.has_road > 0 {
            score += 10;
        }
    } else {
        // Civilian units: avoid enemies
        if has_enemies > 0 {
            score -= 200; // Strongly avoid enemies
        }
        
        // Prefer safe, owned territory
        if target_tile.owner_id == unit.owner_id {
            score += 30;
        }
    }
    
    // Movement efficiency: prefer closer tiles
    score += (10 - distance) * 5;
    
    score.max(0)
}

/// Evaluate whether a unit should attack an enemy
/// Considers unit strengths, health, and tactical situation
/// 
/// # Arguments
/// * `attacker` - Our unit considering the attack
/// * `defender` - Enemy unit to potentially attack
/// * `terrain_bonus` - Terrain defense bonus for defender (0-100)
/// * `support_nearby` - Number of our units nearby for support
/// 
/// # Returns
/// Attack recommendation: 0=don't attack, 1=attack if safe, 2=priority attack
#[no_mangle]
pub extern "C" fn rust_ai_evaluate_attack(
    attacker: &RustUnit,
    defender: &RustUnit,
    terrain_bonus: c_int,
    support_nearby: c_int,
) -> c_int {
    // Don't attack if we're badly wounded
    let our_health = (attacker.hitpoints * 100) / attacker.max_hitpoints.max(1);
    if our_health < 30 {
        return 0; // Too weak to attack
    }
    
    // Calculate win probability using our battle prediction
    let win_chance = rust_ai_predict_battle(
        attacker.attack_strength,
        attacker.hitpoints,
        attacker.firepower,
        defender.defense_strength,
        defender.hitpoints,
        defender.firepower,
        terrain_bonus,
    );
    
    // Factor in veteran level (experienced units are more effective)
    let adjusted_chance = win_chance + (attacker.veteran_level * 5);
    
    // Consider nearby support
    let support_bonus = support_nearby * 10;
    let final_chance = (adjusted_chance + support_bonus).min(100);
    
    // Decision logic
    if final_chance >= 80 {
        2 // High confidence attack
    } else if final_chance >= 60 && our_health > 70 {
        1 // Reasonable attack if healthy
    } else if final_chance >= 50 && support_nearby >= 2 {
        1 // Attack with support
    } else {
        0 // Don't attack, odds not favorable
    }
}

/// Evaluate the best location for a new city (settler decision)
/// 
/// # Arguments
/// * `settler` - Settler unit information
/// * `candidate_tile` - Potential city location
/// * `nearby_cities` - Number of our cities within 4 tiles
/// * `resources_nearby` - Quality of nearby resources (0-100)
/// 
/// # Returns
/// City placement score (higher is better, 0 means don't settle here)
#[no_mangle]
pub extern "C" fn rust_ai_evaluate_settle_location(
    settler: &RustUnit,
    candidate_tile: &RustTile,
    nearby_cities: c_int,
    resources_nearby: c_int,
) -> c_int {
    // Don't settle too close to existing cities
    if nearby_cities > 1 {
        return 0;
    }
    
    // Basic tile evaluation
    let mut score = rust_ai_evaluate_tile(
        candidate_tile.x,
        candidate_tile.y,
        candidate_tile.terrain_type,
    );
    
    // Resource quality is very important
    score += resources_nearby;
    
    // Slight penalty for one nearby city (prefer some distance)
    if nearby_cities == 1 {
        score -= 20;
    }
    
    // Bonus for rivers (food and trade)
    if candidate_tile.has_river > 0 {
        score += 40;
    }
    
    // Consider if tile is already owned
    if candidate_tile.owner_id >= 0 && candidate_tile.owner_id != settler.owner_id {
        score -= 100; // Don't settle in enemy territory
    }
    
    // Bonus for unclaimed territory
    if candidate_tile.owner_id < 0 {
        score += 30;
    }
    
    score.max(0)
}

/// Evaluate city growth strategy
/// Determines if a city should focus on growth, production, or wealth
/// 
/// # Arguments
/// * `city` - City state information
/// * `population_limit` - Aqueduct/sewer limit (0 if no limit)
/// * `starvation_risk` - Is city at risk of starvation? (0=no, 1=yes)
/// 
/// # Returns
/// Strategy: 0=maximize_growth, 1=maximize_production, 2=maximize_wealth
#[no_mangle]
pub extern "C" fn rust_ai_city_growth_strategy(
    city: &RustCity,
    population_limit: c_int,
    starvation_risk: c_int,
) -> c_int {
    // Emergency: prevent starvation
    if starvation_risk > 0 {
        return 0; // Focus on food/growth
    }
    
    // If we're at population cap, don't focus on growth
    if population_limit > 0 && city.population >= population_limit {
        // Mature city: focus on production or wealth
        if city.shield_surplus < 10 {
            return 1; // Need more production
        } else {
            return 2; // Focus on wealth
        }
    }
    
    // Small cities should grow
    if city.population < 6 {
        return 0; // Maximize growth
    }
    
    // Medium cities: balance based on output
    if city.population < 12 {
        if city.food_surplus < 2 {
            return 0; // Need food for growth
        } else if city.shield_surplus < 10 {
            return 1; // Need production
        } else {
            return 0; // Continue growing
        }
    }
    
    // Large cities: production or wealth
    if city.shield_surplus < 15 {
        1 // Maximize production
    } else {
        2 // Maximize wealth
    }
}
