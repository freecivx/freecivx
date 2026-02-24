// AI modules
pub mod aihand;
pub mod aiunit;
pub mod aicity;
pub mod aitech;
pub mod aitools;

use crate::state::GameState;
use anyhow::Result;

/// Main AI coordinator that orchestrates all AI activities
pub struct DeityAI {
    pub state: GameState,
}

impl DeityAI {
    pub fn new() -> Self {
        Self {
            state: GameState::new(),
        }
    }

    /// Process a complete AI turn
    pub async fn process_turn(&mut self) -> Result<()> {
        println!("\n=== AI Turn {} ===", self.state.current_turn);
        
        // Mark turn as started
        self.state.start_turn();

        // Process AI activities in order (similar to C AI)
        aihand::do_first_activities(&self.state);
        aicity::manage_cities(&mut self.state);
        aiunit::manage_units(&mut self.state);
        aitech::choose_tech(&self.state);
        aihand::do_last_activities(&self.state);

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
