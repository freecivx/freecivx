//! Military AI module - based on ai/default/daimilitary.c
//! 
//! Handles danger assessment, defense evaluation, and military production decisions.
//! This module implements the hard mode AI strategy with aggressive military planning.

use std::os::raw::c_int;
use crate::data_structures::RustCity;

// Constants from daimilitary.h
const FINISH_HIM_CITY_COUNT: c_int = 5;
const ASSESS_DANGER_MAX_DISTANCE: c_int = 40;

// Military emergency thresholds (not currently used in FFI but part of C AI logic)
#[allow(dead_code)]
const DAI_WANT_BELOW_MIL_EMERGENCY: f64 = 1000.0;
#[allow(dead_code)]
const DAI_WANT_MILITARY_EMERGENCY: f64 = 1000.1;

/// Assess danger level for a city (based on dai_assess_danger_player)
/// Returns danger score (higher means more dangerous)
/// 
/// Hard mode: Full map awareness, no distance limits
#[no_mangle]
pub extern "C" fn rust_ai_assess_city_danger(
    city: &RustCity,
    enemy_units_nearby: c_int,
    enemy_avg_strength: c_int,
    closest_enemy_distance: c_int,
) -> c_int {
    let mut danger = 0;
    
    // Base danger from nearby enemies (hard mode: no handicap)
    danger += enemy_units_nearby * enemy_avg_strength;
    
    // Distance modifier - closer enemies are more dangerous
    if closest_enemy_distance > 0 && closest_enemy_distance <= ASSESS_DANGER_MAX_DISTANCE {
        let distance_factor = (ASSESS_DANGER_MAX_DISTANCE - closest_enemy_distance) * 10 
            / ASSESS_DANGER_MAX_DISTANCE;
        danger = (danger * (100 + distance_factor)) / 100;
    }
    
    // Small cities are more vulnerable
    if city.population < 4 {
        danger = (danger * 150) / 100;
    }
    
    // Coastal cities face additional naval threats
    if city.is_coastal > 0 {
        danger = (danger * 120) / 100;
    }
    
    danger
}

/// Evaluate city defense strength (based on assess_defense_quadratic)
/// Returns defensive capability score
#[no_mangle]
pub extern "C" fn rust_ai_assess_defense(
    city: &RustCity,
    num_defenders: c_int,
    avg_defender_strength: c_int,
    has_walls: c_int,
) -> c_int {
    let mut defense = num_defenders * avg_defender_strength;
    
    // City walls provide significant defensive bonus
    if has_walls > 0 {
        defense = (defense * 200) / 100;
    }
    
    // Larger cities have better defensive positions
    let size_bonus = city.population * 5;
    defense += size_bonus;
    
    // Production capacity helps maintain defense
    if city.shield_surplus > 10 {
        defense += 50;
    }
    
    defense
}

/// Decide if city needs emergency military production
/// Returns: 0=no emergency, 1=build defenders, 2=critical emergency
#[no_mangle]
pub extern "C" fn rust_ai_military_emergency(
    danger: c_int,
    defense: c_int,
    city_population: c_int,
) -> c_int {
    if danger == 0 {
        return 0; // No threat
    }
    
    // Critical emergency: danger far exceeds defense
    if danger > defense * 2 {
        return 2;
    }
    
    // Standard emergency: danger exceeds defense
    if danger > defense {
        return 1;
    }
    
    // Vulnerable small cities need precautionary defense
    if city_population < 3 && danger > defense / 2 {
        return 1;
    }
    
    0 // No emergency
}

/// Calculate military want/need score for a city
/// Based on the wants system from C AI
#[no_mangle]
pub extern "C" fn rust_ai_military_want(
    danger: c_int,
    defense: c_int,
    invasion_threat: c_int,
    enemy_cities_remaining: c_int,
) -> c_int {
    let mut want = 0;
    
    // Base want from danger vs defense
    if danger > defense {
        want = danger - defense;
    }
    
    // Invasion threat increases military need
    want += invasion_threat * 10;
    
    // Aggressive stance when enemy is weak (finish him!)
    if enemy_cities_remaining > 0 && enemy_cities_remaining <= FINISH_HIM_CITY_COUNT {
        want = (want * 150) / 100;
    }
    
    // Emergency threshold (from DAI_WANT_MILITARY_EMERGENCY)
    if want > 1000 {
        want = 1000 + (want - 1000) / 10; // Diminishing returns after emergency level
    }
    
    want
}

/// Choose unit type priority for military production
/// Returns: 0=defender, 1=attacker, 2=ranged, 3=special
#[no_mangle]
pub extern "C" fn rust_ai_choose_military_unit_type(
    danger: c_int,
    defense: c_int,
    offensive_campaign: c_int,
    has_enemies_nearby: c_int,
) -> c_int {
    // Immediate danger: build defenders
    if danger > defense {
        return 0; // Defender
    }
    
    // Offensive campaign: build attackers
    if offensive_campaign > 0 {
        return 1; // Attacker
    }
    
    // Enemies nearby but not immediate threat: balanced mix
    if has_enemies_nearby > 0 {
        // Alternate between defenders and attackers
        return if danger % 2 == 0 { 0 } else { 1 };
    }
    
    // Peaceful times: build some offensive units for opportunistic attacks
    1 // Attacker
}

/// Assess whether to launch an attack (hard mode: aggressive)
/// Returns: 0=no attack, 1=prepare, 2=attack now
#[no_mangle]
pub extern "C" fn rust_ai_should_attack(
    our_military_strength: c_int,
    enemy_military_strength: c_int,
    enemy_cities_count: c_int,
    _our_cities_count: c_int,
) -> c_int {
    // Hard mode: aggressive when we have advantage
    let strength_ratio = if enemy_military_strength > 0 {
        (our_military_strength * 100) / enemy_military_strength
    } else {
        200 // Enemy has no military
    };
    
    // Finish weak enemies
    if enemy_cities_count <= FINISH_HIM_CITY_COUNT && strength_ratio >= 100 {
        return 2; // Attack now
    }
    
    // Strong advantage: attack
    if strength_ratio >= 150 {
        return 2; // Attack now
    }
    
    // Moderate advantage: prepare for attack
    if strength_ratio >= 120 {
        return 1; // Prepare
    }
    
    // Not strong enough yet
    0
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::data_structures::RustCity;
    
    #[test]
    fn test_danger_assessment() {
        let city = RustCity {
            city_id: 1,
            owner_id: 0,
            x: 10,
            y: 10,
            population: 5,
            food_surplus: 2,
            shield_surplus: 5,
            trade_production: 3,
            science_output: 4,
            gold_output: 2,
            luxury_output: 1,
            is_coastal: 0,
            turn_founded: 1,
        };
        
        let danger = rust_ai_assess_city_danger(&city, 3, 20, 2);
        assert!(danger > 0);
        
        // Closer enemies should be more dangerous
        let danger_close = rust_ai_assess_city_danger(&city, 3, 20, 1);
        let danger_far = rust_ai_assess_city_danger(&city, 3, 20, 10);
        assert!(danger_close > danger_far);
    }
    
    #[test]
    fn test_defense_assessment() {
        let city = RustCity {
            city_id: 1,
            owner_id: 0,
            x: 10,
            y: 10,
            population: 8,
            food_surplus: 2,
            shield_surplus: 12,
            trade_production: 3,
            science_output: 4,
            gold_output: 2,
            luxury_output: 1,
            is_coastal: 0,
            turn_founded: 1,
        };
        
        let defense_no_walls = rust_ai_assess_defense(&city, 2, 30, 0);
        let defense_with_walls = rust_ai_assess_defense(&city, 2, 30, 1);
        
        assert!(defense_with_walls > defense_no_walls);
    }
    
    #[test]
    fn test_military_emergency() {
        assert_eq!(rust_ai_military_emergency(100, 200, 5), 0); // No emergency
        assert_eq!(rust_ai_military_emergency(150, 100, 5), 1); // Standard emergency
        assert_eq!(rust_ai_military_emergency(300, 100, 5), 2); // Critical emergency
    }
    
    #[test]
    fn test_aggressive_attack_decision() {
        // Should attack when much stronger
        assert_eq!(rust_ai_should_attack(300, 100, 10, 15), 2);
        
        // Should finish weak enemies
        assert_eq!(rust_ai_should_attack(100, 90, 3, 10), 2);
        
        // Not strong enough
        assert_eq!(rust_ai_should_attack(100, 110, 10, 10), 0);
    }
}
