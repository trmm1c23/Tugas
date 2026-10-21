// Vercel Serverless Function: api/gempa.js
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const [autoRes, dirasakanRes] = await Promise.all([
      fetch('https://data.bmkg.go.id/DataMKG/TEWS/autogempa.json', {
        headers: { 'User-Agent': 'BMKG-Portal/1.0' }
      }).then(r => r.json()).catch(() => null),
      fetch('https://data.bmkg.go.id/DataMKG/TEWS/gempadirasakan.json', {
        headers: { 'User-Agent': 'BMKG-Portal/1.0' }
      }).then(r => r.json()).catch(() => null)
    ]);

    const autoGempa = autoRes?.Infogempa?.gempa || null;
    if (autoGempa && autoGempa.Shakemap) {
      autoGempa.ShakemapUrl = `https://data.bmkg.go.id/DataMKG/TEWS/${autoGempa.Shakemap}`;
    }

    const listDirasakan = dirasakanRes?.Infogempa?.gempa || [];

    return res.status(200).json({
      status: 'success',
      autogempa: autoGempa,
      gempadirasakan: listDirasakan
    });
  } catch (err) {
    return res.status(500).json({
      status: 'error',
      message: err.message
    });
  }
};
