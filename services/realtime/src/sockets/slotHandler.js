const crypto = require('crypto');
const { PrismaClient } = require('@prisma/client');
const { SlotEngine } = require('slot-engine');
const { ensureUserAndWallet } = require('../services/walletService');

const prisma = new PrismaClient();
const engine = new SlotEngine('v1-OceanTreasures-96RTP');

function handleSlotSockets(socket, io) {
  // Join specific slot room
  socket.on('slot:join', async () => {
    socket.join('slot:oceantreasures');
    console.log(`Client ${socket.id} joined slot:oceantreasures`);
  });

  socket.on('slot:leave', () => {
    socket.leave('slot:oceantreasures');
  });

  // Handle spin request
  socket.on('slot:spin', async (data, callback) => {
    const resolvedUserId = (socket.user?.id && socket.user.id !== 'guest') ? socket.user.id : (process.env.NODE_ENV === 'test' && data?.userId ? data.userId : null);
    if (!resolvedUserId) {
      return callback({ success: false, code: 'AUTH_REQUIRED', message: 'You must be logged in to play slots.' });
    }
    const userId = resolvedUserId;
    const { stake } = data;
    
    // Prevent tiny negative stakes
    if (stake <= 0) return callback({ success: false, message: 'Invalid stake amount.' });

    try {
      const result = await prisma.$transaction(async (tx) => {
        // Fetch wallet, auto-provision guest for testing if needed
        let { wallet } = await ensureUserAndWallet(tx, userId);
        
        if (wallet.balance < stake) {
          throw new Error('Insufficient balance in wallet.');
        }

        // Generate seeds
        const serverSeed = crypto.randomBytes(32).toString('hex');
        const clientSeed = crypto.randomBytes(16).toString('hex'); // Usually client sends this
        const nonce = 1;

        // 1. Generate grid using Slot Engine
        const grid = engine.generateGrid(serverSeed, clientSeed, nonce);
        
        // 2. Evaluate win using Slot Engine
        const evalResult = engine.evaluate(grid, stake);
        const payout = evalResult.totalWin;

        // 3. Deduct stake and add payout to wallet in one operation
        const netChange = BigInt(payout) - BigInt(stake);
        const newBalance = BigInt(wallet.balance) + netChange;
        
        await tx.wallet.update({ where: { id: wallet.id }, data: { balance: newBalance } });

        // 4. Record Spin History
        const spin = await tx.slotSpin.create({
          data: {
            userId,
            configVer: engine.configVersion,
            stake: BigInt(stake),
            payout: BigInt(payout),
            grid: grid,
            serverSeed,
            clientSeed,
            nonce
          }
        });

        // 5. Record Financial Transactions
        await tx.transaction.create({
          data: {
            walletId: wallet.id,
            idempotencyKey: `spin-${spin.id}`,
            type: 'BET_PLACE',
            amount: BigInt(stake),
            balanceAfter: BigInt(wallet.balance) - BigInt(stake),
            reference: spin.id
          }
        });
        
        if (payout > 0) {
           await tx.transaction.create({
            data: {
              walletId: wallet.id,
              idempotencyKey: `win-${spin.id}`,
              type: 'BET_WIN',
              amount: BigInt(payout),
              balanceAfter: newBalance,
              reference: spin.id
            }
          });
        }

        return {
          spinId: spin.id,
          grid,
          winningLines: evalResult.winningLines,
          totalWin: payout,
          isFreeSpinsTriggered: evalResult.isFreeSpinsTriggered,
          newBalance: newBalance.toString()
        };
      });

      // Send outcome securely to the specific user who spun
      callback({ success: true, data: result });
      
    } catch (e) {
      console.error('Slot spin error', e);
      callback({ success: false, message: e.message });
    }
  });
}

module.exports = { handleSlotSockets };
