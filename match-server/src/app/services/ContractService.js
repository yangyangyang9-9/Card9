import { ethers } from 'ethers';

const CONTRACT_ADDRESS = '0x487bb9Df042f31d28B881F0C2E65095B31a0127d';
const MATCH_FEE = '0.00018';
const REQUIRED_BALANCE = ethers.parseEther(MATCH_FEE);

class ContractService {
  constructor() {
    this.provider = null;
    this.signer = null;
    this.contract = null;
    this.listeners = new Map();
  }

  async initialize() {
    if (typeof window.ethereum !== 'undefined') {
      this.provider = new ethers.BrowserProvider(window.ethereum);
      this.signer = await this.provider.getSigner();
      this.contract = new ethers.Contract(CONTRACT_ADDRESS, this.getABI(), this.signer);
      this.setupEventListeners();
      return true;
    }
    return false;
  }

  getABI() {
    return [
      'function createMatch(bytes32 matchId, address player2) payable',
      'function submitCards(bytes32 matchId, uint8[] calldata cardIndices) external',
      'function revealCards(bytes32 matchId, uint8[] calldata cardIndices, bytes32[] calldata salts) external',
      'function getMatchState(bytes32 matchId) external view returns (tuple(address player1, address player2, uint8 status, uint256 turnNumber, bool player1Revealed, bool player2Revealed, address winner))',
      'event MatchCreated(bytes32 indexed matchId, address indexed player1, address indexed player2, uint256 stake)',
      'event CardsDealt(bytes32 indexed matchId, bytes32 indexed player, bytes32 cardHash)',
      'event MatchSettled(bytes32 indexed matchId, address indexed winner, uint256 reward)',
      'event TurnStarted(bytes32 indexed matchId, uint8 turnNumber)',
      'event CardsSubmitted(bytes32 indexed matchId, address indexed player, bytes32 commitment)'
    ];
  }

  setupEventListeners() {
    if (!this.contract) return;

    this.contract.on('MatchCreated', (matchId, player1, player2, stake, event) => {
      this.notifyListeners('MatchCreated', { matchId, player1, player2, stake: ethers.formatEther(stake) });
    });

    this.contract.on('CardsDealt', (matchId, player, cardHash, event) => {
      this.notifyListeners('CardsDealt', { matchId, player, cardHash });
    });

    this.contract.on('MatchSettled', (matchId, winner, reward, event) => {
      this.notifyListeners('MatchSettled', { matchId, winner, reward: ethers.formatEther(reward) });
    });

    this.contract.on('TurnStarted', (matchId, turnNumber, event) => {
      this.notifyListeners('TurnStarted', { matchId, turnNumber });
    });
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

  async preCheck(matchInfo) {
    const result = {
      walletConnected: false,
      networkCorrect: false,
      balanceSufficient: false,
      gasEstimated: false,
      matchReady: false,
      errors: [],
      canProceed: false
    };

    if (!this.provider || !this.signer) {
      result.errors.push('钱包未连接');
      return result;
    }
    result.walletConnected = true;

    const network = await this.provider.getNetwork();
    if (Number(network.chainId) !== 97) {
      result.errors.push('请切换到 BSC Testnet 网络');
      return result;
    }
    result.networkCorrect = true;

    const balance = await this.provider.getBalance(this.signer.address);
    const required = REQUIRED_BALANCE + ethers.parseEther('0.001');
    if (balance < required) {
      result.errors.push(`余额不足，需要 ${MATCH_FEE} BNB，当前余额: ${ethers.formatEther(balance)} BNB`);
      return result;
    }
    result.balanceSufficient = true;

    if (!matchInfo || !matchInfo.canStartOnChain) {
      result.errors.push('匹配未完成或双方未准备就绪');
      return result;
    }
    result.matchReady = true;

    try {
      const matchId = matchInfo.matchId;
      const player2 = matchInfo.opponent;
      await this.contract.createMatch.estimateGas(matchId, player2, { value: REQUIRED_BALANCE });
      result.gasEstimated = true;
    } catch (error) {
      result.errors.push(`Gas 估算失败: ${error.reason || error.message}`);
      return result;
    }

    result.canProceed = true;
    return result;
  }

  async createMatch(matchId, player2) {
    if (!this.contract) {
      throw new Error('合约未初始化');
    }

    const preCheck = await this.preCheck({ matchId, player2, canStartOnChain: true });
    if (!preCheck.canProceed) {
      throw new Error(preCheck.errors.join(', '));
    }

    const tx = await this.contract.createMatch(matchId, player2, { value: REQUIRED_BALANCE });
    return await tx.wait();
  }

  async submitCards(matchId, cardIndices) {
    if (!this.contract) {
      throw new Error('合约未初始化');
    }
    const tx = await this.contract.submitCards(matchId, cardIndices);
    return await tx.wait();
  }

  async revealCards(matchId, cardIndices, salts) {
    if (!this.contract) {
      throw new Error('合约未初始化');
    }
    const tx = await this.contract.revealCards(matchId, cardIndices, salts);
    return await tx.wait();
  }

  async getOnChainMatchState(matchId) {
    if (!this.contract) {
      throw new Error('合约未初始化');
    }
    return await this.contract.getMatchState(matchId);
  }

  removeAllListeners() {
    if (this.contract) {
      this.contract.removeAllListeners();
    }
    this.listeners.clear();
  }
}

export const contractService = new ContractService();
