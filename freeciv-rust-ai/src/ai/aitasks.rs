/// AI Unit Task Management
/// Based on freeciv/freeciv/ai/default/aiunit.h and aitools.h
/// 
/// This module defines unit tasks similar to the C AI's AIUNIT_* enum

use std::collections::HashMap;

/// AI Unit Tasks - mirrors the C AI's ai_unit_task enum
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum AIUnitTask {
    None,
    AutoSettler,
    BuildCity,
    DefendHome,
    Attack,
    Escort,
    Explore,
    Recover,
    Hunter,
    Trade,
    Wonder,
}

impl AIUnitTask {
    pub fn name(&self) -> &str {
        match self {
            AIUnitTask::None => "None",
            AIUnitTask::AutoSettler => "Auto settler",
            AIUnitTask::BuildCity => "Build city",
            AIUnitTask::DefendHome => "Defend home",
            AIUnitTask::Attack => "Attack",
            AIUnitTask::Escort => "Escort",
            AIUnitTask::Explore => "Explore",
            AIUnitTask::Recover => "Recover",
            AIUnitTask::Hunter => "Hunter",
            AIUnitTask::Trade => "Trade",
            AIUnitTask::Wonder => "Wonder",
        }
    }
}

/// AI unit data - per-unit AI state
#[derive(Debug, Clone)]
pub struct AIUnitData {
    /// Current task assigned to this unit
    pub task: AIUnitTask,
    /// Whether this unit has been processed this turn
    pub done: bool,
    /// Target tile for this unit's task
    pub target_tile: Option<i32>,
    /// Target city ID for this unit's task
    pub target_city: Option<u16>,
}

impl AIUnitData {
    pub fn new() -> Self {
        Self {
            task: AIUnitTask::None,
            done: false,
            target_tile: None,
            target_city: None,
        }
    }
}

impl Default for AIUnitData {
    fn default() -> Self {
        Self::new()
    }
}

/// AI data storage - tracks per-unit AI state
#[derive(Debug, Default)]
pub struct AIData {
    /// Map from unit ID to AI unit data
    unit_data: HashMap<u16, AIUnitData>,
}

impl AIData {
    pub fn new() -> Self {
        Self::default()
    }
    
    /// Get or create AI data for a unit
    pub fn get_unit_data_mut(&mut self, unit_id: u16) -> &mut AIUnitData {
        self.unit_data.entry(unit_id).or_insert_with(AIUnitData::new)
    }
    
    /// Get AI data for a unit (read-only)
    pub fn get_unit_data(&self, unit_id: u16) -> Option<&AIUnitData> {
        self.unit_data.get(&unit_id)
    }
    
    /// Remove AI data for a unit
    pub fn remove_unit_data(&mut self, unit_id: u16) {
        self.unit_data.remove(&unit_id);
    }
    
    /// Clear all done flags at start of turn
    pub fn clear_done_flags(&mut self) {
        for data in self.unit_data.values_mut() {
            data.done = false;
            // Clear DEFEND_HOME tasks like C AI does
            if data.task == AIUnitTask::DefendHome {
                data.task = AIUnitTask::None;
                data.target_tile = None;
                data.target_city = None;
            }
        }
    }
    
    /// Assign a new task to a unit
    pub fn set_unit_task(&mut self, unit_id: u16, task: AIUnitTask, target_tile: Option<i32>) {
        let data = self.get_unit_data_mut(unit_id);
        data.task = task;
        data.target_tile = target_tile;
        println!("[AI Task] Unit #{} assigned task: {}", unit_id, task.name());
    }
    
    /// Mark a unit as done for this turn
    pub fn mark_unit_done(&mut self, unit_id: u16) {
        if let Some(data) = self.unit_data.get_mut(&unit_id) {
            data.done = true;
        }
    }
}
