// api/address-search.js
const { searchAddress } = require('./lib/mengantar');

module.exports = async (req, res) => {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  const { keyword } = req.query;
  if (!keyword || keyword.trim().length < 3) {
    return res.status(400).json({ success: false, message: 'Keyword minimal 3 karakter' });
  }

  try {
    const data = await searchAddress(keyword.trim());
    // Pastikan response sesuai dengan yang diharapkan frontend
    res.status(200).json({ success: true, data });
  } catch (err) {
    console.error('address-search error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};
