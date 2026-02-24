/// AI Technology Research - Tech tree management and research priorities
/// Based on freeciv/freeciv/ai/default/aitech.c

use crate::state::GameState;

/// Choose which technology to research
/// Based on C AI's dai_select_tech() from aitech.c
/// This is called each turn to update research goals
pub fn choose_tech(state: &GameState) {
    if state.our_player_id.is_none() {
        return;
    }

    println!("[AI Tech] Choosing technology research");
    
    if let Some(player_id) = state.our_player_id {
        if let Some(_player) = state.players.get(&player_id) {
            // C AI's tech selection algorithm:
            // 1. Calculate want value for each tech
            // 2. Add want values from prerequisites
            // 3. Amortize by research time
            // 4. Select highest value tech
            
            select_research_goal(state);
        }
    }
}

/// Select the next research goal
/// Based on C AI's tech selection with want calculation
fn select_research_goal(state: &GameState) {
    println!("[AI Tech] Evaluating technology options");
    
    // C AI maintains tech_want[] array that accumulates desires
    // from various sources:
    // - Cities wanting to build units/buildings requiring tech
    // - Military needs (units for defense/attack)
    // - Government techs for policy changes
    // - Economic techs for growth
    // - Wonder techs for cultural victories
    
    // For now, use simplified priority list
    let priorities = get_tech_priorities(state);
    
    if !priorities.is_empty() {
        println!("[AI Tech] Top priority techs:");
        for (i, (tech_name, want)) in priorities.iter().take(3).enumerate() {
            println!("  {}. {} (want: {})", i + 1, tech_name, want);
        }
        
        // TODO: Send command to research highest priority tech
        println!("[AI Tech] Would research: {}", priorities[0].0);
    } else {
        println!("[AI Tech] No tech priorities determined");
    }
}

/// Get prioritized list of technologies
/// Returns (tech_name, want_value) sorted by want
fn get_tech_priorities(state: &GameState) -> Vec<(String, i32)> {
    let mut priorities = Vec::new();
    
    // C AI calculates tech want based on:
    // 1. Building/unit unlocks
    // 2. Strategic value
    // 3. Prerequisite for other valuable techs
    
    // Simplified priority categories from C AI:
    
    // Early game priorities (based on C AI patterns)
    let cities = state.get_our_cities();
    let total_cities = cities.len();
    
    if total_cities < 3 {
        // Expansion phase - C AI wants settler techs
        priorities.push(("Pottery".to_string(), 100)); // Granary for growth
        priorities.push(("Bronze Working".to_string(), 80)); // Settlers/workers
        priorities.push(("Animal Husbandry".to_string(), 70)); // Food resources
    } else if total_cities < 6 {
        // Development phase - C AI wants infrastructure
        priorities.push(("Writing".to_string(), 90)); // Library
        priorities.push(("Monarchy".to_string(), 85)); // Better government
        priorities.push(("Iron Working".to_string(), 75)); // Military units
        priorities.push(("Currency".to_string(), 70)); // Marketplace
    } else {
        // Mid-game - C AI balances military and economy
        priorities.push(("Philosophy".to_string(), 100)); // Free tech
        priorities.push(("Mathematics".to_string(), 80)); // Catapult
        priorities.push(("Code of Laws".to_string(), 75)); // Courthouse
        priorities.push(("Republic".to_string(), 90)); // Better government
    }
    
    // Adjust priorities based on danger level
    let avg_danger = calculate_average_city_danger(state);
    if avg_danger > 40 {
        // High danger - prioritize military techs
        priorities.push(("Horseback Riding".to_string(), 120)); // Fast units
        priorities.push(("Iron Working".to_string(), 110)); // Strong units
        priorities.push(("Construction".to_string(), 100)); // City walls
    }
    
    // Sort by want value (descending)
    priorities.sort_by(|a, b| b.1.cmp(&a.1));
    
    priorities
}

/// Calculate average danger across all cities
fn calculate_average_city_danger(state: &GameState) -> i32 {
    let cities = state.get_our_cities();
    if cities.is_empty() {
        return 0;
    }
    
    let total_danger: i32 = cities.iter()
        .map(|c| crate::ai::aitools::assess_city_danger(state, c))
        .sum();
    
    total_danger / cities.len() as i32
}

/// Calculate the value of a technology
/// Based on C AI's complex tech want calculation
pub fn tech_value(state: &GameState, tech_id: u16) -> i32 {
    // C AI calculates tech value based on:
    // 1. Units it unlocks (weighted by current needs)
    // 2. Buildings it unlocks (weighted by city needs)
    // 3. Wonders it unlocks (high value)
    // 4. Government it unlocks (very high value)
    // 5. Special abilities (varies)
    // 6. Prerequisites for other valuable techs
    
    let mut value = 0;
    
    // Placeholder - would need tech tree data
    let _ = (state, tech_id);
    
    // Base value
    value += 10;
    
    // TODO: Implement full tech value calculation
    // This requires access to ruleset data about what each tech unlocks
    
    value
}

/// Check if we want a specific tech
/// Used by cities to set tech wants for production
pub fn want_tech(state: &GameState, tech_id: u16) -> bool {
    let value = tech_value(state, tech_id);
    
    // Want tech if it has positive value
    value > 0
}
