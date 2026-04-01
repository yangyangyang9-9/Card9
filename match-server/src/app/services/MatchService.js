const API_BASE = 'http://localhost:3001/api';
const WS_BASE = 'ws://localhost:3001';

class MatchService {
  constructor() {
    this.ws = null;
    this.wallet = null;
    this.listeners = new Map();
  }

  async connect(wallet) {
    this.wallet = wallet;
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(WS_BASE);

      this.ws.onopen = () => {
        this.send({ type: 'register', wallet });
        resolve();
      };

      this.ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        this.notifyListeners(data.type, data);
      };

      this.ws.onerror = reject;
      this.ws.onclose = () => {
        this.notifyListeners('disconnected', {});
      };
    });
  }

  send(message) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
  }

  off(event, callback) {
    if (this.listeners.has(event)) {
      const callbacks = this.listeners.get(event);
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  notifyListeners(event, data) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach(callback => callback(data));
    }
  }

  async joinQueue() {
    const response = await fetch(`${API_BASE}/queue/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wallet: this.wallet })
    });
    return response.json();
  }

  async leaveQueue() {
    const response = await fetch(`${API_BASE}/queue/leave`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wallet: this.wallet })
    });
    return response.json();
  }

  async getMatchState() {
    const response = await fetch(`${API_BASE}/match/wallet/${this.wallet}/state`);
    return response.json();
  }

  async preCheck() {
    const response = await fetch(`${API_BASE}/match/wallet/${this.wallet}/precheck`);
    return response.json();
  }

  async markReady(matchId) {
    const response = await fetch(`${API_BASE}/match/${matchId}/ready`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wallet: this.wallet })
    });
    return response.json();
  }

  async getMatchInfo(matchId) {
    const response = await fetch(`${API_BASE}/match/${matchId}`);
    return response.json();
  }

  joinQueueWS() {
    this.send({ type: 'join_queue', wallet: this.wallet });
  }

  leaveQueueWS() {
    this.send({ type: 'leave_queue', wallet: this.wallet });
  }

  readyWS(matchId) {
    this.send({ type: 'ready', wallet: this.wallet, matchId });
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.listeners.clear();
  }
}

export const matchService = new MatchService();
