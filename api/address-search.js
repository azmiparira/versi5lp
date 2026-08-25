// api/address-search.js
// GET /api/address-search?keyword=xxx

const { searchAddress } = require('./lib/mengantar');

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  const { keyword } = req.query;
  if (!keyword || keyword.trim().length < 3) {
    return res.status(400).json({ success: false, message: 'Keyword minimal 3 karakter' });
  }

  try {
    const data = await searchAddress(keyword.trim());
    res.status(200).json({ success: true, data });
  } catch (err) {
    console.error('address-search error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};
