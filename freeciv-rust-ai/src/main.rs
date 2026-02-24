use anyhow::{Context, Result};
use clap::Parser;
use serde::{Deserialize, Serialize};
use serde_json::Value;
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

#[derive(Debug, Serialize, Deserialize)]
struct FreecivPacket {
    pid: u32,
    #[serde(flatten)]
    data: Value,
}

struct DeityAI {
    stream: TcpStream,
    username: String,
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

        Ok(DeityAI { stream, username })
    }

    async fn send_packet(&mut self, packet: &FreecivPacket) -> Result<()> {
        let json_str = serde_json::to_string(packet)?;
        let json_bytes = json_str.as_bytes();

        // Send packet length as 2-byte header (big-endian)
        let len = (json_bytes.len() as u16).to_be_bytes();
        self.stream.write_all(&len).await?;

        // Send JSON packet
        self.stream.write_all(json_bytes).await?;
        self.stream.flush().await?;

        println!("Sent packet: {}", json_str);
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

        // Read JSON packet
        let mut buf = vec![0u8; len];
        self.stream.read_exact(&mut buf).await?;

        let json_str = String::from_utf8(buf)?;
        println!("Received packet: {}", json_str);

        let packet: FreecivPacket = serde_json::from_str(&json_str)?;
        Ok(Some(packet))
    }

    async fn handle_packet(&mut self, packet: &FreecivPacket) -> Result<()> {
        println!("Handling packet ID: {}", packet.pid);

        // TODO: Implement proper packet handling based on packets.def
        // For now, just log the packet
        match packet.pid {
            _ => {
                println!("Unhandled packet type: {}", packet.pid);
            }
        }

        Ok(())
    }

    async fn run(&mut self) -> Result<()> {
        println!("Deity Rust AI starting as '{}'", self.username);

        // Main game loop
        loop {
            match self.receive_packet().await? {
                Some(packet) => {
                    self.handle_packet(&packet).await?;
                }
                None => {
                    println!("Connection closed by server");
                    break;
                }
            }
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
