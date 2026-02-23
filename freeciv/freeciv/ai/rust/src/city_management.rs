//! City management AI - based on ai/default/daicity.c
//! 
//! Handles city-level AI decisions including production choices,
//! growth management, and economic optimization.

use std::os::raw::c_int;
use crate::data_structures::RustCity;
use crate::wants::{rust_ai_want_unit, rust_ai_want_building, rust_ai_want_settler, rust_ai_want_wonder};

/// Invasion tracking structure (from ai_invasion in daicity.h)
#[repr(C)]
pub struct RustInvasion {
    pub attack: c_int,  // Units capable of attacking city
    pub occupy: c_int,  // Units capable of occupying city
}

/// City AI data structure (simplified from ai_city in daicity.h)
#[repr(C)]
pub struct RustCityAI {
    pub worth: c_int,           // City worth (sum of weighted incomes * 100)
    pub danger: c_int,          // Danger level
    pub grave_danger: c_int,    // Critical danger level
    pub urgency: c_int,         // How close the danger is
    pub invasion_attack: c_int, // Invasion attack capability
    pub invasion_occupy: c_int, // Invasion occupy capability
    pub building_want: c_int,   // Current building desire
    pub unit_want: c_int,       // Military unit desire
    pub settler_want: c_int,    // Settler desire
}

/// Calculate city worth (economic value)
/// Based on production outputs and strategic position
#[no_mangle]
pub extern "C" fn rust_ai_city_worth(
    city: &RustCity,
    turn: c_int,
) -> c_int {
    let mut worth = 0;
    
    // Base worth from population (each citizen has value)
    worth += city.population * 100;
    
    // Economic output value
    worth += city.science_output * 50;
    worth += city.gold_output * 40;
    worth += city.trade_production * 30;
    worth += city.shield_surplus * 35;
    worth += city.food_surplus * 25;
    
    // Coastal cities have trade advantages
    if city.is_coastal > 0 {
        worth = (worth * 110) / 100;
    }
    
    // Established cities (not newly founded) are more valuable
    let city_age = turn - city.turn_founded;
    if city_age > 20 {
        worth = (worth * 120) / 100;
    }
    
    worth
}

/// Decide what a city should build
/// Returns production choice based on wants system
/// 0=military_unit, 1=building, 2=settler, 3=wonder, 4=nothing
#[no_mangle]
pub extern "C" fn rust_ai_city_choose_production(
    city: &RustCity,
    military_need: c_int,
    economic_need: c_int,
    expansion_need: c_int,
    danger: c_int,
    num_cities: c_int,
) -> c_int {
    // Calculate wants for each option
    let unit_want = if military_need > 0 || danger > 50 {
        rust_ai_want_unit(military_need + danger, 30, 30, city.shield_surplus)
    } else {
        0
    };
    
    let building_want = rust_ai_want_building(
        economic_need,
        city.population * 5,
        economic_need / 2,
        danger / 3,
        100
    );
    
    let settler_want = rust_ai_want_settler(
        expansion_need,
        city.food_surplus,
        city.population,
        num_cities,
    );
    
    let wonder_want = if city.shield_surplus > 15 && city.population >= 8 {
        rust_ai_want_wonder(economic_need, city.shield_surplus, 300, 0)
    } else {
        0
    };
    
    // Find highest want
    let max_want = unit_want.max(building_want).max(settler_want).max(wonder_want);
    
    if max_want <= 0 {
        return 4; // Nothing worth building
    }
    
    if max_want == unit_want {
        0 // Military unit
    } else if max_want == building_want {
        1 // Building
    } else if max_want == settler_want {
        2 // Settler
    } else {
        3 // Wonder
    }
}

/// Manage city citizens and specialists
/// Returns specialist assignment: 0=workers, 1=scientists, 2=taxmen, 3=entertainers
#[no_mangle]
pub extern "C" fn rust_ai_city_manage_citizens(
    _city: &RustCity,
    science_priority: c_int,
    gold_priority: c_int,
    happiness_need: c_int,
) -> c_int {
    // If city has good tile yields, use workers
    if _city.food_surplus >= 2 && _city.shield_surplus >= 5 {
        return 0; // Workers on tiles
    }
    
    // Happiness crisis: need entertainers
    if happiness_need > 70 {
        return 3; // Entertainers
    }
    
    // Science vs gold priority (hard mode: prioritize science)
    if science_priority > gold_priority {
        if science_priority > 60 {
            return 1; // Scientists
        }
    } else if gold_priority > 60 {
        return 2; // Taxmen
    }
    
    // Default: workers
    0
}

/// Evaluate if city should buy current production with gold
/// Hard mode: aggressive buying when needed
/// Returns: 0=don't buy, 1=consider buying, 2=buy immediately
#[no_mangle]
pub extern "C" fn rust_ai_city_should_buy(
    _city: &RustCity,
    production_cost: c_int,
    gold_available: c_int,
    danger: c_int,
    turns_to_complete: c_int,
) -> c_int {
    let buy_cost = production_cost * 2; // Simplified buy cost
    
    if buy_cost > gold_available {
        return 0; // Can't afford
    }
    
    // Emergency: grave danger and long build time
    if danger > 200 && turns_to_complete > 5 {
        return 2; // Buy immediately
    }
    
    // Consider buying if danger present and we have plenty of gold
    if danger > 100 && gold_available > buy_cost * 3 {
        return 1; // Consider buying
    }
    
    // Consider buying if nearly complete and lots of gold
    if turns_to_complete <= 2 && gold_available > buy_cost * 5 {
        return 1; // Consider buying
    }
    
    0 // Don't buy
}

/// Calculate city growth strategy
/// Based on C AI's city management priorities
#[no_mangle]
pub extern "C" fn rust_ai_city_growth_focus(
    city: &RustCity,
    danger: c_int,
    expansion_priority: c_int,
) -> c_int {
    // Under threat: focus on production (shields)
    if danger > 100 {
        return 1; // Production focus
    }
    
    // Small cities: grow
    if city.population < 6 {
        return 0; // Growth focus
    }
    
    // High expansion need: prepare for settlers
    if expansion_priority > 70 && city.population >= 4 {
        return 0; // Growth focus
    }
    
    // Medium cities: balance
    if city.population < 12 {
        if city.shield_surplus < 8 {
            return 1; // Production focus
        } else {
            return 2; // Commerce focus
        }
    }
    
    // Large cities: commerce for science/gold
    2
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::data_structures::RustCity;
    
    #[test]
    fn test_city_worth() {
        let city = RustCity {
            city_id: 1,
            owner_id: 0,
            x: 10,
            y: 10,
            population: 8,
            food_surplus: 3,
            shield_surplus: 10,
            trade_production: 5,
            science_output: 6,
            gold_output: 4,
            luxury_output: 2,
            is_coastal: 1,
            turn_founded: 10,
        };
        
        let worth = rust_ai_city_worth(&city, 50);
        assert!(worth > 0);
        
        // Coastal cities should be worth more
        let mut inland_city = city.clone();
        inland_city.is_coastal = 0;
        let inland_worth = rust_ai_city_worth(&inland_city, 50);
        assert!(worth > inland_worth);
    }
    
    #[test]
    fn test_production_choice() {
        let city = RustCity {
            city_id: 1,
            owner_id: 0,
            x: 10,
            y: 10,
            population: 5,
            food_surplus: 2,
            shield_surplus: 8,
            trade_production: 3,
            science_output: 4,
            gold_output: 2,
            luxury_output: 1,
            is_coastal: 0,
            turn_founded: 1,
        };
        
        // High danger should prioritize military
        let choice = rust_ai_city_choose_production(&city, 100, 50, 50, 150, 5);
        assert_eq!(choice, 0); // Military unit
        
        // No danger, high expansion: settlers
        let choice2 = rust_ai_city_choose_production(&city, 0, 50, 100, 0, 3);
        assert_eq!(choice2, 2); // Settler
    }
    
    #[test]
    fn test_emergency_buying() {
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
        
        // Emergency: should buy
        assert_eq!(rust_ai_city_should_buy(&city, 100, 500, 250, 8), 2);
        
        // No danger: shouldn't buy
        assert_eq!(rust_ai_city_should_buy(&city, 100, 500, 0, 8), 0);
    }
}
