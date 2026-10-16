import { Actor } from 'base44:runtime/actors';

// Realtime signaling relay for Go Live camera broadcasts. One room per live
// target (room id = `live_<auction|event>_<id>`). A single broadcaster (the
// auctioneer) and N viewers exchange WebRTC SDP offers/answers and ICE
// candidates through this room; the actual video/audio flows peer-to-peer
// directly between the broadcaster and each viewer (a mesh), so the actor only
// relays lightweight signaling — it never touches media. The actor is
// AUTHORITATIVE for routing: clients send signaling operations, the actor
// forwards them to the right peer by server-assigned seat. Seats (never
// client-held conn ids) appear in broadcasts so peers can address each other.
const MAX = 32;

export default class LiveRoom extends Actor {
  users = new Map();        // conn.id -> { seat, role }
  nextSeat = 1;
  broadcasterSeat = null;

  async handleStart() {
    const seats = await this.storage.get('seats');
    if (seats) this.users = new Map(seats);
    this.broadcasterSeat = (await this.storage.get('broadcasterSeat')) || null;
    const live = new Set(this.getConnections().map((c) => c.id));
    for (const id of this.users.keys()) if (!live.has(id)) this.users.delete(id);
    this.nextSeat = Math.max(0, ...[...this.users.values()].map((u) => u.seat)) + 1;
  }

  connBySeat(seat) {
    return this.getConnections().find((c) => this.users.get(c.id) && this.users.get(c.id).seat === seat) || null;
  }

  async handleConnect(conn) {
    if (!this.users.has(conn.id) && this.users.size >= MAX) {
      conn.reject(4001, 'room full');
      return;
    }
    if (!this.users.has(conn.id)) {
      this.users.set(conn.id, { seat: this.nextSeat++, role: 'viewer' });
      await this.storage.put('seats', [...this.users.entries()]);
    }
    const seat = this.users.get(conn.id).seat;
    conn.send({ type: 'you', seat });
    if (this.broadcasterSeat) conn.send({ type: 'broadcaster', seat: this.broadcasterSeat });
  }

  async handleMessage(conn, msg) {
    if (typeof msg !== 'object' || msg === null) return;
    const me = this.users.get(conn.id);
    if (!me) return;

    if (msg.type === 'broadcaster_join') {
      me.role = 'broadcaster';
      this.broadcasterSeat = me.seat;
      await this.storage.put('broadcasterSeat', this.broadcasterSeat);
      this.broadcast({ type: 'broadcaster', seat: this.broadcasterSeat });
    } else if (msg.type === 'viewer_join') {
      me.role = 'viewer';
      const bc = this.connBySeat(this.broadcasterSeat);
      if (bc) bc.send({ type: 'viewer_joined', seat: me.seat });
    } else if (msg.type === 'offer' && typeof msg.sdp === 'string') {
      const bc = this.connBySeat(this.broadcasterSeat);
      if (bc) bc.send({ type: 'offer', from: me.seat, sdp: msg.sdp });
    } else if (msg.type === 'answer' && typeof msg.sdp === 'string' && Number.isInteger(msg.to)) {
      const v = this.connBySeat(msg.to);
      if (v) v.send({ type: 'answer', sdp: msg.sdp });
    } else if (msg.type === 'ice' && msg.candidate && Number.isInteger(msg.to)) {
      const target = this.connBySeat(msg.to);
      if (target) target.send({ type: 'ice', from: me.seat, candidate: msg.candidate });
    } else if (msg.type === 'end' && me.role === 'broadcaster') {
      this.broadcasterSeat = null;
      await this.storage.put('broadcasterSeat', null);
      this.broadcast({ type: 'broadcaster_left' });
    }
  }

  async handleClose(conn) {
    const me = this.users.get(conn.id);
    this.users.delete(conn.id);
    await this.storage.put('seats', [...this.users.entries()]);
    if (!me) return;
    if (me.role === 'broadcaster' || me.seat === this.broadcasterSeat) {
      this.broadcasterSeat = null;
      await this.storage.put('broadcasterSeat', null);
      this.broadcast({ type: 'broadcaster_left' });
    } else {
      const bc = this.connBySeat(this.broadcasterSeat);
      if (bc) bc.send({ type: 'viewer_left', seat: me.seat });
    }
  }
}