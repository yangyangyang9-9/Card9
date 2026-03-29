class WalletRegistry {
  constructor() {
    this.walletToConnection = new Map();
    this.connectionToWallet = new Map();
    this.walletInfo = new Map();
  }

  registerWallet(ws, wallet) {
    const normalizedWallet = wallet.toLowerCase();

    const existingWs = this.walletToConnection.get(normalizedWallet);
    if (existingWs && existingWs !== ws) {
      this.connectionToWallet.delete(existingWs);
    }

    this.walletToConnection.set(normalizedWallet, ws);
    this.connectionToWallet.set(ws, normalizedWallet);

    if (!this.walletInfo.has(normalizedWallet)) {
      this.walletInfo.set(normalizedWallet, {
        connectedAt: Date.now(),
        lastActivity: Date.now()
      });
    }

    console.log(`钱包注册: ${normalizedWallet}`);
  }

  removeConnection(ws) {
    const wallet = this.connectionToWallet.get(ws);
    if (wallet) {
      this.walletToConnection.delete(wallet);
      this.connectionToWallet.delete(ws);
      console.log(`钱包断开连接: ${wallet}`);
    }
  }

  getConnection(wallet) {
    const normalizedWallet = wallet.toLowerCase();
    return this.walletToConnection.get(normalizedWallet);
  }

  getWallet(ws) {
    return this.connectionToWallet.get(ws);
  }

  isConnected(wallet) {
    const normalizedWallet = wallet.toLowerCase();
    const ws = this.walletToConnection.get(normalizedWallet);
    return ws && ws.readyState === 1;
  }

  updateActivity(wallet) {
    const normalizedWallet = wallet.toLowerCase();
    const info = this.walletInfo.get(normalizedWallet);
    if (info) {
      info.lastActivity = Date.now();
    }
  }

  getConnectedWallets() {
    return Array.from(this.walletToConnection.keys());
  }
}

module.exports = { WalletRegistry };
