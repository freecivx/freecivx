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
