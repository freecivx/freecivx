//! Rust AI module for Freeciv
//! 
//! This module provides AI functionality for Freeciv using Rust.
//! It is organized into multiple logical modules for better maintainability.
//! 
//! Architecture mirrors the C Default AI (ai/default/):
//! - military.rs (daimilitary.c) - Danger assessment, defense, military production
//! - city_management.rs (daicity.c) - City AI decisions and management
//! - settler.rs (daisettler.c) - Expansion and settler logic
//! - wants.rs (adv_want system) - Desire-based decision scoring
//! - diplomacy.rs (daidiplomacy.c) - Diplomatic AI decisions
//! - evaluation.rs - Tile and unit evaluation functions
//! - planning.rs - Production and battle planning
//! - decision.rs - High-level decision algorithms
//! - player_management.rs - Player data structures
//! - data_structures.rs - Game state structures

// Core modules (new Phase 3: C AI alignment)
pub mod military;
pub mod city_management;
pub mod settler;
pub mod wants;
pub mod diplomacy;

// Existing modules (Phase 1 & 2)
pub mod data_structures;
pub mod player_management;
pub mod evaluation;
pub mod planning;
pub mod decision;
pub mod logging;

// Re-export commonly used items
pub use data_structures::*;
pub use player_management::*;
pub use evaluation::*;
pub use planning::*;
pub use decision::*;
pub use logging::*;

// Re-export new C AI-aligned modules
pub use military::*;
pub use city_management::*;
pub use settler::*;
pub use wants::*;
pub use diplomacy::*;

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
        let sea_route = rust_ai_evaluate_trade_route(8, 8, 10, 15, 15, 4);
        
        assert!(good_route > poor_route);
        assert!(sea_route > poor_route);
        
        // Distance penalty should apply
        let close_route = rust_ai_evaluate_trade_route(5, 5, 2, 10, 10, 1);
        let far_route = rust_ai_evaluate_trade_route(5, 5, 20, 10, 10, 1);
        assert!(close_route > far_route);
    }
    
    #[test]
    fn test_production_optimization() {
        // Emergency military need
        let military = rust_ai_optimize_production(2, 10, 5, 8, 90, 50, 20);
        assert_eq!(military, 0); // Build unit
        
        // High growth priority with good food and high science
        let settler = rust_ai_optimize_production(5, 12, 15, 10, 20, 80, 30);
        assert_eq!(settler, 2); // Build settler
        
        // High infrastructure need
        let building = rust_ai_optimize_production(2, 8, 6, 6, 30, 40, 80);
        assert_eq!(building, 1); // Build building
        
        // High production city with low infrastructure need
        let wonder = rust_ai_optimize_production(3, 20, 15, 10, 20, 30, 20);
        assert_eq!(wonder, 3); // Build wonder
    }
    
    #[test]
    fn test_battle_prediction() {
        // Even match
        let even = rust_ai_predict_battle(10, 100, 1, 10, 100, 1, 0);
        assert!(even >= 45 && even <= 55); // Should be close to 50%
        
        // Strong attacker
        let strong_attack = rust_ai_predict_battle(15, 100, 1, 8, 100, 1, 0);
        assert!(strong_attack > 60);
        
        // Weak attacker
        let weak_attack = rust_ai_predict_battle(8, 100, 1, 15, 100, 1, 0);
        assert!(weak_attack < 40);
        
        // Terrain bonus helps defender
        let with_terrain = rust_ai_predict_battle(10, 100, 1, 10, 100, 1, 50);
        assert!(with_terrain < even);
        
        // Wounded attacker
        let wounded = rust_ai_predict_battle(10, 50, 1, 10, 100, 1, 0);
        assert!(wounded < even);
    }
    
    #[test]
    fn test_specialist_allocation() {
        // High science priority
        let scientist = rust_ai_evaluate_specialist(2, 5, 80, 20, 2);
        assert_eq!(scientist, 1);
        
        // High tax priority
        let taxman = rust_ai_evaluate_specialist(2, 5, 20, 80, 2);
        assert_eq!(taxman, 2);
        
        // Need food/shields - no specialists
        let none = rust_ai_evaluate_specialist(10, 15, 50, 50, 2);
        assert_eq!(none, 0);
        
        // No available citizens
        let no_citizens = rust_ai_evaluate_specialist(2, 5, 80, 20, 0);
        assert_eq!(no_citizens, 0);
    }
    
    #[test]
    fn test_city_build_order() {
        // First city, early game
        let first_city = rust_ai_city_build_order(1, 10, 0, 0);
        assert_eq!(first_city, 0); // Granary
        
        // Military threat
        let threatened = rust_ai_city_build_order(0, 30, 3, 0);
        assert_eq!(threatened, 4); // Walls
        
        // Coastal city early game
        let coastal = rust_ai_city_build_order(0, 30, 0, 1);
        assert_eq!(coastal, 2); // Marketplace
        
        // Mid game
        let mid_game = rust_ai_city_build_order(0, 75, 0, 0);
        assert_eq!(mid_game, 3); // Library
    }
    
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
        
        // Immediate threat
        let threat = rust_ai_decide_city_production(&city, 5, 3, 30);
        assert_eq!(threat, 1); // Military units
        
        // Early game with good food
        let early = rust_ai_decide_city_production(&city, 0, 4, 30);
        assert_eq!(early, 0); // Settler
        
        // High production wonder city
        let mut wonder_city = city;
        wonder_city.shield_surplus = 20;
        wonder_city.population = 10;
        let wonder = rust_ai_decide_city_production(&wonder_city, 0, 8, 100);
        assert_eq!(wonder, 3); // Wonder
    }
    
    #[test]
    fn test_unit_movement_evaluation() {
        let unit = RustUnit {
            unit_id: 1,
            owner_id: 1,
            x: 10,
            y: 10,
            attack_strength: 8,
            defense_strength: 6,
            movement_points: 3,
            moves_left: 3,
            hitpoints: 80,
            max_hitpoints: 100,
            firepower: 1,
            veteran_level: 1,
            is_military: 1,
        };
        
        let tile = RustTile {
            x: 11,
            y: 11,
            terrain_type: 1,
            has_river: 0,
            has_road: 1,
            has_railroad: 0,
            owner_id: 1,
            worked_by_city_id: -1,
        };
        
        // Good move: nearby, strategic, has enemies, healthy unit
        let good_move = rust_ai_evaluate_unit_move(&unit, &tile, 1, 50);
        assert!(good_move > 50);
        
        // Bad move: too far
        let mut far_tile = tile;
        far_tile.x = 20;
        let too_far = rust_ai_evaluate_unit_move(&unit, &far_tile, 0, 50);
        assert_eq!(too_far, 0);
        
        // No moves left
        let mut tired_unit = unit;
        tired_unit.moves_left = 0;
        let no_moves = rust_ai_evaluate_unit_move(&tired_unit, &tile, 0, 50);
        assert_eq!(no_moves, 0);
    }
    
    #[test]
    fn test_attack_evaluation() {
        let attacker = RustUnit {
            unit_id: 1,
            owner_id: 1,
            x: 10,
            y: 10,
            attack_strength: 12,
            defense_strength: 6,
            movement_points: 3,
            moves_left: 2,
            hitpoints: 90,
            max_hitpoints: 100,
            firepower: 1,
            veteran_level: 2,
            is_military: 1,
        };
        
        let defender = RustUnit {
            unit_id: 2,
            owner_id: 2,
            x: 11,
            y: 11,
            attack_strength: 6,
            defense_strength: 8,
            movement_points: 2,
            moves_left: 0,
            hitpoints: 100,
            max_hitpoints: 100,
            firepower: 1,
            veteran_level: 0,
            is_military: 1,
        };
        
        // Strong attacker should attack
        let should_attack = rust_ai_evaluate_attack(&attacker, &defender, 0, 1);
        assert!(should_attack > 0);
        
        // Wounded attacker should not attack
        let mut wounded = attacker;
        wounded.hitpoints = 25;
        let too_weak = rust_ai_evaluate_attack(&wounded, &defender, 0, 0);
        assert_eq!(too_weak, 0);
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
            hitpoints: 100,
            max_hitpoints: 100,
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
        
        // Excellent location: grassland, river, no nearby cities, good resources
        let excellent = rust_ai_evaluate_settle_location(&settler, &good_tile, 0, 80);
        assert!(excellent > 100);
        
        // Too close to existing cities
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
