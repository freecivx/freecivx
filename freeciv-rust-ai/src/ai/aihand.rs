/// AI Handler - Turn processing and high-level activities
/// Based on freeciv/freeciv/ai/default/aihand.c
/// 
/// This module handles the main AI turn processing, similar to the C AI.
/// It's split into "first activities" (before human turn) and "last activities"
/// (after human turn) like the original C implementation.

use crate::state::GameState;
use super::aitasks::AIData;
use super::{aiunit, aicity, aitech};

/// Activities to be done by AI _before_ human turn
/// This is when we move units (dai_do_first_activities in C AI)
/// 
/// From C AI:
/// - Assess danger (not yet implemented)
/// - Manage units (dai_manage_units)
pub fn do_first_activities(state: &mut GameState, ai_data: &mut AIData) {
    println!("[AI First Activities] Starting turn {} activities", state.current_turn);
    
    // TODO: Assess danger for all cities (dai_assess_danger_player)
    // This would analyze threats to cities and set urgency levels
    
    // Manage units - this is the main activity before human turn
    aiunit::manage_units(state, ai_data);
    
    println!("[AI First Activities] Complete");
}

/// Activities to be done by AI _after_ human turn
/// This is when we respond to dangers and manage cities/tech
/// (dai_do_last_activities in C AI)
/// 
/// From C AI:
/// - Clear tech wants
/// - Manage government (change government if beneficial)
/// - Adjust policies
/// - Manage taxes (set science/luxury/tax rates)
/// - Manage cities (dai_manage_cities)
/// - Manage tech research (dai_manage_tech)
/// - Manage spaceship
pub fn do_last_activities(state: &mut GameState, ai_data: &mut AIData) {
    println!("[AI Last Activities] Turn {} end-of-turn processing", state.current_turn);
    
    // Clear technology wants (would reset tech desire calculations)
    // TODO: implement tech want clearing
    
    // Manage government (check if we should revolution to better government)
    manage_government(state);
    
    // Manage tax rates (set science/luxury/tax percentages)
    manage_taxes(state);
    
    // Manage all cities
    aicity::manage_cities(state, ai_data);
    
    // Choose technology research
    aitech::choose_tech(state);
    
    // TODO: Manage spaceship (if we're pursuing space race victory)
    
    println!("[AI Last Activities] Complete");
}

/// Manage government - decide if we should change government
/// Based on dai_manage_government() in aihand.c
fn manage_government(state: &GameState) {
    if state.our_player_id.is_none() {
        return;
    }
    
    println!("[AI Government] Checking government options");
    
    // C AI government evaluation:
    // - Despotism: Default, poor for large empires
    // - Monarchy: Better than despotism, good for military
    // - Republic: Great for science/trade, weak military
    // - Democracy: Best for peace, very weak military
    // - Communism: Good for military and production
    
    // Factors C AI considers:
    // 1. Number of cities (larger empires benefit from better governments)
    // 2. Current war status (military governments for war)
    // 3. Tech research speed (Republic/Democracy for science)
    // 4. Unhappiness issues (some governments have better happiness)
    
    let cities = state.get_our_cities();
    let total_cities = cities.len();
    
    if total_cities < 3 {
        println!("[AI Government] {} cities - Despotism acceptable for now", total_cities);
        // Early game: Despotism is fine
        return;
    }
    
    // Calculate average danger to determine if we're at war
    let avg_danger = calculate_average_city_danger(state);
    
    if avg_danger > 40 {
        println!("[AI Government] High danger ({}), should consider Monarchy for military", avg_danger);
        // At war: prefer Monarchy or Communism
        // TODO: Check if we have Monarchy tech and switch
    } else if total_cities >= 6 {
        println!("[AI Government] {} cities with low danger, should consider Republic for science", total_cities);
        // Peaceful expansion: prefer Republic
        // TODO: Check if we have Republic tech and switch
    } else if total_cities >= 4 {
        println!("[AI Government] {} cities, Monarchy would be beneficial", total_cities);
        // Growing empire: Monarchy is good stepping stone
        // TODO: Check if we have Monarchy tech and switch
    }
    
    // C AI also considers:
    // - Gold per turn (some governments have upkeep costs)
    // - Science output (Republic/Democracy have bonuses)
    // - Military support (different governments have different unit support)
}

/// Calculate average danger across all cities
/// Used for government and tech decisions
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

/// Manage tax rates - set science/luxury/tax percentages
/// Based on dai_manage_taxes() in aihand.c
/// 
/// The C AI has sophisticated tax management:
/// - Calculate income and expenses
/// - Determine if we need gold (negative balance)
/// - Check if we want science (research active)
/// - Consider luxury for city happiness
/// - Balance rates to avoid bankruptcy while maximizing science
fn manage_taxes(state: &GameState) {
    if state.our_player_id.is_none() {
        return;
    }
    
    println!("[AI Taxes] Managing tax rates");
    
    // C AI tax rate algorithm (from aihand.c):
    // Default split: 50% science, 0% luxury, 50% tax
    // Adjustments based on:
    // 1. Treasury level (increase tax if low gold)
    // 2. Science research (increase science if researching)
    // 3. City happiness (increase luxury if cities unhappy)
    
    if let Some(player_id) = state.our_player_id {
        if let Some(player) = state.players.get(&player_id) {
            let gold = player.gold;
            
            // C AI considers gold reserves
            // AI_GOLD_RESERVE_MIN_TURNS = 10 (from C AI)
            // Minimum reserve = income * 10 turns
            
            let cities = state.get_our_cities();
            let total_cities = cities.len();
            
            // Estimate income (very rough - C AI has precise calculation)
            let estimated_income = total_cities as u32 * 5; // ~5 gold per city
            let min_reserve = estimated_income * 10;
            
            if gold < min_reserve {
                println!("[AI Taxes] Low treasury ({} < {}), need more tax income", 
                    gold, min_reserve);
                // Recommended: 30% science, 0% luxury, 70% tax
                // TODO: Send tax rate change packet
            } else if gold > min_reserve * 3 {
                println!("[AI Taxes] High treasury ({} > {}), maximize science", 
                    gold, min_reserve * 3);
                // Recommended: 80% science, 0% luxury, 20% tax
                // TODO: Send tax rate change packet
            } else {
                println!("[AI Taxes] Moderate treasury ({}), balanced approach", gold);
                // Recommended: 60% science, 0% luxury, 40% tax
                // TODO: Send tax rate change packet
            }
            
            // C AI also checks for unhappiness
            // If cities have unhappy citizens, increase luxury rate
            // For now, we don't have happiness data
            
            // C AI considerations not yet implemented:
            // - Building wealth in a city (0% science needed)
            // - No research available (increase tax)
            // - Rapture growth possibility (increase luxury)
        }
    }
}

/// Calculate economic data for the player
/// Helper function for tax management
fn _calculate_economic_data(state: &GameState) -> (i32, i32) {
    // Calculate total income and expenses
    let cities = state.get_our_cities();
    let city_count = cities.len() as i32;
    
    // Rough estimates (real C AI calculates this precisely)
    let estimated_income = city_count * 10;  // ~10 gold per city
    let estimated_expenses = city_count * 2; // ~2 gold upkeep per city
    
    (estimated_income, estimated_expenses)
}
