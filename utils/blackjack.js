const { getUserBalance, addBalance, subtractBalance, forceSetBalance } = require('./ankoDollar');

const SUITS = ['♠', '♥', '♦', '♣'];
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

const activeGames = new Map();
const pendingPvPInvites = new Map();

function createDeck() {
  const deck = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ suit, rank });
    }
  }
  return deck;
}

function shuffleDeck(deck) {
  const shuffled = [...deck];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function getCardValue(card, currentTotal = 0) {
  if (card.rank === 'A') {
    return (currentTotal + 11 <= 21) ? 11 : 1;
  } else if (['J', 'Q', 'K'].includes(card.rank)) {
    return 10;
  } else {
    return parseInt(card.rank);
  }
}

function calculateHandValue(hand) {
  let total = 0;
  let aces = 0;

  for (const card of hand) {
    if (card.rank === 'A') {
      aces++;
      total += 11;
    } else if (['J', 'Q', 'K'].includes(card.rank)) {
      total += 10;
    } else {
      total += parseInt(card.rank);
    }
  }

  while (total > 21 && aces > 0) {
    total -= 10;
    aces--;
  }

  return total;
}

function formatCard(card) {
  return `${card.rank}${card.suit}`;
}

function formatHand(hand) {
  return hand.map(formatCard).join(' ');
}

function isBlackjack(hand) {
  return hand.length === 2 && calculateHandValue(hand) === 21;
}

async function createGame(userId, bet, vsAI = true, opponentId = null, guildId = null) {
  const result = await subtractBalance(userId, bet, true);
  if (!result.success) {
    const currentBalance = await getUserBalance(userId);
    if (result.error === 'debt_limit_exceeded') {
      return {
        success: false,
        error: 'debt_limit_exceeded',
        balance: currentBalance,
        limit: result.limit
      };
    }
    if (result.error === 'insufficient_funds') {
      return {
        success: false,
        error: 'insufficient_funds',
        balance: currentBalance
      };
    }
    return { ...result, balance: currentBalance };
  }

  const deck = shuffleDeck(createDeck());
  
  const playerHand = [deck.pop(), deck.pop()];
  const dealerHand = [deck.pop(), deck.pop()];

  const gameId = `${userId}-${Date.now()}`;
  const game = {
    gameId,
    userId,
    bet,
    vsAI,
    opponentId,
    guildId,
    deck,
    playerHand,
    dealerHand,
    playerValue: calculateHandValue(playerHand),
    dealerValue: calculateHandValue(dealerHand),
    status: 'playing',
    createdAt: Date.now()
  };

  activeGames.set(gameId, game);

  if (isBlackjack(playerHand)) {
    return await handlePlayerBlackjack(gameId);
  }

  return {
    success: true,
    game: {
      gameId,
      playerHand: formatHand(playerHand),
      playerValue: game.playerValue,
      dealerUpCard: formatCard(dealerHand[0]),
      bet
    }
  };
}

async function handlePlayerBlackjack(gameId) {
  const game = activeGames.get(gameId);
  if (!game) {
    return { success: false, error: 'game_not_found' };
  }

  const dealerBlackjack = isBlackjack(game.dealerHand);

  if (dealerBlackjack) {
    await addBalance(game.userId, game.bet);
    game.status = 'push';
    activeGames.delete(gameId);
    
    return {
      success: true,
      result: 'push',
      gameId,
      playerHand: formatHand(game.playerHand),
      playerValue: game.playerValue,
      dealerHand: formatHand(game.dealerHand),
      dealerValue: game.dealerValue,
      payout: game.bet,
      message: '引き分け！両方ブラックジャックです！'
    };
  } else {
    let multiplier = 1.5;
    
    if (game.guildId) {
      const { getAjackSettings } = require('../storage/fileStorage');
      const settings = await getAjackSettings(game.guildId);
      multiplier = settings.regularMultiplier || 1.5;
    }
    
    const payout = Math.floor(game.bet * multiplier);
    await addBalance(game.userId, payout);
    game.status = 'player_blackjack';
    activeGames.delete(gameId);
    
    return {
      success: true,
      result: 'blackjack',
      gameId,
      playerHand: formatHand(game.playerHand),
      playerValue: game.playerValue,
      dealerHand: formatHand(game.dealerHand),
      dealerValue: game.dealerValue,
      payout,
      profit: payout - game.bet,
      message: 'ブラックジャック！おめでとうございます！'
    };
  }
}

async function hit(gameId) {
  const game = activeGames.get(gameId);
  if (!game) {
    return { success: false, error: 'game_not_found' };
  }

  if (game.status !== 'playing') {
    return { success: false, error: 'game_already_finished' };
  }

  const card = game.deck.pop();
  game.playerHand.push(card);
  game.playerValue = calculateHandValue(game.playerHand);

  if (game.playerValue > 21) {
    game.status = 'bust';
    activeGames.delete(gameId);
    
    return {
      success: true,
      bust: true,
      result: 'lose',
      playerHand: formatHand(game.playerHand),
      playerValue: game.playerValue,
      dealerHand: formatHand(game.dealerHand),
      dealerValue: game.dealerValue,
      payout: 0,
      profit: -game.bet,
      message: 'バースト！21を超えました...'
    };
  }

  return {
    success: true,
    playerHand: formatHand(game.playerHand),
    playerValue: game.playerValue,
    dealerUpCard: formatCard(game.dealerHand[0]),
    canHit: true
  };
}

async function stand(gameId) {
  const game = activeGames.get(gameId);
  if (!game) {
    return { success: false, error: 'game_not_found' };
  }

  if (game.status !== 'playing') {
    return { success: false, error: 'game_already_finished' };
  }

  while (game.dealerValue < 17) {
    const card = game.deck.pop();
    game.dealerHand.push(card);
    game.dealerValue = calculateHandValue(game.dealerHand);
  }

  let result;
  let payout = 0;
  let message;
  
  let multiplier = game.isAllIn ? 2.5 : 1.5;
  
  if (game.guildId) {
    const { getAjackSettings } = require('../storage/fileStorage');
    const settings = await getAjackSettings(game.guildId);
    multiplier = game.isAllIn ? (settings.allInMultiplier || 2.5) : (settings.regularMultiplier || 1.5);
  }

  if (game.dealerValue > 21) {
    result = 'win';
    payout = Math.floor(game.bet * multiplier);
    message = 'ディーラーがバースト！あなたの勝ちです！';
  } else if (game.playerValue > game.dealerValue) {
    result = 'win';
    payout = Math.floor(game.bet * multiplier);
    message = 'あなたの勝ちです！';
  } else if (game.playerValue < game.dealerValue) {
    result = 'lose';
    payout = 0;
    message = 'ディーラーの勝ちです...';
  } else {
    result = 'push';
    payout = game.bet;
    message = '引き分けです！';
  }

  if (payout > 0) {
    await addBalance(game.userId, payout);
  }

  game.status = result;
  activeGames.delete(gameId);

  return {
    success: true,
    result,
    playerHand: formatHand(game.playerHand),
    playerValue: game.playerValue,
    dealerHand: formatHand(game.dealerHand),
    dealerValue: game.dealerValue,
    payout,
    profit: payout - game.bet,
    message,
    isAllIn: game.isAllIn || false
  };
}

function getActiveGame(userId) {
  for (const [gameId, game] of activeGames.entries()) {
    if (game.userId === userId && game.status === 'playing') {
      return {
        gameId,
        playerHand: formatHand(game.playerHand),
        playerValue: game.playerValue,
        dealerUpCard: formatCard(game.dealerHand[0]),
        bet: game.bet
      };
    }
  }
  return null;
}

async function cancelGame(gameId) {
  const game = activeGames.get(gameId);
  if (!game) {
    return { success: false, error: 'game_not_found' };
  }

  if (game.status === 'playing') {
    await addBalance(game.userId, game.bet);
  }

  activeGames.delete(gameId);
  return { success: true, refunded: game.bet };
}

async function createAllInGame(userId, guildId = null) {
  const balance = await getUserBalance(userId);
  
  if (balance <= 0) {
    return {
      success: false,
      error: 'no_balance',
      balance
    };
  }

  const bet = balance;
  const result = await subtractBalance(userId, bet, true);
  
  if (!result.success) {
    if (result.error === 'debt_limit_exceeded') {
      return {
        success: false,
        error: 'debt_limit_exceeded',
        balance: result.balance,
        limit: result.limit
      };
    }
    return result;
  }
  
  const deck = shuffleDeck(createDeck());
  
  const playerHand = [deck.pop(), deck.pop()];
  const dealerHand = [deck.pop(), deck.pop()];

  const gameId = `allin-${userId}-${Date.now()}`;
  const game = {
    gameId,
    userId,
    bet,
    vsAI: true,
    opponentId: null,
    guildId,
    deck,
    playerHand,
    dealerHand,
    playerValue: calculateHandValue(playerHand),
    dealerValue: calculateHandValue(dealerHand),
    status: 'playing',
    isAllIn: true,
    createdAt: Date.now()
  };

  activeGames.set(gameId, game);

  if (isBlackjack(playerHand)) {
    return await handlePlayerBlackjackAllIn(gameId);
  }

  return {
    success: true,
    game: {
      gameId,
      playerHand: formatHand(playerHand),
      playerValue: game.playerValue,
      dealerUpCard: formatCard(dealerHand[0]),
      bet,
      isAllIn: true
    }
  };
}

async function handlePlayerBlackjackAllIn(gameId) {
  const game = activeGames.get(gameId);
  if (!game) {
    return { success: false, error: 'game_not_found' };
  }

  const dealerBlackjack = isBlackjack(game.dealerHand);

  if (dealerBlackjack) {
    await addBalance(game.userId, game.bet);
    game.status = 'push';
    activeGames.delete(gameId);
    
    return {
      success: true,
      result: 'push',
      gameId,
      playerHand: formatHand(game.playerHand),
      playerValue: game.playerValue,
      dealerHand: formatHand(game.dealerHand),
      dealerValue: game.dealerValue,
      payout: game.bet,
      message: '引き分け！両方ブラックジャックです！',
      isAllIn: true
    };
  } else {
    let multiplier = 2.5;
    
    if (game.guildId) {
      const { getAjackSettings } = require('../storage/fileStorage');
      const settings = await getAjackSettings(game.guildId);
      multiplier = settings.allInMultiplier || 2.5;
    }
    
    const payout = Math.floor(game.bet * multiplier);
    await addBalance(game.userId, payout);
    game.status = 'player_blackjack';
    activeGames.delete(gameId);
    
    return {
      success: true,
      result: 'blackjack',
      gameId,
      playerHand: formatHand(game.playerHand),
      playerValue: game.playerValue,
      dealerHand: formatHand(game.dealerHand),
      dealerValue: game.dealerValue,
      payout,
      profit: payout - game.bet,
      message: 'ブラックジャック！大勝負に勝利しました！',
      isAllIn: true
    };
  }
}

async function createPvPInvite(challengerId, opponentId, bet) {
  const challengerBalance = await getUserBalance(challengerId);
  if (challengerBalance < bet) {
    return {
      success: false,
      error: 'insufficient_funds',
      balance: challengerBalance
    };
  }

  const opponentBalance = await getUserBalance(opponentId);
  if (opponentBalance < bet) {
    return {
      success: false,
      error: 'opponent_insufficient_funds',
      balance: opponentBalance
    };
  }

  const inviteId = `pvp-invite-${challengerId}-${opponentId}-${Date.now()}`;
  const invite = {
    inviteId,
    challengerId,
    opponentId,
    bet,
    createdAt: Date.now(),
    status: 'pending'
  };

  pendingPvPInvites.set(inviteId, invite);

  return {
    success: true,
    inviteId,
    bet
  };
}

async function acceptPvPInvite(inviteId) {
  const invite = pendingPvPInvites.get(inviteId);
  if (!invite) {
    return { success: false, error: 'invite_not_found' };
  }

  if (invite.status !== 'pending') {
    return { success: false, error: 'invite_already_processed' };
  }

  const challengerResult = await subtractBalance(invite.challengerId, invite.bet, true);
  if (!challengerResult.success) {
    pendingPvPInvites.delete(inviteId);
    return {
      success: false,
      error: 'challenger_insufficient_funds',
      balance: await getUserBalance(invite.challengerId)
    };
  }

  const opponentResult = await subtractBalance(invite.opponentId, invite.bet, true);
  if (!opponentResult.success) {
    await addBalance(invite.challengerId, invite.bet);
    pendingPvPInvites.delete(inviteId);
    return {
      success: false,
      error: 'opponent_insufficient_funds',
      balance: await getUserBalance(invite.opponentId)
    };
  }

  const deck = shuffleDeck(createDeck());
  
  const challengerHand = [deck.pop(), deck.pop()];
  const opponentHand = [deck.pop(), deck.pop()];

  const gameId = `pvp-${invite.challengerId}-${invite.opponentId}-${Date.now()}`;
  const game = {
    gameId,
    userId: invite.challengerId,
    opponentId: invite.opponentId,
    bet: invite.bet,
    vsAI: false,
    deck,
    playerHand: challengerHand,
    dealerHand: opponentHand,
    playerValue: calculateHandValue(challengerHand),
    dealerValue: calculateHandValue(opponentHand),
    status: 'playing',
    currentTurn: invite.challengerId,
    challengerStood: false,
    opponentStood: false,
    createdAt: Date.now()
  };

  activeGames.set(gameId, game);
  pendingPvPInvites.delete(inviteId);

  if (isBlackjack(challengerHand) && isBlackjack(opponentHand)) {
    return await handlePvPDraw(gameId);
  } else if (isBlackjack(challengerHand)) {
    return await handlePvPWin(gameId, invite.challengerId);
  } else if (isBlackjack(opponentHand)) {
    return await handlePvPWin(gameId, invite.opponentId);
  }

  return {
    success: true,
    game: {
      gameId,
      challengerId: invite.challengerId,
      opponentId: invite.opponentId,
      challengerHand: formatHand(challengerHand),
      challengerValue: game.playerValue,
      opponentHand: formatHand(opponentHand),
      opponentValue: game.dealerValue,
      bet: invite.bet,
      currentTurn: game.currentTurn,
      isPvP: true
    }
  };
}

async function rejectPvPInvite(inviteId) {
  const invite = pendingPvPInvites.get(inviteId);
  if (!invite) {
    return { success: false, error: 'invite_not_found' };
  }

  pendingPvPInvites.delete(inviteId);
  return { success: true };
}

async function hitPvP(gameId, userId) {
  const game = activeGames.get(gameId);
  if (!game) {
    return { success: false, error: 'game_not_found' };
  }

  if (game.vsAI) {
    return { success: false, error: 'not_pvp_game' };
  }

  if (game.status !== 'playing') {
    return { success: false, error: 'game_already_finished' };
  }

  const isChallenger = userId === game.userId;
  const isOpponent = userId === game.opponentId;

  if (!isChallenger && !isOpponent) {
    return { success: false, error: 'not_your_game' };
  }

  if (game.currentTurn !== userId) {
    return { success: false, error: 'not_your_turn' };
  }

  if (isChallenger && game.challengerStood) {
    return { success: false, error: 'already_stood' };
  }
  
  if (isOpponent && game.opponentStood) {
    return { success: false, error: 'already_stood' };
  }

  const card = game.deck.pop();
  
  if (isChallenger) {
    game.playerHand.push(card);
    game.playerValue = calculateHandValue(game.playerHand);

    if (game.playerValue > 21) {
      return await handlePvPWin(gameId, game.opponentId);
    }
    
    game.currentTurn = game.opponentStood ? game.userId : game.opponentId;
  } else {
    game.dealerHand.push(card);
    game.dealerValue = calculateHandValue(game.dealerHand);

    if (game.dealerValue > 21) {
      return await handlePvPWin(gameId, game.userId);
    }
    
    game.currentTurn = game.challengerStood ? game.opponentId : game.userId;
  }

  return {
    success: true,
    gameId,
    challengerHand: formatHand(game.playerHand),
    challengerValue: game.playerValue,
    opponentHand: formatHand(game.dealerHand),
    opponentValue: game.dealerValue,
    currentTurn: game.currentTurn,
    challengerStood: game.challengerStood,
    opponentStood: game.opponentStood,
    isPvP: true
  };
}

async function standPvP(gameId, userId) {
  const game = activeGames.get(gameId);
  if (!game) {
    return { success: false, error: 'game_not_found' };
  }

  if (game.vsAI) {
    return { success: false, error: 'not_pvp_game' };
  }

  if (game.status !== 'playing') {
    return { success: false, error: 'game_already_finished' };
  }

  const isChallenger = userId === game.userId;
  const isOpponent = userId === game.opponentId;

  if (!isChallenger && !isOpponent) {
    return { success: false, error: 'not_your_game' };
  }

  if (game.currentTurn !== userId) {
    return { success: false, error: 'not_your_turn' };
  }

  if (isChallenger && game.challengerStood) {
    return { success: false, error: 'already_stood' };
  }
  
  if (isOpponent && game.opponentStood) {
    return { success: false, error: 'already_stood' };
  }

  if (isChallenger) {
    game.challengerStood = true;
  } else {
    game.opponentStood = true;
  }

  if (game.challengerStood && game.opponentStood) {
    if (game.playerValue > game.dealerValue) {
      return await handlePvPWin(gameId, game.userId);
    } else if (game.dealerValue > game.playerValue) {
      return await handlePvPWin(gameId, game.opponentId);
    } else {
      return await handlePvPDraw(gameId);
    }
  }

  game.currentTurn = isChallenger ? game.opponentId : game.userId;

  return {
    success: true,
    gameId,
    challengerHand: formatHand(game.playerHand),
    challengerValue: game.playerValue,
    opponentHand: formatHand(game.dealerHand),
    opponentValue: game.dealerValue,
    challengerStood: game.challengerStood,
    opponentStood: game.opponentStood,
    currentTurn: game.currentTurn,
    waiting: true,
    isPvP: true
  };
}

async function handlePvPWin(gameId, winnerId) {
  const game = activeGames.get(gameId);
  if (!game) {
    return { success: false, error: 'game_not_found' };
  }

  const payout = game.bet * 2;
  await addBalance(winnerId, payout);

  game.status = 'finished';
  activeGames.delete(gameId);

  const isChallenger = winnerId === game.userId;

  return {
    success: true,
    result: 'win',
    winnerId,
    loserId: isChallenger ? game.opponentId : game.userId,
    challengerHand: formatHand(game.playerHand),
    challengerValue: game.playerValue,
    opponentHand: formatHand(game.dealerHand),
    opponentValue: game.dealerValue,
    payout,
    profit: game.bet,
    message: isChallenger ? 'あなたの勝ちです！' : '相手の勝ちです！',
    isPvP: true
  };
}

async function handlePvPDraw(gameId) {
  const game = activeGames.get(gameId);
  if (!game) {
    return { success: false, error: 'game_not_found' };
  }

  await addBalance(game.userId, game.bet);
  await addBalance(game.opponentId, game.bet);

  game.status = 'draw';
  activeGames.delete(gameId);

  return {
    success: true,
    result: 'draw',
    challengerHand: formatHand(game.playerHand),
    challengerValue: game.playerValue,
    opponentHand: formatHand(game.dealerHand),
    opponentValue: game.dealerValue,
    payout: game.bet,
    message: '引き分けです！',
    isPvP: true
  };
}

function getPendingInvite(opponentId) {
  for (const [inviteId, invite] of pendingPvPInvites.entries()) {
    if (invite.opponentId === opponentId && invite.status === 'pending') {
      return {
        inviteId,
        challengerId: invite.challengerId,
        bet: invite.bet
      };
    }
  }
  return null;
}

function getActivePvPGame(userId) {
  for (const [gameId, game] of activeGames.entries()) {
    if (!game.vsAI && (game.userId === userId || game.opponentId === userId) && game.status === 'playing') {
      return {
        gameId,
        challengerId: game.userId,
        opponentId: game.opponentId,
        challengerHand: formatHand(game.playerHand),
        challengerValue: game.playerValue,
        opponentHand: formatHand(game.dealerHand),
        opponentValue: game.dealerValue,
        bet: game.bet,
        challengerStood: game.challengerStood,
        opponentStood: game.opponentStood,
        currentTurn: game.currentTurn
      };
    }
  }
  return null;
}

function cleanupOldGames() {
  const now = Date.now();
  const maxAge = 30 * 60 * 1000;
  
  for (const [gameId, game] of activeGames.entries()) {
    if (now - game.createdAt > maxAge) {
      if (game.status === 'playing') {
        addBalance(game.userId, game.bet);
        if (!game.vsAI && game.opponentId) {
          addBalance(game.opponentId, game.bet);
        }
      }
      activeGames.delete(gameId);
    }
  }

  for (const [inviteId, invite] of pendingPvPInvites.entries()) {
    if (now - invite.createdAt > maxAge) {
      pendingPvPInvites.delete(inviteId);
    }
  }
}

setInterval(cleanupOldGames, 5 * 60 * 1000);

module.exports = {
  createGame,
  createAllInGame,
  hit,
  stand,
  getActiveGame,
  cancelGame,
  calculateHandValue,
  formatHand,
  createPvPInvite,
  acceptPvPInvite,
  rejectPvPInvite,
  hitPvP,
  standPvP,
  getPendingInvite,
  getActivePvPGame
};
