package org.freeciv.model;

public class Game {

	private String host;

	private int port;

	private String version;

	private String patches;

	private String type;

	private String state;

	private String message;

	private long duration;

	private int players;

	private int turn;

	private String flag;

	private String player;

	public long getDuration() {
		return duration;
	}

	public String getFlag() {
		return flag;
	}

	public String getHost() {
		return host;
	}

	public String getMessage() {
		return message;
	}

	public String getPatches() {
		return patches;
	}

	public String getPlayer() {
		return player;
	}

	public int getPlayers() {
		return players;
	}

	public int getPort() {
		return port;
	}

	public String getType() {
		return type;
	}

	public String getState() {
		return state;
	}

	public int getTurn() {
		return turn;
	}

	public String getVersion() {
		return version;
	}

	public boolean isProtected() {
		return (message != null) && message.contains("password-protected");
	}

	public Game setDuration(long duration) {
		this.duration = duration;
		return this;
	}

	public Game setFlag(String flag) {
		this.flag = flag;
		return this;
	}

	public Game setHost(String host) {
		this.host = host;
		return this;
	}

	public Game setMessage(String message) {
		this.message = message;
		return this;
	}

	public Game setPatches(String patches) {
		this.patches = patches;
		return this;
	}

	public Game setPlayer(String player) {
		this.player = player;
		return this;
	}

	public Game setPlayers(int players) {
		this.players = players;
		return this;
	}

	public Game setPort(int port) {
		this.port = port;
		return this;
	}

	public Game setType(String type) {
		this.type = type;
		return this;
	}

	public Game setState(String state) {
		this.state = state;
		return this;
	}

	public Game setTurn(int turn) {
		this.turn = turn;
		return this;
	}

	public Game setVersion(String version) {
		this.version = version;
		return this;
	}

	@Override
	public boolean equals(Object o) {
		if (this == o) return true;
		if (o == null || getClass() != o.getClass()) return false;
		Game game = (Game) o;
		return port == game.port &&
				duration == game.duration &&
				players == game.players &&
				turn == game.turn &&
				java.util.Objects.equals(host, game.host) &&
				java.util.Objects.equals(version, game.version) &&
				java.util.Objects.equals(patches, game.patches) &&
				java.util.Objects.equals(type, game.type) &&
				java.util.Objects.equals(state, game.state) &&
				java.util.Objects.equals(message, game.message) &&
				java.util.Objects.equals(flag, game.flag) &&
				java.util.Objects.equals(player, game.player);
	}

	@Override
	public int hashCode() {
		return java.util.Objects.hash(host, port, version, patches, type, state, message, duration, players, turn, flag, player);
	}

	@Override
	public String toString() {
		return "Game{" +
				"host='" + host + '\'' +
				", port=" + port +
				", version='" + version + '\'' +
				", patches='" + patches + '\'' +
				", type='" + type + '\'' +
				", state='" + state + '\'' +
				", message='" + message + '\'' +
				", duration=" + duration +
				", players=" + players +
				", turn=" + turn +
				", flag='" + flag + '\'' +
				", player='" + player + '\'' +
				'}';
	}

}
