// AI modules
pub mod aihand;
pub mod aiunit;
pub mod aicity;
pub mod aitech;
pub mod aitools;
pub mod aitasks;

use crate::state::GameState;
use anyhow::Result;
use aitasks::AIData;

/// Main AI coordinator that orchestrates all AI activities
pub struct DeityAI {
    pub state: GameState,
    pub ai_data: AIData,
}

impl DeityAI {
    pub fn new() -> Self {
        Self {
            state: GameState::new(),
            ai_data: AIData::new(),
        }
    }

    /// Process a complete AI turn
    /// This follows the C AI's turn processing order:
    /// 1. Clear done flags and reset defend home tasks
    /// 2. First activities (danger assessment, unit management)
    /// 3. Last activities (government, taxes, cities, tech, spaceship)
    pub async fn process_turn(&mut self) -> Result<()> {
        println!("\n=== AI Turn {} ===", self.state.current_turn);
        
        // Mark turn as started
        self.state.start_turn();
        
        // Clear AI unit flags (like C AI does at start of turn)
        self.ai_data.clear_done_flags();

        // Process first activities (before human turn)
        // This is when we move units
        aihand::do_first_activities(&mut self.state, &mut self.ai_data);
        
        // Process last activities (after human turn)
        // This is when we set defenders, manage cities, tech, etc.
        aihand::do_last_activities(&mut self.state, &mut self.ai_data);

        // Mark turn as done
        self.state.end_turn();

        Ok(())
    }

    /// Check if it's our turn and we should act
    pub fn should_process_turn(&self) -> bool {
        self.state.our_player_id.is_some() 
            && self.state.turn_started 
            && !self.state.turn_done
    }
}

impl Default for DeityAI {
    fn default() -> Self {
        Self::new()
    }
}
