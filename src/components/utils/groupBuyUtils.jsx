// P2-18 + P3-19: 共用平分判斷邏輯
export const isOriginalOrder = (item) => {
  const isSplitItem = item.note && item.note.includes('平分');
  if (!isSplitItem) return true;
  return item.note.includes(`${item.member_name}訂購`);
};