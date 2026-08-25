// ============================================================
// api/lib/pricing.js
// ============================================================

const DISCOUNT_TIERS = { 1: 0, 2: 0.10, 3: 0.12, 4: 0.14, 5: 0.15 };
const MAX_QTY = 5;
const FREE_SHIPPING_DISPLAY_VALUE = 15000;

function calcPricing(basePrice, qty) {
  const q = Math.min(Math.max(1, Math.floor(qty)), MAX_QTY);
  const discountPercent = DISCOUNT_TIERS[q] ?? 0;
  const pricePerPcs = Math.round(basePrice * (1 - discountPercent));
  const totalOriginal = basePrice * q;
  const totalDiscounted = pricePerPcs * q;
  return { qty: q, discountPercent, pricePerPcs, totalOriginal, totalDiscounted };
}

module.exports = { DISCOUNT_TIERS, MAX_QTY, FREE_SHIPPING_DISPLAY_VALUE, calcPricing };