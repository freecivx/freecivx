use std::collections::HashMap;

#[derive(Debug, Default)]
pub struct GameState {
    pub players: HashMap<u16, Player>,
    pub cities: HashMap<u16, City>,
    pub units: HashMap<u16, Unit>,
    pub current_turn: i16,
    pub current_year: i32,
    pub our_player_id: Option<u16>,
    pub turn_started: bool,
    pub turn_done: bool,
}

#[derive(Debug, Clone)]
pub struct Player {
    pub id: u16,
    pub name: String,
    pub username: String,
    pub is_alive: bool,
    pub gold: u32,
}

#[derive(Debug, Clone)]
pub struct City {
    pub id: u16,
    pub owner: u16,
    pub name: String,
    pub tile: i32,
    pub size: u8,
    pub production_kind: Option<u8>,
    pub production_value: Option<u16>,
}

#[derive(Debug, Clone)]
pub struct Unit {
    pub id: u16,
    pub owner: u16,
    pub tile: i32,
    pub homecity: u16,
    pub unit_type: u16,
    pub moves_left: u16,
    pub hp: u16,
}

impl GameState {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn update_player(&mut self, player: Player) {
        self.players.insert(player.id, player);
    }

    pub fn update_city(&mut self, city: City) {
        self.cities.insert(city.id, city);
    }

    pub fn update_unit(&mut self, unit: Unit) {
        self.units.insert(unit.id, unit);
    }

    pub fn remove_unit(&mut self, unit_id: u16) {
        self.units.remove(&unit_id);
    }

    pub fn remove_city(&mut self, city_id: u16) {
        self.cities.remove(&city_id);
    }

    pub fn get_our_cities(&self) -> Vec<&City> {
        if let Some(player_id) = self.our_player_id {
            self.cities
                .values()
                .filter(|c| c.owner == player_id)
                .collect()
        } else {
            Vec::new()
        }
    }

    pub fn get_our_units(&self) -> Vec<&Unit> {
        if let Some(player_id) = self.our_player_id {
            self.units
                .values()
                .filter(|u| u.owner == player_id)
                .collect()
        } else {
            Vec::new()
        }
    }

    pub fn start_turn(&mut self) {
        self.turn_started = true;
        self.turn_done = false;
    }

    pub fn end_turn(&mut self) {
        self.turn_done = true;
        self.turn_started = false;
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_game_state_creation() {
        let state = GameState::new();
        assert_eq!(state.players.len(), 0);
        assert_eq!(state.cities.len(), 0);
        assert_eq!(state.units.len(), 0);
        assert_eq!(state.current_turn, 0);
        assert_eq!(state.our_player_id, None);
    }

    #[test]
    fn test_add_player() {
        let mut state = GameState::new();
        let player = Player {
            id: 1,
            name: "TestPlayer".to_string(),
            username: "test".to_string(),
            is_alive: true,
            gold: 100,
        };
        state.update_player(player.clone());
        assert_eq!(state.players.len(), 1);
        assert!(state.players.contains_key(&1));
        assert_eq!(state.players.get(&1).unwrap().name, "TestPlayer");
    }

    #[test]
    fn test_add_city() {
        let mut state = GameState::new();
        let city = City {
            id: 1,
            owner: 1,
            name: "TestCity".to_string(),
            tile: 100,
            size: 5,
            production_kind: None,
            production_value: None,
        };
        state.update_city(city);
        assert_eq!(state.cities.len(), 1);
        assert!(state.cities.contains_key(&1));
    }

    #[test]
    fn test_add_unit() {
        let mut state = GameState::new();
        let unit = Unit {
            id: 1,
            owner: 1,
            tile: 100,
            homecity: 1,
            unit_type: 10,
            moves_left: 3,
            hp: 10,
        };
        state.update_unit(unit);
        assert_eq!(state.units.len(), 1);
        assert!(state.units.contains_key(&1));
    }

    #[test]
    fn test_get_our_cities() {
        let mut state = GameState::new();
        state.our_player_id = Some(1);
        
        let city1 = City {
            id: 1,
            owner: 1,
            name: "City1".to_string(),
            tile: 100,
            size: 5,
            production_kind: None,
            production_value: None,
        };
        let city2 = City {
            id: 2,
            owner: 2,
            name: "City2".to_string(),
            tile: 200,
            size: 3,
            production_kind: None,
            production_value: None,
        };
        
        state.update_city(city1);
        state.update_city(city2);
        
        let our_cities = state.get_our_cities();
        assert_eq!(our_cities.len(), 1);
        assert_eq!(our_cities[0].id, 1);
    }

    #[test]
    fn test_get_our_units() {
        let mut state = GameState::new();
        state.our_player_id = Some(1);
        
        let unit1 = Unit {
            id: 1,
            owner: 1,
            tile: 100,
            homecity: 1,
            unit_type: 10,
            moves_left: 3,
            hp: 10,
        };
        let unit2 = Unit {
            id: 2,
            owner: 2,
            tile: 200,
            homecity: 2,
            unit_type: 10,
            moves_left: 3,
            hp: 10,
        };
        
        state.update_unit(unit1);
        state.update_unit(unit2);
        
        let our_units = state.get_our_units();
        assert_eq!(our_units.len(), 1);
        assert_eq!(our_units[0].id, 1);
    }

    #[test]
    fn test_turn_state() {
        let mut state = GameState::new();
        assert!(!state.turn_started);
        assert!(!state.turn_done);
        
        state.start_turn();
        assert!(state.turn_started);
        assert!(!state.turn_done);
        
        state.end_turn();
        assert!(!state.turn_started);
        assert!(state.turn_done);
    }

    #[test]
    fn test_remove_city() {
        let mut state = GameState::new();
        let city = City {
            id: 1,
            owner: 1,
            name: "TestCity".to_string(),
            tile: 100,
            size: 5,
            production_kind: None,
            production_value: None,
        };
        state.update_city(city);
        assert_eq!(state.cities.len(), 1);
        
        state.remove_city(1);
        assert_eq!(state.cities.len(), 0);
    }

    #[test]
    fn test_remove_unit() {
        let mut state = GameState::new();
        let unit = Unit {
            id: 1,
            owner: 1,
            tile: 100,
            homecity: 1,
            unit_type: 10,
            moves_left: 3,
            hp: 10,
        };
        state.update_unit(unit);
        assert_eq!(state.units.len(), 1);
        
        state.remove_unit(1);
        assert_eq!(state.units.len(), 0);
    }
}
