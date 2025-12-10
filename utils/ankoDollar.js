const { 
  getAnkoDollarBalance, 
  updateAnkoDollarBalance,
  getLastDaily,
  updateLastDaily,
  getWorkCooldown,
  updateWorkCooldown,
  getUserInventory,
  updateUserInventory,
  getAjackSettings,
  getBankBalance,
  updateBankBalance,
  getStealCooldown,
  updateStealCooldown
} = require('../storage/fileStorage');

const INITIAL_BALANCE = 1000;
const DEFAULT_DAILY_BONUS = 100;
const DEFAULT_WORK_REWARD_MIN = 50;
const DEFAULT_WORK_REWARD_MAX = 150;
const DEFAULT_WORK_COOLDOWN = 30 * 60 * 1000;
const MAX_DEBT_LIMIT = -10000;

async function getUserBalance(userId) {
  const balance = await getAnkoDollarBalance(userId);
  if (balance === null) {
    await updateAnkoDollarBalance(userId, INITIAL_BALANCE);
    return INITIAL_BALANCE;
  }
  return balance;
}

async function addBalance(userId, amount) {
  const currentBalance = await getUserBalance(userId);
  const newBalance = currentBalance + amount;
  await updateAnkoDollarBalance(userId, newBalance);
  return newBalance;
}

async function subtractBalance(userId, amount, allowDebt = false) {
  const currentBalance = await getUserBalance(userId);
  if (!allowDebt && currentBalance < amount) {
    return { success: false, error: 'insufficient_funds', balance: currentBalance };
  }
  const newBalance = currentBalance - amount;
  
  if (allowDebt && newBalance < MAX_DEBT_LIMIT) {
    return { success: false, error: 'debt_limit_exceeded', balance: currentBalance, limit: MAX_DEBT_LIMIT };
  }
  
  await updateAnkoDollarBalance(userId, newBalance);
  return { success: true, balance: newBalance };
}

async function forceSetBalance(userId, amount) {
  await updateAnkoDollarBalance(userId, amount);
  return amount;
}

async function claimDaily(userId, guildId) {
  const lastClaim = await getLastDaily(userId);
  const now = Date.now();
  const oneDay = 24 * 60 * 60 * 1000;

  if (lastClaim && (now - lastClaim) < oneDay) {
    const timeLeft = oneDay - (now - lastClaim);
    const hoursLeft = Math.floor(timeLeft / (60 * 60 * 1000));
    const minutesLeft = Math.floor((timeLeft % (60 * 60 * 1000)) / (60 * 1000));
    return {
      success: false,
      error: 'already_claimed',
      hoursLeft,
      minutesLeft
    };
  }

  const settings = await getAjackSettings(guildId);
  const dailyBonus = settings.dailyBonus || DEFAULT_DAILY_BONUS;

  await updateLastDaily(userId, now);
  const newBalance = await addBalance(userId, dailyBonus);

  return {
    success: true,
    bonus: dailyBonus,
    newBalance
  };
}

async function transferBalance(fromUserId, toUserId, amount) {
  const fromBalance = await getUserBalance(fromUserId);
  
  if (fromBalance < amount) {
    return { success: false, error: 'insufficient_funds' };
  }

  await subtractBalance(fromUserId, amount);
  await addBalance(toUserId, amount);

  return { success: true };
}

async function work(userId) {
  const settings = await getAjackSettings();
  const workCooldown = settings.workCooldown || DEFAULT_WORK_COOLDOWN;
  const workRewardMin = settings.workRewardMin || DEFAULT_WORK_REWARD_MIN;
  const workRewardMax = settings.workRewardMax || DEFAULT_WORK_REWARD_MAX;
  
  const lastWork = await getWorkCooldown(userId);
  const now = Date.now();

  if (lastWork && (now - lastWork) < workCooldown) {
    const timeLeft = workCooldown - (now - lastWork);
    const minutesLeft = Math.floor(timeLeft / (60 * 1000));
    const secondsLeft = Math.floor((timeLeft % (60 * 1000)) / 1000);
    return {
      success: false,
      error: 'on_cooldown',
      minutesLeft,
      secondsLeft
    };
  }

  await updateWorkCooldown(userId, now);
  const reward = Math.floor(Math.random() * (workRewardMax - workRewardMin + 1)) + workRewardMin;
  const newBalance = await addBalance(userId, reward);

  return {
    success: true,
    reward,
    newBalance
  };
}

async function getInventory(userId) {
  const inventory = await getUserInventory(userId);
  return inventory || {};
}

async function addItemToInventory(userId, itemId, quantity = 1) {
  const inventory = await getInventory(userId);
  if (!inventory[itemId]) {
    inventory[itemId] = 0;
  }
  inventory[itemId] += quantity;
  await updateUserInventory(userId, inventory);
  return inventory;
}

async function removeItemFromInventory(userId, itemId, quantity = 1) {
  const inventory = await getInventory(userId);
  if (!inventory[itemId] || inventory[itemId] < quantity) {
    return { success: false, error: 'insufficient_item' };
  }
  inventory[itemId] -= quantity;
  if (inventory[itemId] === 0) {
    delete inventory[itemId];
  }
  await updateUserInventory(userId, inventory);
  return { success: true, inventory };
}

async function deposit(userId, amount) {
  const walletBalance = await getUserBalance(userId);
  
  if (amount <= 0) {
    return { success: false, error: 'invalid_amount' };
  }
  
  if (walletBalance < amount) {
    return { success: false, error: 'insufficient_funds', balance: walletBalance };
  }
  
  const subtractResult = await subtractBalance(userId, amount);
  if (!subtractResult.success) {
    return subtractResult;
  }
  
  const bankBalance = await getBankBalance(userId);
  const newBankBalance = bankBalance + amount;
  await updateBankBalance(userId, newBankBalance);
  
  return {
    success: true,
    walletBalance: subtractResult.balance,
    bankBalance: newBankBalance,
    amount
  };
}

async function withdraw(userId, amount) {
  const bankBalance = await getBankBalance(userId);
  
  if (amount <= 0) {
    return { success: false, error: 'invalid_amount' };
  }
  
  if (bankBalance < amount) {
    return { success: false, error: 'insufficient_bank_funds', balance: bankBalance };
  }
  
  const newBankBalance = bankBalance - amount;
  await updateBankBalance(userId, newBankBalance);
  await addBalance(userId, amount);
  
  const newWalletBalance = await getUserBalance(userId);
  
  return {
    success: true,
    walletBalance: newWalletBalance,
    bankBalance: newBankBalance,
    amount
  };
}

async function stealFrom(thiefId, targetId, guildId) {
  const settings = await getAjackSettings(guildId);
  const stealCooldown = settings.stealCooldown || 60 * 60 * 1000;
  const successRate = settings.stealSuccessRate || 50;
  const stealPercentage = settings.stealPercentage || 10;
  const failurePenalty = settings.stealFailurePenalty || 100;
  
  const lastSteal = await getStealCooldown(guildId, thiefId);
  const now = Date.now();
  
  if (lastSteal && (now - lastSteal) < stealCooldown) {
    const timeLeft = stealCooldown - (now - lastSteal);
    const minutesLeft = Math.floor(timeLeft / (60 * 1000));
    const secondsLeft = Math.floor((timeLeft % (60 * 1000)) / 1000);
    return {
      success: false,
      error: 'on_cooldown',
      minutesLeft,
      secondsLeft
    };
  }
  
  const targetWalletBalance = await getUserBalance(targetId);
  
  if (targetWalletBalance <= 0) {
    return {
      success: false,
      error: 'target_no_money'
    };
  }
  
  await updateStealCooldown(guildId, thiefId, now);
  
  const random = Math.random() * 100;
  const isSuccess = random < successRate;
  
  if (isSuccess) {
    const stolenAmount = Math.floor(targetWalletBalance * (stealPercentage / 100));
    
    if (stolenAmount <= 0) {
      return {
        success: false,
        error: 'target_too_poor',
        targetBalance: targetWalletBalance
      };
    }
    
    await subtractBalance(targetId, stolenAmount);
    await addBalance(thiefId, stolenAmount);
    
    const newThiefBalance = await getUserBalance(thiefId);
    const newTargetBalance = await getUserBalance(targetId);
    
    return {
      success: true,
      stealSuccess: true,
      stolenAmount,
      thiefBalance: newThiefBalance,
      targetBalance: newTargetBalance
    };
  } else {
    const thiefBalance = await getUserBalance(thiefId);
    const result = await subtractBalance(thiefId, failurePenalty, true);
    
    if (!result.success) {
      return {
        success: true,
        stealSuccess: false,
        penalty: failurePenalty,
        thiefBalance: result.balance,
        debtLimitReached: result.error === 'debt_limit_exceeded'
      };
    }
    
    return {
      success: true,
      stealSuccess: false,
      penalty: failurePenalty,
      thiefBalance: result.balance
    };
  }
}

async function transferWallet(fromUserId, toUserId, amount) {
  const fromBalance = await getUserBalance(fromUserId);
  
  if (amount <= 0) {
    return { success: false, error: 'invalid_amount' };
  }
  
  if (fromBalance < amount) {
    return { success: false, error: 'insufficient_funds', balance: fromBalance };
  }
  
  await subtractBalance(fromUserId, amount);
  await addBalance(toUserId, amount);
  
  const newFromBalance = await getUserBalance(fromUserId);
  const newToBalance = await getUserBalance(toUserId);
  
  return {
    success: true,
    fromBalance: newFromBalance,
    toBalance: newToBalance,
    amount
  };
}

async function adminGiveMoney(userId, amount) {
  if (amount <= 0) {
    return { success: false, error: 'invalid_amount' };
  }
  
  await addBalance(userId, amount);
  const newBalance = await getUserBalance(userId);
  
  return {
    success: true,
    balance: newBalance,
    amount
  };
}

async function forceFine(userId, amount) {
  if (amount <= 0) {
    return { success: false, error: 'invalid_amount' };
  }
  
  let remaining = amount;
  let fromWallet = 0;
  let fromBank = 0;
  
  const initialWalletBalance = await getUserBalance(userId);
  const initialBankBalance = await getBankBalance(userId);
  
  if (initialWalletBalance > 0) {
    fromWallet = Math.min(initialWalletBalance, remaining);
    await subtractBalance(userId, fromWallet, true);
    remaining -= fromWallet;
  }
  
  if (remaining > 0) {
    if (initialBankBalance > 0) {
      fromBank = Math.min(initialBankBalance, remaining);
      await updateBankBalance(userId, initialBankBalance - fromBank);
      remaining -= fromBank;
    }
  }
  
  if (remaining > 0) {
    const currentWallet = await getUserBalance(userId);
    const newBalance = currentWallet - remaining;
    if (newBalance < MAX_DEBT_LIMIT) {
      await forceSetBalance(userId, initialWalletBalance);
      await updateBankBalance(userId, initialBankBalance);
      
      const finalBalance = await getUserBalance(userId);
      const finalBank = await getBankBalance(userId);
      return { 
        success: false, 
        error: 'debt_limit_exceeded',
        balance: finalBalance,
        bankBalance: finalBank,
        limit: MAX_DEBT_LIMIT
      };
    }
    await updateAnkoDollarBalance(userId, newBalance);
  }
  
  const finalWallet = await getUserBalance(userId);
  const finalBank = await getBankBalance(userId);
  
  return { 
    success: true, 
    fromWallet, 
    fromBank, 
    debtAdded: remaining,
    totalFine: amount,
    finalWallet,
    finalBank
  };
}

module.exports = {
  getUserBalance,
  addBalance,
  subtractBalance,
  forceSetBalance,
  claimDaily,
  transferBalance,
  work,
  getInventory,
  addItemToInventory,
  removeItemFromInventory,
  deposit,
  withdraw,
  stealFrom,
  transferWallet,
  adminGiveMoney,
  forceFine,
  getBankBalance,
  INITIAL_BALANCE,
  DEFAULT_DAILY_BONUS,
  MAX_DEBT_LIMIT
};
