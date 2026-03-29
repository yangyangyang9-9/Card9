const { v4: uuidv4 } = require('uuid');
const { Match, MatchStatus } = require('./Match');

class MatchManager {
  constructor(walletRegistry) {
    this.walletRegistry = walletRegistry;
    this.queue = [];
    this.matches = new Map();
    this.playerToMatch = new Map();
  }

  joinQueue(wallet) {
    const normalizedWallet = wallet.toLowerCase();
    const ws = this.walletRegistry.getConnection(normalizedWallet);
    if (!ws) {
      console.log(`钱包 ${normalizedWallet} 未连接WebSocket`);
      return null;
    }

    if (this.isInQueue(normalizedWallet)) {
      console.log(`钱包 ${normalizedWallet} 已在队列中`);
      return this.getQueuePosition(normalizedWallet);
    }

    const existingMatch = this.playerToMatch.get(normalizedWallet);
    if (existingMatch) {
      console.log(`钱包 ${normalizedWallet} 已在匹配 ${existingMatch} 中`);
      return existingMatch;
    }

    this.queue.push(normalizedWallet);
    console.log(`钱包 ${normalizedWallet} 加入匹配队列，当前队列长度: ${this.queue.length}`);

    if (this.queue.length >= 2) {
      return this.createMatch();
    }

    return this.getQueuePosition(normalizedWallet);
  }

  leaveQueue(wallet) {
    const normalizedWallet = wallet.toLowerCase();
    const index = this.queue.indexOf(normalizedWallet);
    if (index !== -1) {
      this.queue.splice(index, 1);
      console.log(`钱包 ${normalizedWallet} 离开匹配队列`);
      return true;
    }
    return false;
  }

  createMatch() {
    if (this.queue.length < 2) {
      return null;
    }

    const player1 = this.queue.shift();
    const player2 = this.queue.shift();

    console.log(`[createMatch] player1=${player1}, player2=${player2}`);
    console.log(`[createMatch] queue now length=${this.queue.length}`);

    const matchId = uuidv4();
    const match = new Match(matchId, player1, player2);

    this.matches.set(matchId, match);
    this.playerToMatch.set(player1, matchId);
    this.playerToMatch.set(player2, matchId);

    console.log(`创建匹配 ${matchId}: ${player1} vs ${player2}`);
    console.log(`[playerToMatch] keys:`, Array.from(this.playerToMatch.keys()));

    this.notifyMatchCreated(match);

    return matchId;
  }

  notifyMatchCreated(match) {
    const ws1 = this.walletRegistry.getConnection(match.player1);
    const ws2 = this.walletRegistry.getConnection(match.player2);

    const message = {
      type: 'match_created',
      matchId: match.id,
      opponent: null,
      yourAddress: match.player1,
      opponentAddress: match.player2
    };

    if (ws1 && ws1.readyState === 1) {
      ws1.send(JSON.stringify({
        ...message,
        opponent: match.player2,
        yourAddress: match.player1
      }));
    }

    if (ws2 && ws2.readyState === 1) {
      ws2.send(JSON.stringify({
        ...message,
        opponent: match.player1,
        yourAddress: match.player2
      }));
    }
  }

  markReady(matchId, wallet, signature = null) {
    const match = this.matches.get(matchId);
    if (!match) {
      console.log(`匹配 ${matchId} 不存在`);
      return { success: false, error: 'match_not_found' };
    }

    if (wallet !== match.player1 && wallet !== match.player2) {
      console.log(`钱包 ${wallet} 不属于匹配 ${matchId}`);
      return { success: false, error: 'not_in_match' };
    }

    if (match.status === MatchStatus.READY_BOTH) {
      return { success: true, status: MatchStatus.READY_BOTH, alreadyReady: true };
    }

    const bothReady = match.markReady(wallet, signature);
    console.log(`钱包 ${wallet} 在匹配 ${matchId} 中准备就绪`);

    this.notifyReadyStatus(match);

    if (bothReady) {
      this.notifyReadyBoth(match);
      return { success: true, status: MatchStatus.READY_BOTH };
    }

    return { success: true, status: match.status };
  }

  notifyReadyStatus(match) {
    const sendStatus = (ws, wallet) => {
      if (ws && ws.readyState === 1) {
        ws.send(JSON.stringify({
          type: 'ready_status',
          matchId: match.id,
          youReady: wallet === match.player1 ? match.player1Ready : match.player2Ready,
          opponentReady: wallet === match.player1 ? match.player2Ready : match.player1Ready
        }));
      }
    };

    sendStatus(this.walletRegistry.getConnection(match.player1), match.player1);
    sendStatus(this.walletRegistry.getConnection(match.player2), match.player2);
  }

  notifyReadyBoth(match) {
    const sendGoOnline = (ws, wallet) => {
      if (ws && ws.readyState === 1) {
        ws.send(JSON.stringify({
          type: 'both_ready',
          matchId: match.id,
          message: '双方已准备，可以开始链上操作',
          startOnChainParams: {
            matchId: match.id,
            player1: match.player1,
            player2: match.player2
          }
        }));
      }
    };

    sendGoOnline(this.walletRegistry.getConnection(match.player1), match.player1);
    sendGoOnline(this.walletRegistry.getConnection(match.player2), match.player2);
  }

  getMatchStatus(matchId) {
    return this.matches.get(matchId);
  }

  getMatchByWallet(wallet) {
    const normalizedWallet = wallet.toLowerCase();
    const matchId = this.playerToMatch.get(normalizedWallet);
    if (matchId) {
      return this.matches.get(matchId);
    }
    return null;
  }

  cleanupExpiredMatches() {
    const now = Date.now();
    for (const [matchId, match] of this.matches) {
      if (match.isMatchExpired() || match.isReadyExpired()) {
        console.log(`匹配 ${matchId} 已过期，清理中...`);
        this.cleanupMatch(matchId);
      }
    }
  }

  cleanupMatch(matchId) {
    const match = this.matches.get(matchId);
    if (!match) return;

    const notifyPlayer = (wallet, reason) => {
      const ws = this.walletRegistry.getConnection(wallet);
      if (ws && ws.readyState === 1) {
        ws.send(JSON.stringify({
          type: 'match_expired',
          matchId: matchId,
          reason: reason
        }));
      }
    };

    notifyPlayer(match.player1, 'match_timeout');
    notifyPlayer(match.player2, 'match_timeout');

    this.playerToMatch.delete(match.player1);
    this.playerToMatch.delete(match.player2);
    this.matches.delete(matchId);
  }

  cancelMatch(matchId, wallet) {
    const match = this.matches.get(matchId);
    if (!match) {
      return { success: false, error: 'match_not_found' };
    }

    if (wallet !== match.player1 && wallet !== match.player2) {
      return { success: false, error: 'not_in_match' };
    }

    this.cleanupMatch(matchId);
    return { success: true };
  }

  isInQueue(wallet) {
    const normalizedWallet = wallet.toLowerCase();
    return this.queue.includes(normalizedWallet);
  }

  getQueuePosition(wallet) {
    const normalizedWallet = wallet.toLowerCase();
    const index = this.queue.indexOf(normalizedWallet);
    return index !== -1 ? index + 1 : null;
  }

  getQueueLength() {
    return this.queue.length;
  }
}

module.exports = { MatchManager };
