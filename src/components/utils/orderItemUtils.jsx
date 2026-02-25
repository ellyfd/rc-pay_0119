/**
 * P2-10: 統一解析 orderItems 中的餐盒、飯量、單點
 * 同時修正 P0-9 飯量 bug（直接從 mealBox 取 rice_option）
 */
export function parseOrderItems(items, mealBoxProducts, sideDishProducts) {
  // ✅ 直接從 mealBox 取 rice_option（修正 P0-9 的飯量 bug）
  const mealBox = items.find(item => {
    const product = mealBoxProducts.find(p => p.id === item.product_id);
    return product && product.category === 'meal_box';
  });

  const riceOption = mealBox?.rice_option || 'normal';
  const riceLabel = riceOption === 'less_rice' ? '飯少'
    : riceOption === 'rice_to_veg' ? '飯換菜'
    : '正常';

  const sideItems = items.filter(item => {
    const product = sideDishProducts.find(p => p.id === item.product_id);
    return product && product.category === 'side_dish';
  });

  return { mealBox, riceOption, riceLabel, sideItems };
}