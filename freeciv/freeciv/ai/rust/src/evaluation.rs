//! Evaluation functions for AI decision-making
//! 
//! This module contains functions that evaluate various game elements
//! like tiles, cities, units, technologies, diplomacy, and trade routes.

use std::os::raw::c_int;

/// Calculate a simple score for a tile position
/// This is a basic example of Rust AI logic
/// 
/// # Arguments
/// * `x` - X coordinate
/// * `y` - Y coordinate
/// * `terrain_type` - Type of terrain (0=ocean, 1=grassland, 2=plains, etc.)
/// 
/// # Returns
/// A score value representing the desirability of the tile
#[no_mangle]
pub extern "C" fn rust_ai_evaluate_tile(x: c_int, y: c_int, terrain_type: c_int) -> c_int {
    // Enhanced scoring algorithm with terrain bonuses
    let base_score = match terrain_type {
        0 => 10,  // Ocean - low value, but necessary for naval units
        1 => 100, // Grassland - high value for food production
        2 => 80,  // Plains - good for production and food
        3 => 40,  // Desert - low value, poor production
        4 => 60,  // Tundra - moderate value
        5 => 85,  // Forest - good for production and shields
        6 => 90,  // Hills - excellent for production
        7 => 70,  // Mountains - moderate, good for defense
        8 => 95,  // River tiles - very valuable for food and commerce
        _ => 50,  // Unknown - default moderate value
    };
    
    // Add some variation based on position to simulate resource distribution
    let position_modifier = ((x + y) % 20) - 10;
    
    // Bonus for tiles near the center of the map (strategic importance)
    let center_bonus = if (x % 50 < 25) && (y % 50 < 25) { 10 } else { 0 };
    
    base_score + position_modifier + center_bonus
}

/// Evaluate a tile for city placement
/// Returns a score indicating how good a location is for founding a city
/// 
/// # Arguments
/// * `x` - X coordinate
/// * `y` - Y coordinate
/// * `terrain_type` - Type of terrain at this location
/// * `adjacent_water` - Number of adjacent water tiles (0-8)
/// * `adjacent_land` - Number of adjacent land tiles (0-8)
/// 
/// # Returns
/// A score for city placement quality (higher is better)
#[no_mangle]
pub extern "C" fn rust_ai_evaluate_city_placement(
    x: c_int,
    y: c_int,
    terrain_type: c_int,
    adjacent_water: c_int,
    adjacent_land: c_int,
) -> c_int {
    // Base tile value
    let mut score = rust_ai_evaluate_tile(x, y, terrain_type);
    
    // Prefer locations with good land/water balance
    // Some water is good for trade and food, but too much is bad
    if adjacent_water >= 1 && adjacent_water <= 3 {
        score += 30; // Coastal cities are valuable
    } else if adjacent_water > 5 {
        score -= 40; // Too much water limits city growth
    }
    
    // Need sufficient adjacent land for city to work tiles
    score += adjacent_land * 5;
    
    // Grassland and plains are best for city centers
    if terrain_type == 1 || terrain_type == 2 {
        score += 40;
    }
    
    // Avoid placing cities on mountains or in deep ocean
    if terrain_type == 0 || terrain_type == 7 {
        score -= 100;
    }
    
    score
}

/// Calculate the combat value of a unit
/// 
/// # Arguments
/// * `attack_strength` - Unit's attack rating
/// * `defense_strength` - Unit's defense rating
/// * `movement_points` - Unit's movement capability
/// * `hitpoints` - Current hitpoints
/// * `max_hitpoints` - Maximum hitpoints
/// 
/// # Returns
/// Overall combat effectiveness score
#[no_mangle]
pub extern "C" fn rust_ai_evaluate_unit_strength(
    attack_strength: c_int,
    defense_strength: c_int,
    movement_points: c_int,
    hitpoints: c_int,
    max_hitpoints: c_int,
) -> c_int {
    // Calculate base combat value (average of attack and defense)
    let base_value = (attack_strength + defense_strength) / 2;
    
    // Mobility is valuable - add bonus for movement
    let mobility_bonus = movement_points * 3;
    
    // Health affects effectiveness
    let health_ratio = if max_hitpoints > 0 {
        (hitpoints * 100) / max_hitpoints
    } else {
        100
    };
    
    // Apply health modifier (units at 50% health are ~75% effective)
    let total_value = base_value + mobility_bonus;
    (total_value * (50 + health_ratio / 2)) / 100
}

/// Assess threat level from enemy units
/// 
/// # Arguments
/// * `num_enemy_units` - Number of enemy units in area
/// * `enemy_avg_strength` - Average combat strength of enemy units
/// * `distance_to_enemy` - Distance to nearest enemy (in tiles)
/// * `our_defense_strength` - Our defensive capability in the area
/// 
/// # Returns
/// Threat level score (0-100, higher is more dangerous)
#[no_mangle]
pub extern "C" fn rust_ai_assess_threat(
    num_enemy_units: c_int,
    enemy_avg_strength: c_int,
    distance_to_enemy: c_int,
    our_defense_strength: c_int,
) -> c_int {
    // Base threat from number and strength of enemies
    let base_threat = num_enemy_units * enemy_avg_strength / 10;
    
    // Distance modifier - closer enemies are more threatening
    let distance_factor = if distance_to_enemy > 0 {
        100 / distance_to_enemy
    } else {
        100 // Enemy right next to us!
    };
    
    // Compare to our defenses
    let relative_threat = if our_defense_strength > 0 {
        (base_threat * 100) / our_defense_strength
    } else {
        base_threat * 2 // No defenses, very dangerous!
    };
    
    // Apply distance modifier and clamp to 0-100
    let final_threat = (relative_threat * distance_factor) / 100;
    final_threat.clamp(0, 100)
}

/// Evaluate a technology for research priority
/// 
/// # Arguments
/// * `tech_cost` - Science points required to research
/// * `military_value` - Military benefit (0-100)
/// * `economic_value` - Economic benefit (0-100)
/// * `enables_units` - Number of new units enabled
/// * `enables_buildings` - Number of new buildings enabled
/// * `enables_wonders` - Number of wonders enabled
/// 
/// # Returns
/// Priority score for researching this technology (higher is better)
#[no_mangle]
pub extern "C" fn rust_ai_evaluate_tech(
    tech_cost: c_int,
    military_value: c_int,
    economic_value: c_int,
    enables_units: c_int,
    enables_buildings: c_int,
    enables_wonders: c_int,
) -> c_int {
    // Base value from military and economic benefits
    let base_value = military_value + economic_value;
    
    // Bonus for technologies that enable new capabilities
    let capability_bonus = enables_units * 15 + enables_buildings * 10 + enables_wonders * 25;
    
    // Total value
    let total_value = base_value + capability_bonus;
    
    // Normalize by cost - prefer cheaper techs with good value
    // Use a logarithmic scale to avoid division issues
    if tech_cost > 0 {
        // Return value per cost (scaled up by 10 for better granularity)
        (total_value * 1000) / (tech_cost + 50)
    } else {
        total_value * 10 // Free tech, very high priority
    }
}

/// Evaluate diplomatic stance towards another player
/// 
/// # Arguments
/// * `our_strength` - Our military strength
/// * `their_strength` - Their military strength
/// * `shared_borders` - Do we share borders? (0=no, 1=yes)
/// * `past_wars` - Number of past wars with this player
/// * `trade_benefit` - Economic benefit from trade (0-100)
/// * `tech_advancement` - Their tech level relative to ours (-100 to 100)
/// 
/// # Returns
/// Diplomatic stance score (-100=hostile, 0=neutral, 100=friendly)
#[no_mangle]
pub extern "C" fn rust_ai_evaluate_diplomacy(
    our_strength: c_int,
    their_strength: c_int,
    shared_borders: c_int,
    past_wars: c_int,
    trade_benefit: c_int,
    tech_advancement: c_int,
) -> c_int {
    // Start neutral
    let mut stance = 0;
    
    // Negative factors
    if shared_borders > 0 {
        stance -= 20; // Border tension
    }
    stance -= past_wars * 15; // Historical conflicts matter
    
    // Positive factors
    stance += trade_benefit / 2; // Trade encourages friendship
    
    // Strength comparison affects stance
    let strength_ratio = if their_strength > 0 {
        (our_strength * 100) / their_strength
    } else {
        200 // They're very weak
    };
    
    if strength_ratio > 150 {
        // We're much stronger - can afford to be aggressive
        stance -= 10;
    } else if strength_ratio < 70 {
        // They're stronger - be cautious/friendly
        stance += 20;
    }
    
    // Tech leaders are valuable allies
    if tech_advancement > 20 {
        stance += 15; // They're advanced, good to befriend
    } else if tech_advancement < -30 {
        stance -= 10; // They're backwards, less valuable
    }
    
    stance.clamp(-100, 100)
}

/// Evaluate a trade route potential
/// 
/// # Arguments
/// * `our_city_size` - Population of our city
/// * `their_city_size` - Population of their city
/// * `distance` - Distance between cities
/// * `our_trade_bonus` - Our city's trade bonus (0-100)
/// * `their_trade_bonus` - Their city's trade bonus (0-100)
/// * `connection_type` - 0=none, 1=road, 2=railroad, 3=river, 4=sea
/// 
/// # Returns
/// Expected trade route value
#[no_mangle]
pub extern "C" fn rust_ai_evaluate_trade_route(
    our_city_size: c_int,
    their_city_size: c_int,
    distance: c_int,
    our_trade_bonus: c_int,
    their_trade_bonus: c_int,
    connection_type: c_int,
) -> c_int {
    // Base trade value from city sizes
    let base_trade = (our_city_size + their_city_size) * 5;
    
    // Distance penalty (longer routes are less efficient)
    let distance_penalty = if distance > 0 {
        (distance * 2).min(50) // Cap at 50% penalty
    } else {
        0
    };
    
    // Connection bonus
    let connection_bonus = match connection_type {
        4 => 30, // Sea routes are very valuable
        3 => 20, // River routes are good
        2 => 25, // Railroad is excellent
        1 => 10, // Road is basic
        _ => 0,  // No connection
    };
    
    // Trade bonuses from city improvements
    let bonus_multiplier = 100 + our_trade_bonus + their_trade_bonus;
    
    // Calculate final value
    let raw_value = base_trade + connection_bonus;
    let value_with_distance = raw_value - (raw_value * distance_penalty / 100);
    (value_with_distance * bonus_multiplier) / 100
}
