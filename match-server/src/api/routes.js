const express = require('express');
const { MatchStatus } = require('../match/Match');
const ethers = require('ethers');

function setupRoutes(matchManager, walletRegistry) {
  const router = express.Router();

  router.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: Date.now() });
  });

  router.get('/queue/status', (req, res) => {
    const wallet = req.query.wallet;
    if (wallet) {
      res.json({
        inQueue: matchManager.isInQueue(wallet),
        position: matchManager.getQueuePosition(wallet),
        queueLength: matchManager.getQueueLength()
      });
    } else {
      res.json({
        queueLength: matchManager.getQueueLength(),
        connectedWallets: walletRegistry.getConnectedWallets().length
      });
    }
  });

  router.post('/queue/join', (req, res) => {
    const { wallet } = req.body;
    if (!wallet) {
      return res.status(400).json({ error: 'wallet_required' });
    }

    const ws = walletRegistry.getConnection(wallet);
    if (!ws) {
      return res.status(400).json({ error: 'wallet_not_connected' });
    }

    const result = matchManager.joinQueue(wallet);
    if (!result.success) {
      return res.status(400).json(result);
    }
    res.json(result);
  });

  router.post('/queue/leave', (req, res) => {
    const { wallet } = req.body;
    if (!wallet) {
      return res.status(400).json({ error: 'wallet_required' });
    }

    const success = matchManager.leaveQueue(wallet);
    res.json({ success });
  });

  router.get('/match/:matchId', (req, res) => {
    const { matchId } = req.params;
    const match = matchManager.getMatchStatus(matchId);
    if (!match) {
      return res.status(404).json({ error: 'match_not_found' });
    }
    res.json(match.toJSON());
  });

  router.get('/match/wallet/:wallet', (req, res) => {
    const { wallet } = req.params;
    const match = matchManager.getMatchByWallet(wallet);
    if (!match) {
      return res.status(404).json({ error: 'no_active_match' });
    }
    res.json(match.toJSON());
  });

  router.get('/match/wallet/:wallet/state', (req, res) => {
    const { wallet } = req.params;
    const state = matchManager.getMatchState(wallet);
    res.json(state);
  });

  router.get('/match/wallet/:wallet/precheck', (req, res) => {
    const { wallet } = req.params;
    const state = matchManager.getMatchState(wallet);

    const MATCH_FEE = '0.00018';
    const REQUIRED_BALANCE = ethers.BigNumber.from(ethers.parseEther(MATCH_FEE));

    const result = {
      canJoinMatch: !state.inQueue && !state.matched,
      canStartOnChain: state.canStartOnChain,
      opponentFound: state.matched,
      matchReady: state.status === MatchStatus.READY_BOTH,
      requirements: {
        matchFee: MATCH_FEE,
        estimatedGas: '0.0001',
        totalRequired: String(parseFloat(MATCH_FEE) + 0.0001)
      },
      currentState: state
    };

    res.json(result);
  });

  router.post('/match/:matchId/ready', (req, res) => {
    const { matchId } = req.params;
    const { wallet, signature } = req.body;
    if (!wallet) {
      return res.status(400).json({ error: 'wallet_required' });
    }

    const result = matchManager.markReady(matchId, wallet, signature);
    if (!result.success) {
      return res.status(400).json(result);
    }
    res.json(result);
  });

  router.post('/match/:matchId/cancel', (req, res) => {
    const { matchId } = req.params;
    const { wallet } = req.body;
    if (!wallet) {
      return res.status(400).json({ error: 'wallet_required' });
    }

    const result = matchManager.cancelMatch(matchId, wallet);
    if (!result.success) {
      return res.status(400).json(result);
    }
    res.json(result);
  });

  router.get('/match/:matchId/status', (req, res) => {
    const { matchId } = req.params;
    const match = matchManager.getMatchStatus(matchId);
    if (!match) {
      return res.status(404).json({ error: 'match_not_found' });
    }
    res.json({
      matchId: match.id,
      status: match.status,
      player1: match.player1,
      player2: match.player2,
      player1Ready: match.player1Ready,
      player2Ready: match.player2Ready,
      bothReady: match.status === MatchStatus.READY_BOTH
    });
  });

  return router;
}

module.exports = { setupRoutes };
