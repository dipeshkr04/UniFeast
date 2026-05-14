// Safe debug controller — returns boolean presence of critical env vars
exports.getEnvStatus = async (req, res) => {
  try {
    const keys = [
      'HF_API_TOKEN',
      'OLLAMA_API_KEY',
      'CLOUDINARY_API_KEY',
      'CLOUDINARY_API_SECRET',
      'CLOUDINARY_CLOUD_NAME',
      'RESNET_SERVICE_URL',
      'CLIENT_URL',
    ];

    const status = {};
    keys.forEach((k) => {
      status[k] = Boolean(process.env[k]);
    });

    return res.json({ success: true, data: { nodeEnv: process.env.NODE_ENV || 'unknown', env: status } });
  } catch (err) {
    console.error('Debug endpoint error', err);
    return res.status(500).json({ success: false, message: 'Debug endpoint failed' });
  }
};

module.exports = exports;
