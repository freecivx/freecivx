//! Rust AI module for Freeciv
//! 
//! This module provides AI functionality for Freeciv using Rust.
//! It provides FFI exports that can be called from the C wrapper in rustai.c.

use std::ffi::CStr;
use std::os::raw::{c_char, c_int, c_void};

/// Rust AI player data structure
/// This stores AI-specific data for each player
#[repr(C)]
pub struct RustAIPlayerData {
    player_id: c_int,
    turn_initialized: c_int,
    aggression_level: c_int,
    expansion_focus: c_int,  // 0-100: 0=defensive, 100=expansionist
    science_focus: c_int,     // 0-100: 0=military, 100=science
}

// ============================================================================
// Phase 2: Game State Bindings - Rust structs for cities, units, tiles
// ============================================================================

/// Tile game state representation
/// Represents a map tile with terrain and resource information
#[repr(C)]
#[derive(Debug, Clone, Copy)]
pub struct RustTile {
    pub x: c_int,
    pub y: c_int,
    pub terrain_type: c_int,
    pub has_river: c_int,
    pub has_road: c_int,
    pub has_railroad: c_int,
    pub owner_id: c_int,  // -1 if unowned
    pub worked_by_city_id: c_int,  // -1 if not worked
}

/// Unit game state representation
/// Represents a military or civilian unit
#[repr(C)]
#[derive(Debug, Clone, Copy)]
pub struct RustUnit {
    pub unit_id: c_int,
    pub owner_id: c_int,
    pub x: c_int,
    pub y: c_int,
    pub attack_strength: c_int,
    pub defense_strength: c_int,
    pub movement_points: c_int,
    pub moves_left: c_int,
    pub hitpoints: c_int,
    pub max_hitpoints: c_int,
    pub firepower: c_int,
    pub veteran_level: c_int,
    pub is_military: c_int,  // 0=civilian, 1=military
}

/// City game state representation
/// Represents a city with production and population
#[repr(C)]
#[derive(Debug, Clone, Copy)]
pub struct RustCity {
    pub city_id: c_int,
    pub owner_id: c_int,
    pub x: c_int,
    pub y: c_int,
    pub population: c_int,
    pub food_surplus: c_int,
    pub shield_surplus: c_int,
    pub trade_production: c_int,
    pub science_output: c_int,
    pub gold_output: c_int,
    pub luxury_output: c_int,
    pub is_coastal: c_int,  // 0=no, 1=yes
    pub turn_founded: c_int,
}

/// Initialize Rust AI for a player
/// This function is called when a player starts using the Rust AI
#[no_mangle]
pub unsafe extern "C" fn rust_ai_player_init(player_id: c_int) -> *mut c_void {
    let data = Box::new(RustAIPlayerData {
        player_id,
        turn_initialized: 0,
        aggression_level: 50,  // Default medium aggression
        expansion_focus: 60,    // Slightly expansionist by default
        science_focus: 50,      // Balanced military/science
    });
    Box::into_raw(data) as *mut c_void
}

/// Free Rust AI player data
/// Called when a player no longer uses Rust AI
#[no_mangle]
pub unsafe extern "C" fn rust_ai_player_free(data: *mut c_void) {
    if !data.is_null() {
        let _ = Box::from_raw(data as *mut RustAIPlayerData);
    }
}

/// Get player aggression level
/// Returns the AI's current aggression setting (0-100)
#[no_mangle]
pub unsafe extern "C" fn rust_ai_get_aggression(data: *mut c_void) -> c_int {
    if data.is_null() {
        return 50; // Default value
    }
    let player_data = &*(data as *mut RustAIPlayerData);
    player_data.aggression_level
}

/// Set player aggression level
/// Allows dynamic adjustment of AI aggression (0=peaceful, 100=very aggressive)
#[no_mangle]
pub unsafe extern "C" fn rust_ai_set_aggression(data: *mut c_void, level: c_int) {
    if data.is_null() {
        return;
    }
    let player_data = &mut *(data as *mut RustAIPlayerData);
    player_data.aggression_level = level.clamp(0, 100);
}

/// Get player expansion focus
/// Returns the AI's expansion priority (0-100)
#[no_mangle]
pub unsafe extern "C" fn rust_ai_get_expansion_focus(data: *mut c_void) -> c_int {
    if data.is_null() {
        return 60; // Default value
    }
    let player_data = &*(data as *mut RustAIPlayerData);
    player_data.expansion_focus
}

/// Set player expansion focus
/// Adjusts how aggressively the AI expands (0=defensive, 100=expansionist)
#[no_mangle]
pub unsafe extern "C" fn rust_ai_set_expansion_focus(data: *mut c_void, level: c_int) {
    if data.is_null() {
        return;
    }
    let player_data = &mut *(data as *mut RustAIPlayerData);
    player_data.expansion_focus = level.clamp(0, 100);
}

/// Get player science focus
/// Returns the AI's science vs military balance (0-100)
#[no_mangle]
pub unsafe extern "C" fn rust_ai_get_science_focus(data: *mut c_void) -> c_int {
    if data.is_null() {
        return 50; // Default value
    }
    let player_data = &*(data as *mut RustAIPlayerData);
    player_data.science_focus
}

/// Set player science focus
/// Adjusts AI priority between military and science (0=military, 100=science)
#[no_mangle]
pub unsafe extern "C" fn rust_ai_set_science_focus(data: *mut c_void, level: c_int) {
    if data.is_null() {
        return;
    }
    let player_data = &mut *(data as *mut RustAIPlayerData);
    player_data.science_focus = level.clamp(0, 100);
}

/// Log a message from Rust AI
/// This is a utility function for debugging
#[no_mangle]
pub unsafe extern "C" fn rust_ai_log(message: *const c_char) {
    if message.is_null() {
        return;
    }
    
    let c_str = CStr::from_ptr(message);
    if let Ok(str_slice) = c_str.to_str() {
        eprintln!("[Rust AI] {}", str_slice);
    }
}

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

/// Get version information for the Rust AI module
#[no_mangle]
pub unsafe extern "C" fn rust_ai_get_version() -> *const c_char {
    "Rust AI v0.4.0 - Phase 2: Core Logic with Game State Bindings\0".as_ptr() as *const c_char
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

// ============================================================================
// Phase 2: Decision Algorithms - AI decision-making in Rust
// ============================================================================

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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_tile_evaluation() {
        // Grassland should score higher than ocean
        let grassland_score = rust_ai_evaluate_tile(0, 0, 1);
        let ocean_score = rust_ai_evaluate_tile(0, 0, 0);
        assert!(grassland_score > ocean_score);
        
        // Hills should be valuable
        let hills_score = rust_ai_evaluate_tile(5, 5, 6);
        assert!(hills_score > 70);
    }

    #[test]
    fn test_city_placement() {
        // Good coastal location (grassland with some water)
        let coastal_score = rust_ai_evaluate_city_placement(10, 10, 1, 2, 6);
        
        // Bad location (too much water)
        let too_much_water = rust_ai_evaluate_city_placement(10, 10, 1, 7, 1);
        
        // Mountain location (very bad)
        let mountain_score = rust_ai_evaluate_city_placement(10, 10, 7, 0, 8);
        
        assert!(coastal_score > too_much_water);
        assert!(coastal_score > mountain_score);
    }

    #[test]
    fn test_unit_strength() {
        // Strong healthy unit
        let strong_unit = rust_ai_evaluate_unit_strength(10, 8, 3, 100, 100);
        
        // Same unit but wounded
        let wounded_unit = rust_ai_evaluate_unit_strength(10, 8, 3, 50, 100);
        
        // Weak unit
        let weak_unit = rust_ai_evaluate_unit_strength(2, 2, 1, 100, 100);
        
        assert!(strong_unit > wounded_unit);
        assert!(strong_unit > weak_unit);
        assert!(wounded_unit > weak_unit);
    }

    #[test]
    fn test_threat_assessment() {
        // Dangerous: many strong enemies nearby
        let high_threat = rust_ai_assess_threat(5, 50, 1, 20);
        
        // Moderate: some enemies at distance
        let medium_threat = rust_ai_assess_threat(3, 30, 5, 40);
        
        // Low: weak enemies far away
        let low_threat = rust_ai_assess_threat(1, 10, 10, 50);
        
        assert!(high_threat > medium_threat);
        assert!(medium_threat > low_threat);
        
        // Threat should be clamped to 0-100
        let clamped = rust_ai_assess_threat(100, 100, 1, 10);
        assert!(clamped <= 100);
    }

    #[test]
    fn test_player_data() {
        unsafe {
            let data = rust_ai_player_init(1);
            assert!(!data.is_null());
            
            // Test aggression get/set
            let initial = rust_ai_get_aggression(data);
            assert_eq!(initial, 50);
            
            rust_ai_set_aggression(data, 75);
            let updated = rust_ai_get_aggression(data);
            assert_eq!(updated, 75);
            
            // Test clamping
            rust_ai_set_aggression(data, 150);
            let clamped = rust_ai_get_aggression(data);
            assert_eq!(clamped, 100);
            
            // Test expansion focus
            let expansion = rust_ai_get_expansion_focus(data);
            assert_eq!(expansion, 60); // Default value
            
            rust_ai_set_expansion_focus(data, 80);
            assert_eq!(rust_ai_get_expansion_focus(data), 80);
            
            // Test science focus
            let science = rust_ai_get_science_focus(data);
            assert_eq!(science, 50); // Default value
            
            rust_ai_set_science_focus(data, 70);
            assert_eq!(rust_ai_get_science_focus(data), 70);
            
            // Test focus clamping
            rust_ai_set_science_focus(data, -10);
            assert_eq!(rust_ai_get_science_focus(data), 0);
            
            rust_ai_set_expansion_focus(data, 200);
            assert_eq!(rust_ai_get_expansion_focus(data), 100);
            
            rust_ai_player_free(data);
        }
    }
    
    #[test]
    fn test_terrain_diversity() {
        // Test various terrain types
        let ocean = rust_ai_evaluate_tile(0, 0, 0);
        let grassland = rust_ai_evaluate_tile(0, 0, 1);
        let _plains = rust_ai_evaluate_tile(0, 0, 2);
        let desert = rust_ai_evaluate_tile(0, 0, 3);
        let forest = rust_ai_evaluate_tile(0, 0, 5);
        let hills = rust_ai_evaluate_tile(0, 0, 6);
        let river = rust_ai_evaluate_tile(0, 0, 8);
        
        // Verify relative values make sense
        assert!(grassland > ocean);
        assert!(river > desert);
        assert!(hills > desert);
        assert!(forest > ocean);
    }
    
    #[test]
    fn test_tech_evaluation() {
        // Expensive tech with low value
        let expensive_tech = rust_ai_evaluate_tech(200, 10, 10, 0, 0, 0);
        
        // Cheap tech with medium value
        let cheap_tech = rust_ai_evaluate_tech(50, 20, 20, 1, 2, 0);
        
        // Tech that enables wonder (high value)
        let wonder_tech = rust_ai_evaluate_tech(100, 30, 30, 0, 1, 1);
        
        // Free tech
        let free_tech = rust_ai_evaluate_tech(0, 50, 50, 0, 0, 0);
        
        // Cheap tech should have better value per cost
        assert!(cheap_tech > expensive_tech);
        
        // Wonder-enabling tech should be high priority
        assert!(wonder_tech > expensive_tech);
        
        // Free tech should be highest priority
        assert!(free_tech > wonder_tech);
        assert!(free_tech > cheap_tech);
    }
    
    #[test]
    fn test_diplomacy_evaluation() {
        // Friendly scenario: trade partner, no wars, similar strength
        let friendly = rust_ai_evaluate_diplomacy(100, 100, 0, 0, 80, 0);
        assert!(friendly > 0);
        
        // Hostile scenario: shared borders, past wars, no trade
        let hostile = rust_ai_evaluate_diplomacy(100, 100, 1, 3, 0, 0);
        assert!(hostile < 0);
        
        // Cautious scenario: they're much stronger
        let cautious = rust_ai_evaluate_diplomacy(50, 150, 1, 0, 20, 0);
        assert!(cautious > 0); // Should be friendly due to their strength
        
        // Tech leader is valuable ally
        let tech_leader = rust_ai_evaluate_diplomacy(100, 100, 0, 0, 40, 50);
        assert!(tech_leader > 0);
        
        // All scores should be clamped to -100 to 100
        let extreme = rust_ai_evaluate_diplomacy(200, 10, 1, 10, 0, -50);
        assert!(extreme >= -100 && extreme <= 100);
    }
    
    #[test]
    fn test_trade_route_evaluation() {
        // Good trade route: large cities, short distance, railroad
        let good_route = rust_ai_evaluate_trade_route(10, 12, 5, 20, 30, 2);
        
        // Poor route: small cities, long distance, no connection
        let poor_route = rust_ai_evaluate_trade_route(3, 4, 30, 0, 0, 0);
        
        // Sea route: medium cities, good distance, sea connection
        let sea_route = rust_ai_evaluate_trade_route(8, 8, 15, 10, 10, 4);
        
        assert!(good_route > poor_route);
        assert!(sea_route > poor_route);
        
        // Verify trade value is positive
        assert!(good_route > 0);
    }
    
    #[test]
    fn test_production_optimization() {
        // High military need - should recommend unit (0)
        let military = rust_ai_optimize_production(2, 10, 15, 8, 80, 30, 40);
        assert_eq!(military, 0);
        
        // Small city with low infrastructure - should recommend building (1)
        let small_city = rust_ai_optimize_production(1, 5, 5, 3, 20, 40, 70);
        assert_eq!(small_city, 1);
        
        // Large city with good food - should allow settler (2)
        let settler_city = rust_ai_optimize_production(5, 8, 20, 8, 10, 90, 20);
        assert_eq!(settler_city, 2);
        
        // High production large city - should allow wonder (3)
        let wonder_city = rust_ai_optimize_production(3, 20, 25, 10, 20, 30, 35);
        assert_eq!(wonder_city, 3);
    }
    
    #[test]
    fn test_battle_prediction() {
        // Equal strength units - should be close to 50%
        let equal = rust_ai_predict_battle(10, 100, 1, 10, 100, 1, 0);
        assert!(equal >= 45 && equal <= 55);
        
        // Attacker much stronger - high win chance
        let strong_attacker = rust_ai_predict_battle(20, 100, 1, 10, 100, 1, 0);
        assert!(strong_attacker > 60);
        
        // Defender has terrain bonus - defender advantage
        let terrain_bonus = rust_ai_predict_battle(10, 100, 1, 10, 100, 1, 50);
        assert!(terrain_bonus < 50);
        
        // Wounded attacker - lower win chance
        let wounded = rust_ai_predict_battle(15, 50, 1, 10, 100, 1, 0);
        let healthy = rust_ai_predict_battle(15, 100, 1, 10, 100, 1, 0);
        assert!(wounded < healthy);
        
        // High firepower attacker
        let firepower = rust_ai_predict_battle(10, 100, 3, 10, 100, 1, 0);
        assert!(firepower > 60);
        
        // Dead attacker (0 HP) - should have 0% win chance
        let dead_attacker = rust_ai_predict_battle(10, 0, 1, 10, 100, 1, 0);
        assert_eq!(dead_attacker, 0);
        
        // Dead defender (0 HP) - should have 100% win chance
        let dead_defender = rust_ai_predict_battle(10, 100, 1, 10, 0, 1, 0);
        assert_eq!(dead_defender, 100);
        
        // Both dead - should be 50% (edge case)
        let both_dead = rust_ai_predict_battle(10, 0, 1, 10, 0, 1, 0);
        assert_eq!(both_dead, 50);
        
        // Win probability should be 0-100
        assert!(strong_attacker >= 0 && strong_attacker <= 100);
    }
    
    #[test]
    fn test_specialist_evaluation() {
        // High science priority - should recommend scientist (1)
        let science_focus = rust_ai_evaluate_specialist(1, 2, 80, 20, 2);
        assert_eq!(science_focus, 1);
        
        // High tax priority - should recommend taxman (2)
        let tax_focus = rust_ai_evaluate_specialist(1, 2, 20, 90, 3);
        assert_eq!(tax_focus, 2);
        
        // Critical food need - no specialists (0)
        let food_critical = rust_ai_evaluate_specialist(8, 2, 50, 50, 2);
        assert_eq!(food_critical, 0);
        
        // No available citizens - no specialists (0)
        let no_citizens = rust_ai_evaluate_specialist(1, 1, 80, 20, 0);
        assert_eq!(no_citizens, 0);
        
        // Balanced priorities - entertainer should win (score 30 vs 40 each for science/tax)
        // But since science_priority and tax_priority are both 40, one of them will win
        let balanced = rust_ai_evaluate_specialist(2, 3, 40, 40, 1);
        assert!(balanced == 1 || balanced == 2); // Should be scientist or taxman
    }
    
    #[test]
    fn test_city_build_order() {
        // First city, early game - should build granary (0)
        let capital_early = rust_ai_city_build_order(1, 10, 0, 0);
        assert_eq!(capital_early, 0);
        
        // Enemy threat - should build defensive structures
        let under_threat = rust_ai_city_build_order(0, 30, 4, 0);
        assert_eq!(under_threat, 4); // Walls
        
        let minor_threat = rust_ai_city_build_order(0, 30, 1, 0);
        assert_eq!(minor_threat, 1); // Barracks
        
        // Coastal city early game - marketplace (2)
        let coastal_early = rust_ai_city_build_order(0, 40, 0, 1);
        assert_eq!(coastal_early, 2);
        
        // Mid game - library for science (3)
        let mid_game = rust_ai_city_build_order(0, 80, 0, 0);
        assert_eq!(mid_game, 3);
        
        // Late game - marketplace (2)
        let late_game = rust_ai_city_build_order(0, 200, 0, 0);
        assert_eq!(late_game, 2);
    }
    
    #[test]
    fn test_version_update() {
        unsafe {
            let version = rust_ai_get_version();
            let c_str = CStr::from_ptr(version);
            let version_str = c_str.to_str().unwrap();
            // Should contain the new version number
            assert!(version_str.contains("0.4.0"));
        }
    }
    
    // ============================================================================
    // Phase 2 Tests: Game State Bindings and Decision Algorithms
    // ============================================================================
    
    #[test]
    fn test_city_production_decision() {
        let city = RustCity {
            city_id: 1,
            owner_id: 1,
            x: 10,
            y: 10,
            population: 5,
            food_surplus: 3,
            shield_surplus: 8,
            trade_production: 5,
            science_output: 3,
            gold_output: 2,
            luxury_output: 1,
            is_coastal: 0,
            turn_founded: 1,
        };
        
        // Under attack - should build military
        let under_attack = rust_ai_decide_city_production(&city, 3, 2, 30);
        assert_eq!(under_attack, 1);
        
        // Early game with good food - should build settler
        let early_expansion = rust_ai_decide_city_production(&city, 0, 5, 40);
        assert_eq!(early_expansion, 0);
        
        // Large city with high production - could build wonder
        let mut wonder_city = city;
        wonder_city.shield_surplus = 20;
        wonder_city.population = 10;
        let wonder_build = rust_ai_decide_city_production(&wonder_city, 0, 8, 100);
        assert_eq!(wonder_build, 3);
    }
    
    #[test]
    fn test_unit_move_evaluation() {
        let unit = RustUnit {
            unit_id: 1,
            owner_id: 1,
            x: 10,
            y: 10,
            attack_strength: 5,
            defense_strength: 3,
            movement_points: 3,
            moves_left: 2,
            hitpoints: 80,
            max_hitpoints: 100,
            firepower: 1,
            veteran_level: 1,
            is_military: 1,
        };
        
        let target_tile = RustTile {
            x: 11,
            y: 11,
            terrain_type: 2, // Plains
            has_river: 0,
            has_road: 1,
            has_railroad: 0,
            owner_id: 1,
            worked_by_city_id: -1,
        };
        
        // Military unit moving to strategic location with enemies
        let combat_move = rust_ai_evaluate_unit_move(&unit, &target_tile, 1, 50);
        assert!(combat_move > 0);
        
        // Civilian unit should avoid enemies
        let mut civilian = unit;
        civilian.is_military = 0;
        let civilian_move = rust_ai_evaluate_unit_move(&civilian, &target_tile, 1, 50);
        assert!(civilian_move < combat_move); // Should score lower due to enemies
        
        // No movement points left
        let mut tired_unit = unit;
        tired_unit.moves_left = 0;
        let no_move = rust_ai_evaluate_unit_move(&tired_unit, &target_tile, 0, 50);
        assert_eq!(no_move, 0);
    }
    
    #[test]
    fn test_attack_evaluation() {
        let attacker = RustUnit {
            unit_id: 1,
            owner_id: 1,
            x: 10,
            y: 10,
            attack_strength: 10,
            defense_strength: 5,
            movement_points: 3,
            moves_left: 2,
            hitpoints: 90,
            max_hitpoints: 100,
            firepower: 1,
            veteran_level: 2,
            is_military: 1,
        };
        
        let weak_defender = RustUnit {
            unit_id: 2,
            owner_id: 2,
            x: 11,
            y: 11,
            attack_strength: 3,
            defense_strength: 5,
            movement_points: 1,
            moves_left: 1,
            hitpoints: 50,
            max_hitpoints: 100,
            firepower: 1,
            veteran_level: 0,
            is_military: 1,
        };
        
        // Strong attacker vs weak defender - should recommend attack
        let favorable = rust_ai_evaluate_attack(&attacker, &weak_defender, 0, 1);
        assert!(favorable > 0);
        
        // Wounded attacker shouldn't attack
        let mut wounded = attacker;
        wounded.hitpoints = 25;
        let wounded_attack = rust_ai_evaluate_attack(&wounded, &weak_defender, 0, 0);
        assert_eq!(wounded_attack, 0);
        
        // Strong defender with terrain bonus
        let mut strong_defender = weak_defender;
        strong_defender.defense_strength = 15;
        strong_defender.hitpoints = 100;
        let unfavorable = rust_ai_evaluate_attack(&attacker, &strong_defender, 50, 0);
        // Should be cautious or refuse
        assert!(unfavorable <= 1);
    }
    
    #[test]
    fn test_settle_location_evaluation() {
        let settler = RustUnit {
            unit_id: 1,
            owner_id: 1,
            x: 10,
            y: 10,
            attack_strength: 0,
            defense_strength: 1,
            movement_points: 1,
            moves_left: 1,
            hitpoints: 20,
            max_hitpoints: 20,
            firepower: 0,
            veteran_level: 0,
            is_military: 0,
        };
        
        let good_tile = RustTile {
            x: 15,
            y: 15,
            terrain_type: 1, // Grassland
            has_river: 1,
            has_road: 0,
            has_railroad: 0,
            owner_id: -1, // Unclaimed
            worked_by_city_id: -1,
        };
        
        // Good location with resources, no nearby cities
        let excellent = rust_ai_evaluate_settle_location(&settler, &good_tile, 0, 80);
        assert!(excellent > 100);
        
        // Too close to existing city
        let too_close = rust_ai_evaluate_settle_location(&settler, &good_tile, 2, 80);
        assert_eq!(too_close, 0);
        
        // Enemy territory
        let mut enemy_tile = good_tile;
        enemy_tile.owner_id = 2;
        let enemy_land = rust_ai_evaluate_settle_location(&settler, &enemy_tile, 0, 80);
        assert!(enemy_land < excellent);
    }
    
    #[test]
    fn test_city_growth_strategy() {
        let small_city = RustCity {
            city_id: 1,
            owner_id: 1,
            x: 10,
            y: 10,
            population: 3,
            food_surplus: 2,
            shield_surplus: 3,
            trade_production: 2,
            science_output: 1,
            gold_output: 1,
            luxury_output: 0,
            is_coastal: 0,
            turn_founded: 1,
        };
        
        // Small city should focus on growth
        let grow = rust_ai_city_growth_strategy(&small_city, 0, 0);
        assert_eq!(grow, 0);
        
        // City at starvation risk
        let starving = rust_ai_city_growth_strategy(&small_city, 0, 1);
        assert_eq!(starving, 0);
        
        // Large city at population cap
        let mut large_city = small_city;
        large_city.population = 12;
        large_city.shield_surplus = 15;
        let capped = rust_ai_city_growth_strategy(&large_city, 12, 0);
        assert!(capped == 1 || capped == 2); // Production or wealth
        
        // Large city with low production
        let mut low_prod = large_city;
        low_prod.shield_surplus = 5;
        let need_prod = rust_ai_city_growth_strategy(&low_prod, 20, 0);
        assert_eq!(need_prod, 1);
    }
    
    #[test]
    fn test_game_state_structs() {
        // Test that structs can be created and accessed
        let tile = RustTile {
            x: 5,
            y: 10,
            terrain_type: 1,
            has_river: 1,
            has_road: 0,
            has_railroad: 0,
            owner_id: 1,
            worked_by_city_id: 2,
        };
        assert_eq!(tile.x, 5);
        assert_eq!(tile.y, 10);
        assert_eq!(tile.has_river, 1);
        
        let unit = RustUnit {
            unit_id: 10,
            owner_id: 1,
            x: 20,
            y: 30,
            attack_strength: 8,
            defense_strength: 6,
            movement_points: 3,
            moves_left: 2,
            hitpoints: 75,
            max_hitpoints: 100,
            firepower: 1,
            veteran_level: 1,
            is_military: 1,
        };
        assert_eq!(unit.unit_id, 10);
        assert_eq!(unit.attack_strength, 8);
        
        let city = RustCity {
            city_id: 5,
            owner_id: 1,
            x: 15,
            y: 20,
            population: 7,
            food_surplus: 3,
            shield_surplus: 10,
            trade_production: 8,
            science_output: 5,
            gold_output: 6,
            luxury_output: 2,
            is_coastal: 1,
            turn_founded: 10,
        };
        assert_eq!(city.city_id, 5);
        assert_eq!(city.population, 7);
        assert_eq!(city.is_coastal, 1);
    }
}
