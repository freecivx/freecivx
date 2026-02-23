//! Settler and expansion AI - based on ai/default/daisettler.c
//! 
//! Handles settler automation, city founding decisions, and expansion strategy.
//! Hard mode: Aggressive expansion (100% expansion focus)

use std::os::raw::c_int;
use crate::data_structures::{RustUnit, RustTile};
use crate::evaluation::rust_ai_evaluate_tile;

/// Evaluate settler action priority
/// Returns: 0=move_to_target, 1=found_city, 2=wait, 3=return_home
#[no_mangle]
pub extern "C" fn rust_ai_settler_action(
    settler: &RustUnit,
    current_tile: &RustTile,
    city_site_quality: c_int,
    distance_to_best_site: c_int,
    num_cities: c_int,
) -> c_int {
    // If we're on a good site and don't have too many cities nearby, found city
    if city_site_quality >= 70 {
        return 1; // Found city here
    }
    
    // If there's a better site nearby, move to it
    if distance_to_best_site > 0 && distance_to_best_site <= settler.moves_left {
        return 0; // Move to target
    }
    
    // Early game: more aggressive settling even on mediocre sites
    if num_cities < 5 && city_site_quality >= 50 {
        return 1; // Found city
    }
    
    // If settler is threatened or far from good sites, return home
    if current_tile.owner_id >= 0 && current_tile.owner_id != settler.owner_id {
        return 3; // Return home (enemy territory)
    }
    
    // Default: keep searching
    if distance_to_best_site > 0 {
        0 // Move to target
    } else {
        2 // Wait for better analysis
    }
}

/// Calculate expansion desire (hard mode: always high)
/// Returns expansion priority 0-100
#[no_mangle]
pub extern "C" fn rust_ai_expansion_desire(
    num_cities: c_int,
    num_settlers: c_int,
    available_good_sites: c_int,
    game_turn: c_int,
) -> c_int {
    // Hard mode: 100% expansion focus (from difficulty.c)
    let mut desire = 100;
    
    // Reduce if we already have many settlers in production
    if num_settlers > num_cities / 2 {
        desire = desire * 70 / 100;
    }
    
    // Reduce if no good sites available
    if available_good_sites == 0 {
        desire = desire / 3;
    }
    
    // Early game: maximum expansion
    if game_turn < 50 {
        desire = desire.min(100);
    }
    
    // Late game: still expand but more cautiously
    if game_turn > 200 && num_cities > 20 {
        desire = desire * 80 / 100;
    }
    
    desire.clamp(0, 100)
}

/// Evaluate city founding site quality
/// Comprehensive evaluation based on tile yields and strategic position
#[no_mangle]
pub extern "C" fn rust_ai_evaluate_founding_site(
    tile: &RustTile,
    nearby_food: c_int,
    nearby_production: c_int,
    nearby_trade: c_int,
    nearby_cities_count: c_int,
    distance_to_enemy: c_int,
) -> c_int {
    // Already owned by someone else: immediate disqualification
    if tile.owner_id >= 0 {
        return 0;
    }
    
    // Don't found too close to existing cities
    if nearby_cities_count > 1 {
        return 0;
    }
    
    // Base tile quality
    let mut score = rust_ai_evaluate_tile(tile.x, tile.y, tile.terrain_type);
    
    // Nearby resources are crucial
    score += nearby_food * 15;
    score += nearby_production * 12;
    score += nearby_trade * 8;
    
    // River bonus
    if tile.has_river > 0 {
        score += 50;
    }
    
    // Penalty for one nearby city (prefer spacing)
    if nearby_cities_count == 1 {
        score -= 30;
    }
    
    // Strategic position: not too close to enemy
    if distance_to_enemy > 0 && distance_to_enemy < 5 {
        score -= 40; // Risky border location
    } else if distance_to_enemy >= 5 && distance_to_enemy <= 10 {
        score += 20; // Good forward position
    }
    
    score.max(0).min(100)
}

/// Calculate worker (automated worker unit) priority
/// Returns priority for building workers: 0-100
#[no_mangle]
pub extern "C" fn rust_ai_worker_need(
    num_cities: c_int,
    num_workers: c_int,
    unimproved_tiles: c_int,
    expansion_focus: c_int,
) -> c_int {
    // Base ratio: ~1 worker per 2 cities
    let desired_workers = num_cities / 2 + 1;
    
    if num_workers >= desired_workers {
        return 0; // Have enough workers
    }
    
    let mut need = (desired_workers - num_workers) * 30;
    
    // More need if many tiles need improvement
    need += unimproved_tiles * 5;
    
    // Expansion focus increases worker need (to improve new cities)
    need = (need * (100 + expansion_focus)) / 100;
    
    need.clamp(0, 100)
}

/// Determine settler target location selection strategy
/// Returns: 0=nearest_good, 1=best_overall, 2=forward_expansion, 3=backfill
#[no_mangle]
pub extern "C" fn rust_ai_settler_target_strategy(
    num_cities: c_int,
    military_strength: c_int,
    enemy_threat_level: c_int,
) -> c_int {
    // Under threat: backfill (settle safe areas)
    if enemy_threat_level > 70 {
        return 3; // Backfill
    }
    
    // Strong military: forward expansion
    if military_strength > 100 && num_cities >= 5 {
        return 2; // Forward expansion
    }
    
    // Early game: nearest good site (fast expansion)
    if num_cities < 8 {
        return 0; // Nearest good
    }
    
    // Default: best overall quality
    1
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::data_structures::{RustUnit, RustTile};
    
    #[test]
    fn test_settler_action() {
        let settler = RustUnit {
            unit_id: 1,
            owner_id: 0,
            x: 10,
            y: 10,
            attack_strength: 0,
            defense_strength: 10,
            movement_points: 3,
            moves_left: 3,
            hitpoints: 100,
            max_hitpoints: 100,
            firepower: 1,
            veteran_level: 0,
            is_military: 0,
        };
        
        let tile = RustTile {
            x: 10,
            y: 10,
            terrain_type: 1,
            has_river: 1,
            has_road: 0,
            has_railroad: 0,
            owner_id: -1,
            worked_by_city_id: -1,
        };
        
        // Good site: should found city
        assert_eq!(rust_ai_settler_action(&settler, &tile, 80, 5, 3), 1);
        
        // Mediocre site with better site nearby: should move
        assert_eq!(rust_ai_settler_action(&settler, &tile, 40, 2, 10), 0);
    }
    
    #[test]
    fn test_expansion_desire() {
        // Hard mode: high expansion desire
        let desire = rust_ai_expansion_desire(5, 1, 10, 30);
        assert!(desire >= 80);
        
        // Too many settlers already: lower desire
        let desire2 = rust_ai_expansion_desire(5, 4, 10, 30);
        assert!(desire2 < desire);
    }
    
    #[test]
    fn test_founding_site_quality() {
        const DIFFERENT_OWNER: c_int = 5; // A different player ID for testing
        
        let good_tile = RustTile {
            x: 20,
            y: 20,
            terrain_type: 1, // Grassland
            has_river: 1,
            has_road: 0,
            has_railroad: 0,
            owner_id: -1,
            worked_by_city_id: -1,
        };
        
        let score = rust_ai_evaluate_founding_site(&good_tile, 10, 8, 5, 0, 15);
        assert!(score > 60);
        
        // Already owned by another player: should return 0 (see line 95-97)
        let mut owned_tile = good_tile.clone();
        owned_tile.owner_id = DIFFERENT_OWNER;
        let bad_score = rust_ai_evaluate_founding_site(&owned_tile, 10, 8, 5, 0, 15);
        
        // Implementation returns 0 for owned tiles
        assert_eq!(bad_score, 0, "Owned tiles should be disqualified (score=0)");
    }
    
    #[test]
    fn test_worker_need() {
        // Need workers for new cities
        let need = rust_ai_worker_need(10, 2, 20, 100);
        assert!(need > 50);
        
        // Have enough workers
        let no_need = rust_ai_worker_need(10, 6, 5, 100);
        assert_eq!(no_need, 0);
    }
}
