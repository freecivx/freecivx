//! Wants system - based on C AI's adv_want scoring
//! 
//! The wants system is central to C AI decision making. It calculates
//! desire scores for various actions (building units, improvements, wonders, etc.)

use std::os::raw::c_int;

/// Type for want/desire scores (using integer for FFI compatibility)
/// In C AI this is adv_want (float), we scale by 100 for integer representation
pub type WantScore = c_int;

/// Minimum want score that indicates any interest
pub const WANT_MINIMUM: WantScore = 1;

/// Want score for emergency situations
pub const WANT_EMERGENCY: WantScore = 100000;

/// Calculate want score for building a unit
/// Based on military need, production capacity, and strategic value
#[no_mangle]
pub extern "C" fn rust_ai_want_unit(
    military_need: c_int,
    unit_strength: c_int,
    unit_cost: c_int,
    city_production: c_int,
) -> WantScore {
    if unit_cost <= 0 {
        return 0;
    }
    
    // Base want from military need
    let mut want = military_need * 100;
    
    // Efficiency factor: stronger units per cost are more desirable
    let efficiency = (unit_strength * 1000) / unit_cost;
    want = (want * efficiency) / 1000;
    
    // Production capacity affects desirability
    // Cities that can build quickly get bonus
    if city_production > unit_cost {
        want = (want * 120) / 100;
    }
    
    want.max(0)
}

/// Calculate want score for building an improvement (building)
/// Based on economic value, growth benefits, and strategic importance
#[no_mangle]
pub extern "C" fn rust_ai_want_building(
    economic_value: c_int,
    growth_bonus: c_int,
    science_bonus: c_int,
    defense_bonus: c_int,
    building_cost: c_int,
) -> WantScore {
    if building_cost <= 0 {
        return 0;
    }
    
    // Sum all benefits
    let total_benefit = economic_value + growth_bonus + science_bonus + defense_bonus;
    
    // Amortize over cost
    let mut want = (total_benefit * 1000) / building_cost;
    
    // Science buildings are highly valued (hard mode: tech advantage)
    if science_bonus > 0 {
        want = (want * 130) / 100;
    }
    
    // Growth buildings important for expansion
    if growth_bonus > 0 {
        want = (want * 115) / 100;
    }
    
    want.max(0)
}

/// Calculate want score for building a settler
/// Based on expansion need and city capacity
#[no_mangle]
pub extern "C" fn rust_ai_want_settler(
    expansion_need: c_int,
    city_food_surplus: c_int,
    city_population: c_int,
    num_cities: c_int,
) -> WantScore {
    // Don't build settlers from small cities
    if city_population < 4 {
        return 0;
    }
    
    // Need food surplus to support settler production
    if city_food_surplus < 2 {
        return 0;
    }
    
    // Base want from expansion need (hard mode: 100% expansion)
    let mut want = expansion_need * 100;
    
    // Early game: high expansion priority
    if num_cities < 10 {
        want = (want * 150) / 100;
    }
    
    // Larger cities can afford to build settlers
    if city_population >= 6 {
        want = (want * 120) / 100;
    }
    
    // Bonus for good food surplus
    want += city_food_surplus * 50;
    
    want.max(0)
}

/// Calculate want score for building a wonder
/// Based on strategic value and production capacity
#[no_mangle]
pub extern "C" fn rust_ai_want_wonder(
    strategic_value: c_int,
    city_production: c_int,
    wonder_cost: c_int,
    competition_level: c_int,
) -> WantScore {
    if wonder_cost <= 0 {
        return 0;
    }
    
    // Only high-production cities should build wonders
    if city_production < 15 {
        return 0;
    }
    
    // Base want from strategic value
    let mut want = strategic_value * 100;
    
    // Production efficiency matters
    let build_time = wonder_cost / city_production.max(1);
    if build_time > 30 {
        want = want / 2; // Too slow
    }
    
    // Competition: others building same wonder reduces our want
    if competition_level > 0 {
        want = (want * 100) / (100 + competition_level * 20);
    }
    
    want.max(0)
}

/// Compare two want scores and return the higher priority
/// Returns: -1 if want1 higher, 0 if equal, 1 if want2 higher
#[no_mangle]
pub extern "C" fn rust_ai_compare_wants(want1: WantScore, want2: WantScore) -> c_int {
    if want1 > want2 {
        -1
    } else if want1 < want2 {
        1
    } else {
        0
    }
}

/// Calculate combined want score for technology research
/// Based on military value, economic value, and enabling benefits
#[no_mangle]
pub extern "C" fn rust_ai_want_tech(
    military_value: c_int,
    economic_value: c_int,
    enables_units: c_int,
    enables_buildings: c_int,
    tech_cost: c_int,
) -> WantScore {
    if tech_cost <= 0 {
        return 0;
    }
    
    // Base value
    let mut value = military_value + economic_value;
    
    // Enabling new capabilities is very valuable (hard mode: tech race)
    value += enables_units * 200;
    value += enables_buildings * 150;
    
    // Amortize over cost
    let want = (value * 10000) / tech_cost;
    
    want.max(0)
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_unit_want() {
        let want_strong = rust_ai_want_unit(100, 50, 30, 20);
        let want_weak = rust_ai_want_unit(100, 20, 30, 20);
        
        // Stronger units should be more desirable
        assert!(want_strong > want_weak);
    }
    
    #[test]
    fn test_building_want() {
        let want = rust_ai_want_building(50, 30, 40, 20, 100);
        assert!(want > 0);
        
        // Science buildings get bonus
        let want_science = rust_ai_want_building(50, 0, 100, 0, 100);
        let want_regular = rust_ai_want_building(50, 0, 0, 0, 100);
        assert!(want_science > want_regular);
    }
    
    #[test]
    fn test_settler_want() {
        // Small city shouldn't want settler
        assert_eq!(rust_ai_want_settler(100, 3, 3, 5), 0);
        
        // Large city with surplus should want settler
        let want = rust_ai_want_settler(100, 3, 6, 5);
        assert!(want > 0);
    }
    
    #[test]
    fn test_wonder_want() {
        // Low production city shouldn't want wonder
        assert_eq!(rust_ai_want_wonder(100, 10, 200, 0), 0);
        
        // High production city should want wonder
        let want = rust_ai_want_wonder(100, 20, 200, 0);
        assert!(want > 0);
    }
    
    #[test]
    fn test_want_comparison() {
        assert_eq!(rust_ai_compare_wants(100, 50), -1);
        assert_eq!(rust_ai_compare_wants(50, 100), 1);
        assert_eq!(rust_ai_compare_wants(75, 75), 0);
    }
}
