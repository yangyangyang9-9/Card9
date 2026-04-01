import { useState, useEffect, useCallback } from 'react';
import { matchService } from '../services/MatchService';
import { contractService } from '../services/ContractService';

const MatchState = {
  IDLE: 'idle',
  CONNECTING: 'connecting',
  WAITING_QUEUE: 'waiting_queue',
  MATCHED: 'matched',
  WAITING_READY: 'waiting_ready',
  READY_BOTH: 'ready_both',
  CHECKING_ONCHAIN: 'checking_onchain',
  ONCHAIN_PENDING: 'onchain_pending',
  CARDS_DEALT: 'cards_dealt',
  PLAYER_TURN: 'player_turn',
  OPPONENT_TURN: 'opponent_turn',
  MATCH_ENDED: 'match_ended',
  ERROR: 'error'
};

export function useMatchMachine() {
  const [state, setState] = useState(MatchState.IDLE);
  const [matchInfo, setMatchInfo] = useState(null);
  const [cards, setCards] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    matchService.on('match_created', handleMatchCreated);
    matchService.on('ready_status', handleReadyStatus);
    matchService.on('both_ready', handleBothReady);
    matchService.on('match_expired', handleMatchExpired);
    matchService.on('CardsDealt', handleCardsDealt);

    return () => {
      matchService.off('match_created', handleMatchCreated);
      matchService.off('ready_status', handleReadyStatus);
      matchService.off('both_ready', handleBothReady);
      matchService.off('match_expired', handleMatchExpired);
      matchService.off('CardsDealt', handleCardsDealt);
    };
  }, []);

  useEffect(() => {
    if (contractService) {
      contractService.on('MatchCreated', handleContractMatchCreated);
      contractService.on('CardsDealt', handleContractCardsDealt);
      contractService.on('MatchSettled', handleContractMatchSettled);

      return () => {
        contractService.off('MatchCreated', handleContractMatchCreated);
        contractService.off('CardsDealt', handleContractCardsDealt);
        contractService.off('MatchSettled', handleContractMatchSettled);
      };
    }
  }, []);

  const handleMatchCreated = useCallback((data) => {
    setMatchInfo({
      matchId: data.matchId,
      opponent: data.opponent,
      player1: data.yourAddress,
      player2: data.opponentAddress
    });
    setState(MatchState.MATCHED);
  }, []);

  const handleReadyStatus = useCallback((data) => {
    setMatchInfo(prev => ({
      ...prev,
      youReady: data.youReady,
      opponentReady: data.opponentReady
    }));
    setState(MatchState.WAITING_READY);
  }, []);

  const handleBothReady = useCallback((data) => {
    setMatchInfo(prev => ({
      ...prev,
      startOnChainParams: data.startOnChainParams
    }));
    setState(MatchState.READY_BOTH);
  }, []);

  const handleMatchExpired = useCallback((data) => {
    setError(`匹配超时: ${data.reason}`);
    setState(MatchState.ERROR);
    setMatchInfo(null);
  }, []);

  const handleCardsDealt = useCallback((data) => {
    setCards(data.cards || []);
    setState(MatchState.CARDS_DEALT);
  }, []);

  const handleContractMatchCreated = useCallback((data) => {
    setState(MatchState.ONCHAIN_PENDING);
  }, []);

  const handleContractCardsDealt = useCallback((data) => {
    setCards(prev => [...prev, data]);
    setState(MatchState.CARDS_DEALT);
  }, []);

  const handleContractMatchSettled = useCallback((data) => {
    setMatchInfo(prev => ({ ...prev, winner: data.winner }));
    setState(MatchState.MATCH_ENDED);
  }, []);

  const connect = useCallback(async (wallet) => {
    try {
      setState(MatchState.CONNECTING);
      await matchService.connect(wallet);
      await contractService.initialize();
      await restoreState();
    } catch (err) {
      setError(err.message);
      setState(MatchState.ERROR);
    }
  }, []);

  const restoreState = useCallback(async () => {
    try {
      const state = await matchService.getMatchState();
      if (state.inQueue) {
        setState(MatchState.WAITING_QUEUE);
      } else if (state.matched) {
        setMatchInfo(state);
        if (state.canStartOnChain) {
          setState(MatchState.READY_BOTH);
        } else {
          setState(MatchState.WAITING_READY);
        }
      } else {
        setState(MatchState.IDLE);
      }
    } catch (err) {
      setError(err.message);
    }
  }, []);

  const joinQueue = useCallback(async () => {
    try {
      setError(null);
      const result = await matchService.joinQueue();

      if (!result.matched) {
        setState(MatchState.WAITING_QUEUE);
      } else {
        setMatchInfo({
          matchId: result.matchId,
          opponent: result.opponent
        });
        setState(MatchState.MATCHED);
      }
      return result;
    } catch (err) {
      setError(err.message);
      setState(MatchState.ERROR);
      throw err;
    }
  }, []);

  const leaveQueue = useCallback(async () => {
    try {
      await matchService.leaveQueue();
      setState(MatchState.IDLE);
      setMatchInfo(null);
    } catch (err) {
      setError(err.message);
    }
  }, []);

  const markReady = useCallback(async (matchId) => {
    try {
      await matchService.markReady(matchId);
    } catch (err) {
      setError(err.message);
    }
  }, []);

  const startOnChain = useCallback(async () => {
    if (!matchInfo || !matchInfo.canStartOnChain) {
      throw new Error('匹配未完成或双方未准备就绪');
    }

    const preCheck = await contractService.preCheck(matchInfo);
    if (!preCheck.canProceed) {
      throw new Error(preCheck.errors.join(', '));
    }

    try {
      setState(MatchState.ONCHAIN_PENDING);
      await contractService.createMatch(matchInfo.matchId, matchInfo.opponent);
    } catch (err) {
      setError(err.message);
      setState(MatchState.ERROR);
      throw err;
    }
  }, [matchInfo]);

  const submitCards = useCallback(async (cardIndices) => {
    if (!matchInfo) {
      throw new Error('无活动匹配');
    }
    try {
      await contractService.submitCards(matchInfo.matchId, cardIndices);
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, [matchInfo]);

  const reset = useCallback(() => {
    setState(MatchState.IDLE);
    setMatchInfo(null);
    setCards([]);
    setError(null);
  }, []);

  return {
    state,
    matchInfo,
    cards,
    error,
    MatchState,
    connect,
    joinQueue,
    leaveQueue,
    markReady,
    startOnChain,
    submitCards,
    reset
  };
}
