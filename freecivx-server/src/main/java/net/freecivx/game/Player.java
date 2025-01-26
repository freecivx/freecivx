package net.freecivx.game;

public class Player {

    private long connectionId;
    private String username;
    private String address;
    private int nation;

    // Constructor
    public Player(long connId, String username, String addr, int nation) {
        this.connectionId = connId;
        this.username = username;
        this.address = addr;
        this.nation = nation;
    }

    // Getters and Setters
    public long getConnectionId() {
        return connectionId;
    }

    public void setConnectionId(long connectionId) {
        this.connectionId = connectionId;
    }

    public String getUsername() {
        return username;
    }

    public void setUsername(String username) {
        this.username = username;
    }

    public String getAddress() {
        return address;
    }

    public void setAddress(String address) {
        this.address = address;
    }

    public int getNation() {
        return nation;
    }

    public void setNation(int nation) {
        this.nation = nation;
    }

    public long getPlayerNo() {
        return this.connectionId;
    }

    // Utility methods
    @Override
    public String toString() {
        return "Player{" +
                "connectionId=" + connectionId +
                ", username='" + username + '\'' +
                ", address='" + address + '\'' +
                ", nation=" + nation +
                '}';
    }

}
