package main

import (
	"encoding/json"
	"fmt"
	"sync/atomic"
)

// Packet type identifiers used in the Freeciv WebSocket protocol.
// The JavaScript client identifies every packet with a "pid" field; the
// constants below mirror the values in
// freeciv-web/src/derived/webapp/javascript/packets.js and
// freeciv/freeciv/common/networking/packets.def.
const (
	pidServerJoinReq  = 4   // cs: client → server login request
	pidServerJoinReply = 5  // sc: server → client login reply
	pidServerShutdown = 8   // sc: server is shutting down
	pidConnPing       = 88  // sc: server → client ping
	pidConnPong       = 89  // cs: client → server pong
	pidConnInfo       = 115 // sc: server → client connection info
	pidClientInfo     = 119 // cs: client → server client info (ignored)
)

// Freeciv capability string advertised to connecting clients.
// Must match the value in freeciv-web/src/main/webapp/javascript/clinet.js.
const serverCapability = "+Freeciv.Web.Devel-3.3"

// connIDCounter is used to assign a unique numeric ID to each WebSocket
// connection.  It starts at 1 so that 0 is never a valid connection ID
// (the JS client uses -1 for "not connected").
var connIDCounter atomic.Int64

func init() {
	connIDCounter.Store(0)
}

// nextConnID returns the next unique connection ID.
func nextConnID() int64 {
	return connIDCounter.Add(1)
}

// serverJoinReq is the login packet sent by the JavaScript client (pid = 4).
type serverJoinReq struct {
	PID          int    `json:"pid"`
	Username     string `json:"username"`
	Capability   string `json:"capability"`
	VersionLabel string `json:"version_label"`
	MajorVersion int    `json:"major_version"`
	MinorVersion int    `json:"minor_version"`
	PatchVersion int    `json:"patch_version"`
}

// serverJoinReply is the server response to a login request (pid = 5).
type serverJoinReply struct {
	PID           int    `json:"pid"`
	YouCanJoin    bool   `json:"you_can_join"`
	Message       string `json:"message"`
	Capability    string `json:"capability"`
	ChallengeFile string `json:"challenge_file"`
	ConnID        int64  `json:"conn_id"`
}

// connInfo describes a connection to all clients (pid = 115).
type connInfo struct {
	PID         int    `json:"pid"`
	ID          int64  `json:"id"`
	Used        bool   `json:"used"`
	Established bool   `json:"established"`
	Observer    bool   `json:"observer"`
	PlayerNum   int    `json:"player_num"`
	AccessLevel int    `json:"access_level"`
	Username    string `json:"username"`
	Addr        string `json:"addr"`
	Capability  string `json:"capability"`
}

// connPing is the server-to-client keepalive packet (pid = 88).
type connPing struct {
	PID int `json:"pid"`
}

// marshalPacket serialises v to JSON, returning a formatted error message
// if marshalling fails.
func marshalPacket(v any) ([]byte, error) {
	b, err := json.Marshal(v)
	if err != nil {
		return nil, fmt.Errorf("marshalPacket: %w", err)
	}
	return b, nil
}
