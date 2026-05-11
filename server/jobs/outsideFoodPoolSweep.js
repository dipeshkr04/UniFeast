const { expireDueOutsideFoodPools } = require('../services/outsideFood.service');

let sweepInterval = null;

function startOutsideFoodPoolSweep(io) {
  if (sweepInterval) return;

  expireDueOutsideFoodPools(io).catch((error) => {
    console.error('Outside food pool startup sweep error:', error.message);
  });

  sweepInterval = setInterval(() => {
    expireDueOutsideFoodPools(io).catch((error) => {
      console.error('Outside food pool sweep error:', error.message);
    });
  }, 30 * 1000);
}

function stopOutsideFoodPoolSweep() {
  if (sweepInterval) clearInterval(sweepInterval);
  sweepInterval = null;
}

module.exports = {
  startOutsideFoodPoolSweep,
  stopOutsideFoodPoolSweep,
};
