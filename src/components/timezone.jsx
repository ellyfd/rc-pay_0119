// 將 UTC 時間轉換為 GMT+8（台灣時區）
export function toGMT8(dateString) {
  const date = new Date(dateString);
  // 將 UTC 時間轉換為 GMT+8（加 8 小時）
  const gmt8Date = new Date(date.getTime() + (8 * 60 * 60 * 1000));
  return gmt8Date;
}

// 格式化為 GMT+8 時間
export function formatGMT8(dateString, formatString) {
  const gmt8Date = toGMT8(dateString);
  
  // 簡易格式化實作
  const year = gmt8Date.getUTCFullYear();
  const month = String(gmt8Date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(gmt8Date.getUTCDate()).padStart(2, '0');
  const hours = String(gmt8Date.getUTCHours()).padStart(2, '0');
  const minutes = String(gmt8Date.getUTCMinutes()).padStart(2, '0');
  const seconds = String(gmt8Date.getUTCSeconds()).padStart(2, '0');
  
  return formatString
    .replace('yyyy', year)
    .replace('MM', month)
    .replace('dd', day)
    .replace('HH', hours)
    .replace('mm', minutes)
    .replace('ss', seconds);
}