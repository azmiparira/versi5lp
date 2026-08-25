// api/address-search.js
// GET /api/address-search?keyword=xxx
// Dilengkapi cache untuk mengurangi request ke Mengantar (menghemat quota)

const { searchAddress } = require('./lib/mengantar');

// ===== CACHE =====
let addressCache = {};
const CACHE_TTL = 3600000; // 1 jam (3600 detik)

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  const { keyword } = req.query;
  if (!keyword || keyword.trim().length < 3) {
    return res.status(400).json({ success: false, message: 'Keyword minimal 3 karakter' });
  }

  const cacheKey = keyword.trim().toLowerCase();
  
  // ===== CEK CACHE =====
  if (addressCache[cacheKey] && (Date.now() - addressCache[cacheKey].timestamp < CACHE_TTL)) {
    console.log(`✅ Cache hit untuk keyword: "${cacheKey}"`);
    return res.status(200).json({ 
      success: true, 
      data: addressCache[cacheKey].data,
      fromCache: true 
    });
  }

  try {
    console.log(`🌐 Fetch dari Mengantar untuk: "${keyword.trim()}"`);
    const data = await searchAddress(keyword.trim());
    
    // ===== SIMPAN KE CACHE =====
    addressCache[cacheKey] = {
      data: data,
      timestamp: Date.now()
    };
    
    console.log(`✅ Data disimpan ke cache untuk: "${cacheKey}" (${data.length} items)`);
    res.status(200).json({ success: true, data });
  } catch (err) {
    console.error('❌ address-search error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};
