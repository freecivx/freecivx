package net.freecivx.game;

public class Connection {

    private long id;
    private String username;
    private long playerNo;
    private String ip;

    public Connection(long id, String username, long playerNo, String ip) {
        this.id = id;
        this.username = username;
        this.playerNo = playerNo;
        this.ip = ip;
    }


    public long getId() {
        return id;
    }

    public void setId(long id) {
        this.id = id;
    }

    public String getUsername() {
        return username;
    }

    public void setUsername(String username) {
        this.username = username;
    }

    public long getPlayerNo() {
        return playerNo;
    }

    public void setPlayerNo(long playerNo) {
        this.playerNo = playerNo;
    }

    public String getIp() {
        return ip;
    }

    public void setIp(String ip) {
        this.ip = ip;
    }
}
