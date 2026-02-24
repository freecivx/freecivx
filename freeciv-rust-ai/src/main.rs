mod ai;
mod packets;
mod state;
mod map;

use ai::DeityAI as AICoordinator;
use anyhow::{Context, Result};
use clap::Parser;
use packets::*;
use state::*;
use std::net::SocketAddr;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpStream;

/// Deity Rust AI - An AI client for Freeciv that connects via JSON protocol
#[derive(Parser, Debug)]
#[command(author, version, about, long_about = None)]
struct Args {
    /// Port number of the Freeciv server to connect to
    #[arg(short, long, default_value_t = 6000)]
    port: u16,

    /// Host address of the Freeciv server
    #[arg(short = 'H', long, default_value = "127.0.0.1")]
    host: String,

    /// Username for the AI player
    #[arg(short, long, default_value = "DeityRustAI")]
    username: String,
}

struct DeityAI {
    stream: TcpStream,
    username: String,
    ai: AICoordinator,
    connected: bool,
    authenticated: bool,
}

impl DeityAI {
    async fn connect(host: &str, port: u16, username: String) -> Result<Self> {
        let addr: SocketAddr = format!("{}:{}", host, port)
            .parse()
            .context("Failed to parse server address")?;

        println!("Connecting to Freeciv server at {}...", addr);
        let stream = TcpStream::connect(addr)
            .await
            .context("Failed to connect to server")?;

        println!("Connected successfully!");

        Ok(DeityAI {
            stream,
            username,
            ai: AICoordinator::new(),
            connected: true,
            authenticated: false,
        })
    }

    async fn send_packet<T: serde::Serialize>(&mut self, packet: &T) -> Result<()> {
        let json_str = serde_json::to_string(packet)?;
        let json_bytes = json_str.as_bytes();

        // Send packet length as 2-byte header (big-endian)
        let len = (json_bytes.len() as u16).to_be_bytes();
        self.stream.write_all(&len).await?;

        // Send JSON packet
        self.stream.write_all(json_bytes).await?;
        self.stream.flush().await?;

        println!("=> Sent packet: {}", json_str);
        Ok(())
    }

    async fn receive_packet(&mut self) -> Result<Option<FreecivPacket>> {
        // Read 2-byte length header
        let mut len_buf = [0u8; 2];
        match self.stream.read_exact(&mut len_buf).await {
            Ok(_) => {}
            Err(e) if e.kind() == std::io::ErrorKind::UnexpectedEof => {
                return Ok(None);
            }
            Err(e) => return Err(e.into()),
        }

        let len = u16::from_be_bytes(len_buf) as usize;

        // Validate packet length to prevent excessive memory allocation
        const MAX_PACKET_SIZE: usize = 1024 * 1024; // 1MB max packet size
        if len > MAX_PACKET_SIZE {
            return Err(anyhow::anyhow!(
                "Packet length {} exceeds maximum allowed size of {} bytes",
                len,
                MAX_PACKET_SIZE
            ));
        }

        // Read JSON packet
        let mut buf = vec![0u8; len];
        self.stream.read_exact(&mut buf).await?;

        let json_str = String::from_utf8(buf)?;
        println!("<= Received packet: {}", json_str);

        let packet: FreecivPacket = serde_json::from_str(&json_str)?;
        Ok(Some(packet))
    }

    async fn handle_packet(&mut self, packet: &FreecivPacket) -> Result<()> {
        match packet.pid {
            PACKET_PROCESSING_STARTED => {
                println!("[Processing Started]");
            }
            PACKET_PROCESSING_FINISHED => {
                println!("[Processing Finished]");
                
                // After processing finished, check if we should act
                if self.ai.should_process_turn() {
                    self.process_ai_turn().await?;
                }
            }
            PACKET_BEGIN_TURN => {
                println!("[Begin Turn]");
                self.ai.state.start_turn();
            }
            PACKET_START_PHASE => {
                println!("[Start Phase]");
            }
            PACKET_END_TURN => {
                println!("[End Turn]");
            }
            PACKET_SERVER_JOIN_REPLY => {
                let reply: ServerJoinReply = serde_json::from_value(packet.data.clone())?;
                println!("[Join Reply] Can join: {}", reply.you_can_join);
                println!("[Join Reply] Message: {}", reply.message);
                println!("[Join Reply] Capability: {}", reply.capability);
                println!("[Join Reply] Connection ID: {}", reply.conn_id);

                if !reply.you_can_join {
                    anyhow::bail!("Server rejected connection: {}", reply.message);
                }

                self.authenticated = true;
            }
            PACKET_AUTHENTICATION_REQ => {
                let auth: AuthenticationReq = serde_json::from_value(packet.data.clone())?;
                println!("[Auth Request] Type: {}, Message: {}", auth.auth_type, auth.message);

                // Send empty password for now (assumes no authentication)
                let reply = AuthenticationReply::new(String::new());
                self.send_packet(&reply).await?;
            }
            PACKET_CONNECT_MSG => {
                let msg: ConnectMsg = serde_json::from_value(packet.data.clone())?;
                println!("[Connect] {}", msg.message);
            }
            PACKET_CHAT_MSG => {
                let msg: ChatMsg = serde_json::from_value(packet.data.clone())?;
                println!("[Chat] {}", msg.message);
            }
            PACKET_SERVER_INFO => {
                let info: ServerInfo = serde_json::from_value(packet.data.clone())?;
                println!("[Server Info] Version: {}", info.version);
            }
            PACKET_GAME_INFO => {
                let info: GameInfo = serde_json::from_value(packet.data.clone())?;
                self.ai.state.current_turn = info.turn;
                self.ai.state.current_year = info.year;
                println!("[Game Info] Turn: {}, Year: {}", info.turn, info.year);
            }
            PACKET_PLAYER_INFO => {
                let info: PlayerInfo = serde_json::from_value(packet.data.clone())?;
                println!("[Player Info] #{} {} ({})", info.playerno, info.name, info.username);

                // Check if this is us
                if info.username == self.username {
                    println!("[Player Info] This is our player! ID: {}", info.playerno);
                    self.ai.state.our_player_id = Some(info.playerno);
                    
                    // Send player ready packet so game can start
                    let ready_packet = PlayerReady::new(info.playerno, true);
                    self.send_packet(&ready_packet).await?;
                    println!("[Player Ready] Sent ready packet for player {}", info.playerno);
                }

                let player = Player {
                    id: info.playerno,
                    name: info.name,
                    username: info.username,
                    is_alive: info.is_alive,
                    gold: info.gold,
                };
                self.ai.state.update_player(player);
            }
            PACKET_CITY_INFO => {
                let info: CityInfo = serde_json::from_value(packet.data.clone())?;
                println!("[City Info] #{} {} (owner: {}, size: {})", 
                    info.id, info.name, info.owner, info.size);

                let city = City {
                    id: info.id,
                    owner: info.owner,
                    name: info.name,
                    tile: info.tile,
                    size: info.size,
                    production_kind: info.production_kind,
                    production_value: info.production_value,
                };
                self.ai.state.update_city(city);
            }
            PACKET_UNIT_INFO => {
                let info: UnitInfo = serde_json::from_value(packet.data.clone())?;
                println!("[Unit Info] #{} (owner: {}, type: {}, tile: {})", 
                    info.id, info.owner, info.unit_type, info.tile);

                let unit = Unit {
                    id: info.id,
                    owner: info.owner,
                    tile: info.tile,
                    homecity: info.homecity,
                    unit_type: info.unit_type,
                    moves_left: info.moves_left,
                    hp: info.hp,
                };
                self.ai.state.update_unit(unit);
            }
            PACKET_SERVER_SHUTDOWN => {
                println!("[Server Shutdown]");
                self.connected = false;
            }
            _ => {
                // Log unknown packet types
                println!("[Unhandled] Packet type: {}", packet.pid);
            }
        }

        Ok(())
    }

    async fn process_ai_turn(&mut self) -> Result<()> {
        println!("\n>>> AI Processing Turn <<<");
        
        // Process the AI turn
        self.ai.process_turn().await?;
        
        // Send end turn packet
        if let Some(player_id) = self.ai.state.our_player_id {
            let end_turn = PlayerPhaseDone::new(player_id);
            self.send_packet(&end_turn).await?;
            println!(">>> AI Turn Complete - Sent PLAYER_PHASE_DONE <<<\n");
        }
        
        Ok(())
    }

    async fn run(&mut self) -> Result<()> {
        println!("Deity Rust AI starting as '{}'", self.username);
        println!("Sending join request...");

        // Send initial join request
        let join_req = ServerJoinReq::new(self.username.clone());
        self.send_packet(&join_req).await?;

        // Main game loop
        loop {
            match self.receive_packet().await? {
                Some(packet) => {
                    self.handle_packet(&packet).await?;

                    // Exit if server shutdown
                    if !self.connected {
                        break;
                    }
                }
                None => {
                    println!("Connection closed by server");
                    break;
                }
            }
        }

        // Print final state summary
        println!("\n=== Game Session Summary ===");
        println!("Players: {}", self.ai.state.players.len());
        println!("Cities: {}", self.ai.state.cities.len());
        println!("Units: {}", self.ai.state.units.len());
        if let Some(player_id) = self.ai.state.our_player_id {
            println!("Our Player ID: {}", player_id);
            println!("Our Cities: {}", self.ai.state.get_our_cities().len());
            println!("Our Units: {}", self.ai.state.get_our_units().len());
        }

        Ok(())
    }
}

#[tokio::main]
async fn main() -> Result<()> {
    let args = Args::parse();

    println!("===========================================");
    println!("      Deity Rust AI for Freeciv");
    println!("===========================================");
    println!("Server: {}:{}", args.host, args.port);
    println!("Username: {}", args.username);
    println!("===========================================");
    println!();

    let mut ai = DeityAI::connect(&args.host, args.port, args.username).await?;
    ai.run().await?;

    Ok(())
}
