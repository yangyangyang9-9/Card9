const MatchStatus = {
  IDLE: 'IDLE',
  MATCHING: 'MATCHING',
  MATCHED: 'MATCHED',
  READY_P1: 'READY_P1',
  READY_P2: 'READY_P2',
  READY_BOTH: 'READY_BOTH',
  ONCHAIN_PENDING: 'ONCHAIN_PENDING',
  ONCHAIN_STARTED: 'ONCHAIN_STARTED',
  EXPIRED: 'EXPIRED'
};

const READY_TIMEOUT_MS = 60000;
const MATCH_TIMEOUT_MS = 300000;

class Match {
  constructor(id, player1, player2) {
    this.id = id;
    this.player1 = player1;
    this.player2 = player2;
    this.status = MatchStatus.MATCHED;
    this.player1Ready = false;
    this.player2Ready = false;
    this.player1Signature = null;
    this.player2Signature = null;
    this.createdAt = Date.now();
    this.readyAt = null;
    this.onchainTx = null;
  }

  markReady(wallet, signature) {
    if (wallet === this.player1) {
      this.player1Ready = true;
      this.player1Signature = signature;
      if (this.player2Ready) {
        this.status = MatchStatus.READY_BOTH;
        this.readyAt = Date.now();
      } else {
        this.status = MatchStatus.READY_P1;
      }
    } else if (wallet === this.player2) {
      this.player2Ready = true;
      this.player2Signature = signature;
      if (this.player1Ready) {
        this.status = MatchStatus.READY_BOTH;
        this.readyAt = Date.now();
      } else {
        this.status = MatchStatus.READY_P2;
      }
    }
    return this.status === MatchStatus.READY_BOTH;
  }

  isReadyExpired() {
    if (!this.readyAt) return false;
    return Date.now() - this.readyAt > READY_TIMEOUT_MS;
  }

  isMatchExpired() {
    return Date.now() - this.createdAt > MATCH_TIMEOUT_MS;
  }

  getOpponent(wallet) {
    if (wallet === this.player1) return this.player2;
    if (wallet === this.player2) return this.player1;
    return null;
  }

  toJSON() {
    return {
      id: this.id,
      player1: this.player1,
      player2: this.player2,
      status: this.status,
      player1Ready: this.player1Ready,
      player2Ready: this.player2Ready,
      createdAt: this.createdAt,
      readyAt: this.readyAt
    };
  }
}

module.exports = { Match, MatchStatus };
