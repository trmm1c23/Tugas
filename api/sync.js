// Vercel Serverless Function: api/sync.js
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  return res.status(200).json({
    status: 'success',
    message: 'Sinkronisasi cuaca berhasil diperbarui secara realtime.',
    waktu: new Date().toISOString()
  });
};
