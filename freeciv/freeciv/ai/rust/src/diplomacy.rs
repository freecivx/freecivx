//! Diplomacy AI - based on ai/default/daidiplomacy.c
//! 
//! Handles diplomatic decisions, treaty evaluation, and war/peace strategies.
//! Hard mode: Strategic diplomacy based on strength and opportunity.

use std::os::raw::c_int;

/// Diplomatic stance types (based on C AI diplomacy)
pub const DIPLOSTANCE_HOSTILE: c_int = -100;
pub const DIPLOSTANCE_NEUTRAL: c_int = 0;
pub const DIPLOSTANCE_FRIENDLY: c_int = 100;

/// War desire threshold
pub const WAR_DESIRE_THRESHOLD: c_int = 50;

/// Evaluate treaty value (peace, alliance, etc.)
/// Based on C AI's treaty_evaluate
/// Returns: -100 to 100 (negative=reject, positive=accept)
#[no_mangle]
pub extern "C" fn rust_ai_evaluate_treaty(
    treaty_type: c_int, // 0=peace, 1=alliance, 2=ceasefire
    our_strength: c_int,
    their_strength: c_int,
    current_war_weariness: c_int,
    shared_enemies: c_int,
) -> c_int {
    let mut value = 0;
    
    let strength_ratio = if their_strength > 0 {
        (our_strength * 100) / their_strength
    } else {
        200
    };
    
    match treaty_type {
        0 => { // Peace treaty
            // Want peace if we're losing
            if strength_ratio < 80 {
                value = 60;
            } else if strength_ratio < 100 {
                value = 30;
            } else {
                value = -20; // Winning, don't want peace
            }
            
            // War weariness increases peace desire
            value += current_war_weariness / 3;
        }
        1 => { // Alliance
            // Alliance valuable against shared enemies
            value = shared_enemies * 25;
            
            // Don't ally with much stronger powers (might dominate)
            if strength_ratio < 50 {
                value -= 40;
            }
            
            // Don't ally with much weaker powers (burden)
            if strength_ratio > 200 {
                value -= 20;
            }
        }
        2 => { // Ceasefire
            // Temporary peace - almost always acceptable
            value = 40;
            
            // Extra value if we need time to rebuild
            if strength_ratio < 90 {
                value += 30;
            }
        }
        _ => {}
    }
    
    value.clamp(-100, 100)
}

/// Calculate war desire against a player
/// Based on C AI's dai_diplomacy_war_desire
/// Returns: 0-100 (higher = more desire for war)
#[no_mangle]
pub extern "C" fn rust_ai_war_desire(
    our_military: c_int,
    their_military: c_int,
    their_cities: c_int,
    shared_borders: c_int,
    past_wars: c_int,
    they_attacked_us: c_int,
) -> c_int {
    let mut desire = 0;
    
    // Hard mode: opportunistic aggression
    let strength_ratio = if their_military > 0 {
        (our_military * 100) / their_military
    } else {
        200
    };
    
    // Strong advantage: war desire increases
    if strength_ratio >= 150 {
        desire += 60;
    } else if strength_ratio >= 120 {
        desire += 30;
    } else if strength_ratio < 80 {
        desire -= 40; // Too risky
    }
    
    // Finish weak enemies (based on FINISH_HIM_CITY_COUNT)
    if their_cities > 0 && their_cities <= 5 {
        desire += 50;
    }
    
    // Shared borders create tension
    if shared_borders > 0 {
        desire += 20;
    }
    
    // Historical animosity
    desire += past_wars * 10;
    
    // Retaliation for attacks
    if they_attacked_us > 0 {
        desire += 40;
    }
    
    desire.clamp(0, 100)
}

/// Evaluate diplomatic stance towards another player
/// Returns: -100 (hostile) to 100 (friendly)
#[no_mangle]
pub extern "C" fn rust_ai_diplomatic_stance(
    our_strength: c_int,
    their_strength: c_int,
    war_desire: c_int,
    trade_value: c_int,
    tech_gap: c_int, // Positive if they're ahead
) -> c_int {
    let mut stance = 0;
    
    // Base stance on war desire
    stance -= war_desire;
    
    // Trade encourages friendship
    stance += trade_value / 5;
    
    // Tech gap affects stance
    if tech_gap > 30 {
        // They're much more advanced - be friendly to get tech
        stance += 30;
    } else if tech_gap < -30 {
        // We're much more advanced - can be aggressive
        stance -= 10;
    }
    
    // Strength comparison
    let strength_ratio = if their_strength > 0 {
        (our_strength * 100) / their_strength
    } else {
        200
    };
    
    if strength_ratio > 150 {
        // Much stronger - can afford hostility
        stance -= 20;
    } else if strength_ratio < 70 {
        // Weaker - be cautious/friendly
        stance += 25;
    }
    
    stance.clamp(-100, 100)
}

/// Decide on first contact diplomacy
/// Returns: 0=neutral, 1=friendly, 2=cautious, 3=hostile
#[no_mangle]
pub extern "C" fn rust_ai_first_contact_stance(
    their_military_visible: c_int,
    our_military: c_int,
    game_turn: c_int,
) -> c_int {
    // Early game: generally friendly (need allies)
    if game_turn < 50 {
        return 1; // Friendly
    }
    
    // Assess relative strength
    let strength_ratio = if their_military_visible > 0 {
        (our_military * 100) / their_military_visible
    } else {
        100 // Unknown strength, assume equal
    };
    
    // Much stronger: can be neutral/hostile
    if strength_ratio > 150 {
        return 0; // Neutral
    }
    
    // Much weaker: be cautious
    if strength_ratio < 70 {
        return 2; // Cautious
    }
    
    // Default: neutral
    0
}

/// Evaluate whether to break treaty
/// Returns: 0=keep treaty, 1=consider breaking, 2=break now
#[no_mangle]
pub extern "C" fn rust_ai_should_break_treaty(
    _treaty_type: c_int,
    our_military_advantage: c_int,
    opportunity_value: c_int, // Value of what we could gain
    reputation_cost: c_int,
) -> c_int {
    // Hard mode: opportunistic but considers consequences
    
    // High reputation cost: don't break
    if reputation_cost > 70 {
        return 0;
    }
    
    // Strong military advantage and high opportunity
    if our_military_advantage > 50 && opportunity_value > 80 {
        if reputation_cost < 30 {
            return 2; // Break now
        } else {
            return 1; // Consider
        }
    }
    
    // Moderate advantage
    if our_military_advantage > 30 && opportunity_value > 90 {
        return 1; // Consider
    }
    
    // Not worth breaking
    0
}

/// Calculate gift/tribute value for diplomacy
/// Returns value of gift (gold or tech) to improve relations
#[no_mangle]
pub extern "C" fn rust_ai_calculate_gift_value(
    relationship_value: c_int, // How much we value good relations
    their_power: c_int,
    our_gold: c_int,
) -> c_int {
    // Don't gift if relationship not valuable
    if relationship_value < 30 {
        return 0;
    }
    
    // Don't gift if we're poor
    if our_gold < 100 {
        return 0;
    }
    
    // Base gift on relationship value and their power
    let mut gift = relationship_value * their_power / 100;
    
    // Cap at 10% of our gold
    gift = gift.min(our_gold / 10);
    
    gift
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_peace_treaty_evaluation() {
        // Losing war: want peace
        let value = rust_ai_evaluate_treaty(0, 50, 100, 60, 0);
        assert!(value > 50);
        
        // Winning war: don't want peace
        let value2 = rust_ai_evaluate_treaty(0, 150, 100, 10, 0);
        assert!(value2 < 0);
    }
    
    #[test]
    fn test_war_desire() {
        // Much stronger: high war desire
        let desire = rust_ai_war_desire(200, 100, 10, 1, 0, 0);
        assert!(desire > 40);
        
        // Weaker: low war desire
        let desire2 = rust_ai_war_desire(80, 120, 10, 1, 0, 0);
        assert!(desire2 < 20);
        
        // Weak enemy: finish them
        let desire3 = rust_ai_war_desire(150, 100, 3, 1, 0, 0);
        assert!(desire3 > 60);
    }
    
    #[test]
    fn test_diplomatic_stance() {
        // High war desire: hostile
        let stance = rust_ai_diplomatic_stance(150, 100, 80, 0, 0);
        assert!(stance < -50);
        
        // Trade and tech gap: friendly
        let stance2 = rust_ai_diplomatic_stance(100, 100, 20, 100, 40);
        assert!(stance2 > 0);
    }
    
    #[test]
    fn test_first_contact() {
        // Early game: friendly
        assert_eq!(rust_ai_first_contact_stance(100, 100, 30), 1);
        
        // Late game, much stronger: neutral
        assert_eq!(rust_ai_first_contact_stance(50, 120, 150), 0);
    }
}
