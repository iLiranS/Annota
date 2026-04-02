export const isNewerVersion = (current: string, lastSeen: string): boolean => {
  if (!lastSeen) return true; // First time opening the app

  const v1 = current.split('.').map(Number);
  const v2 = lastSeen.split('.').map(Number);

  for (let i = 0; i < Math.max(v1.length, v2.length); i++) {
    const num1 = v1[i] || 0;
    const num2 = v2[i] || 0;
    if (num1 > num2) return true;
    if (num1 < num2) return false;
  }
  return false; // They are equal
};
