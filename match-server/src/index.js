const express = require('express');
const { WebSocketServer } = require('ws');
const { MatchManager } = require('./match/MatchManager');
const { WalletRegistry } = require('./wallet/WalletRegistry');
const { setupRoutes } = require('./api/routes');

const PORT = process.env.PORT || 3001;

const app = express();
app.use(express.json());

const walletRegistry = new WalletRegistry();
const matchManager = new MatchManager(walletRegistry);

app.use('/api', setupRoutes(matchManager, walletRegistry));

const server = app.listen(PORT, () => {
  console.log(`匹配服务器运行在端口 ${PORT}`);
});

const wss = new WebSocketServer({ server });

wss.on('connection', (ws) => {
  console.log('新的WebSocket连接');

  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data);
      handleWebSocketMessage(ws, message);
    } catch (err) {
      console.error('WebSocket消息解析失败:', err);
    }
  });

  ws.on('close', () => {
    console.log('WebSocket连接关闭');
    walletRegistry.removeConnection(ws);
  });
});

function handleWebSocketMessage(ws, message) {
  const { type, wallet, matchId } = message;

  switch (type) {
    case 'register':
      walletRegistry.registerWallet(ws, wallet);
      break;
    case 'join_queue':
      const jwWallet = wallet || walletRegistry.getWallet(ws);
      if (jwWallet) {
        matchManager.joinQueue(jwWallet);
      } else {
        console.log('join_queue失败: 钱包未注册');
      }
      break;
    case 'leave_queue':
      const lwWallet = wallet || walletRegistry.getWallet(ws);
      if (lwWallet) {
        matchManager.leaveQueue(lwWallet);
      }
      break;
    case 'ready':
      if (matchId) {
        const rWallet = wallet || walletRegistry.getWallet(ws);
        if (rWallet) {
          matchManager.markReady(matchId, rWallet);
        }
      }
      break;
    default:
      console.log('未知消息类型:', type);
  }
}

setInterval(() => {
  matchManager.cleanupExpiredMatches();
}, 60000);

console.log('Card9匹配服务器已启动');
