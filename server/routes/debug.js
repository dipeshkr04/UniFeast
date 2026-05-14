const express = require('express');
const router = express.Router();
const { getEnvStatus } = require('../controllers/debugController');

router.get('/env', getEnvStatus);

module.exports = router;
