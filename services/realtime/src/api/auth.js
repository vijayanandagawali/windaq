const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');

// Generate a valid JWT for testing purposes
router.get('/mock-token', (req, res) => {
  const userId = req.query.userId || 'mock-user-id';
  const role = req.query.role || 'USER';

  const token = jwt.sign(
    { userId, role, scope: 'full_access' },
    process.env.JWT_SECRET || 'super-secret-key-fallback',
    { expiresIn: '12h' }
  );

  res.json({
    success: true,
    data: {
      userId,
      token,
      message: 'Use this Bearer token in the Authorization header to bypass the new requireAuth middleware.'
    }
  });
});

module.exports = router;
