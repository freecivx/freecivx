//! Planning and optimization functions
//! 
//! This module contains functions for planning city production,
//! predicting battles, allocating specialists, and determining build orders.

use std::os::raw::c_int;

/// Optimize city production based on needs
/// 
/// # Arguments
/// * `food_surplus` - Current food surplus per turn
/// * `production_rate` - Current shields per turn
/// * `science_output` - Current science per turn
/// * `population` - Current city population
/// * `military_need` - Military urgency (0-100)
/// * `growth_priority` - Growth importance (0-100)
/// * `infrastructure_need` - Infrastructure urgency (0-100)
/// 
/// # Returns
/// Production recommendation: 0=unit, 1=building, 2=settler, 3=wonder
#[no_mangle]
pub extern "C" fn rust_ai_optimize_production(
    food_surplus: c_int,
    production_rate: c_int,
    science_output: c_int,
    population: c_int,
    military_need: c_int,
    growth_priority: c_int,
    infrastructure_need: c_int,
) -> c_int {
    // Score each production category
    let mut unit_score = military_need;
    let mut building_score = infrastructure_need;
    let mut settler_score = 0;
    let mut wonder_score = 0;
    
    // Food surplus affects settler production
    if food_surplus >= 3 && population >= 4 {
        settler_score = growth_priority / 2;
    }
    
    // Low population cities need growth buildings
    if population < 6 {
        building_score += 30;
        settler_score = 0; // Don't build settlers from small cities
    }
    
    // High production enables wonder building
    if production_rate > 15 && population >= 8 {
        wonder_score = 40;
    }
    
    // Science output affects building priority
    if science_output < 10 {
        building_score += 20; // Need science buildings
    }
    
    // High military need overrides other priorities
    if military_need > 70 {
        unit_score += 30;
    }
    
    // Find the highest priority
    let max_score = unit_score.max(building_score).max(settler_score).max(wonder_score);
    
    if max_score == unit_score {
        0 // Build unit
    } else if max_score == building_score {
        1 // Build building
    } else if max_score == settler_score {
        2 // Build settler
    } else {
        3 // Build wonder
    }
}

/// Predict battle outcome between two units
/// 
/// # Arguments
/// * `attacker_strength` - Attacking unit's strength
/// * `attacker_hp` - Attacking unit's current HP
/// * `attacker_firepower` - Attacking unit's firepower
/// * `defender_strength` - Defending unit's strength
/// * `defender_hp` - Defending unit's current HP
/// * `defender_firepower` - Defending unit's firepower
/// * `terrain_defense_bonus` - Terrain defense bonus (0-100)
/// 
/// # Returns
/// Win probability for attacker (0-100)
#[no_mangle]
pub extern "C" fn rust_ai_predict_battle(
    attacker_strength: c_int,
    attacker_hp: c_int,
    attacker_firepower: c_int,
    defender_strength: c_int,
    defender_hp: c_int,
    defender_firepower: c_int,
    terrain_defense_bonus: c_int,
) -> c_int {
    // Apply terrain bonus to defender
    let defender_effective = defender_strength * (100 + terrain_defense_bonus) / 100;
    
    // Calculate effective strength based on HP
    let attacker_effective = if attacker_hp > 0 {
        attacker_strength * attacker_hp / 100
    } else {
        0 // Dead unit has no combat power
    };
    
    let defender_effective_hp = if defender_hp > 0 {
        defender_effective * defender_hp / 100
    } else {
        0 // Dead unit has no combat power
    };
    
    // Factor in firepower
    let attacker_power = attacker_effective * attacker_firepower;
    let defender_power = defender_effective_hp * defender_firepower;
    
    // Calculate win probability using a simple ratio
    let total_power = attacker_power + defender_power;
    if total_power > 0 {
        ((attacker_power * 100) / total_power).clamp(0, 100)
    } else {
        50 // Equal chance if both have zero power
    }
}

/// Evaluate specialist allocation for a city
/// 
/// # Arguments
/// * `food_needed` - Food needed for growth
/// * `shields_needed` - Shields needed for current production
/// * `science_priority` - Science importance (0-100)
/// * `tax_priority` - Tax/gold importance (0-100)
/// * `available_citizens` - Number of citizens that can be specialists
/// 
/// # Returns
/// Specialist type recommendation: 0=none, 1=scientist, 2=taxman, 3=entertainer
#[no_mangle]
pub extern "C" fn rust_ai_evaluate_specialist(
    food_needed: c_int,
    shields_needed: c_int,
    science_priority: c_int,
    tax_priority: c_int,
    available_citizens: c_int,
) -> c_int {
    // Can't assign specialists if we don't have available citizens
    if available_citizens <= 0 {
        return 0; // No specialists
    }
    
    // If we critically need food or shields, don't use specialists
    if food_needed > 5 || shields_needed > 10 {
        return 0;
    }
    
    // Score each specialist type
    let scientist_score = science_priority;
    let taxman_score = tax_priority;
    let entertainer_score = 30; // Base value for happiness
    
    // Find the best choice
    let max_score = scientist_score.max(taxman_score).max(entertainer_score);
    
    if max_score == scientist_score {
        1 // Scientist
    } else if max_score == taxman_score {
        2 // Taxman
    } else {
        3 // Entertainer
    }
}

/// Calculate optimal city build order
/// 
/// # Arguments
/// * `is_first_city` - Is this the capital/first city? (0=no, 1=yes)
/// * `turn_number` - Current game turn
/// * `nearby_enemies` - Number of enemy units nearby
/// * `coastal` - Is the city coastal? (0=no, 1=yes)
/// 
/// # Returns
/// Build priority: 0=granary, 1=barracks, 2=marketplace, 3=library, 4=walls
#[no_mangle]
pub extern "C" fn rust_ai_city_build_order(
    is_first_city: c_int,
    turn_number: c_int,
    nearby_enemies: c_int,
    coastal: c_int,
) -> c_int {
    // Early game priorities for capital
    if is_first_city > 0 && turn_number < 20 {
        return 0; // Granary for growth
    }
    
    // Immediate military threat
    if nearby_enemies > 0 {
        if nearby_enemies >= 3 {
            return 4; // Walls for defense
        } else {
            return 1; // Barracks for military
        }
    }
    
    // Early game (turns 1-50)
    if turn_number < 50 {
        if coastal > 0 {
            return 2; // Marketplace for coastal trade
        } else {
            return 0; // Granary for growth
        }
    }
    
    // Mid game (turns 50-150)
    if turn_number < 150 {
        return 3; // Library for science
    }
    
    // Late game
    2 // Marketplace for economy
}
