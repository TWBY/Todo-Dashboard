/** 格式化 port 顯示：30xx 只顯示後兩位，其他顯示完整數字 */
export function formatPort(port: number): string {
  if (port >= 3000 && port <= 3099) {
    return String(port).slice(-2);
  }
  return String(port);
}
