const { redisClient } = require('../config/redisClient');

/**
 * Handles wallet deductions using Redis transactions to prevent race conditions and money duplication bugs.
 */
async function deductBalance(userId, amount) {
  const balanceKey = `wallet:${userId}:balance`;
  
  // Watch the key to ensure no other transaction modifies it while we do
  await redisClient.watch(balanceKey);
  
  const currentBalance = await redisClient.get(balanceKey);
  const balance = currentBalance ? parseFloat(currentBalance) : 0;
  
  if (balance < amount) {
    await redisClient.unwatch();
    throw new Error('Insufficient balance');
  }
  
  const newBalance = balance - amount;
  
  // Use a multi block to execute the deduction atomically
  const multi = redisClient.multi();
  multi.set(balanceKey, newBalance.toString());
  
  const results = await multi.exec();
  
  if (!results) {
    throw new Error('Transaction conflict. Please try again.');
  }
  
  return newBalance;
}

async function addBalance(userId, amount) {
  const balanceKey = `wallet:${userId}:balance`;
  const newBalance = await redisClient.incrByFloat(balanceKey, amount);
  return newBalance;
}

async function getBalance(userId) {
  const balanceKey = `wallet:${userId}:balance`;
  const balance = await redisClient.get(balanceKey);
  return balance ? parseFloat(balance) : 0;
}

module.exports = {
  deductBalance,
  addBalance,
  getBalance
};
