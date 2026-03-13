// Mirrors FlapParams.sol — single source of truth for all mcap-driven parameters

export function calcSpread(mcap: number): number {
  if (mcap < 50_000)    return 0.50;
  if (mcap < 100_000)   return 0.45;
  if (mcap < 200_000)   return 0.40;
  if (mcap < 400_000)   return 0.35;
  if (mcap < 800_000)   return 0.30;
  if (mcap < 1_500_000) return 0.25;
  if (mcap < 3_000_000) return 0.20;
  if (mcap < 7_000_000) return 0.15;
  return 0.10;
}

export function calcMaxLeverage(mcap: number): number {
  if (mcap < 50_000)  return 1;
  if (mcap < 100_000) return 5;
  if (mcap < 300_000) return 7;
  return 10;
}

export function calcLevButtons(mcap: number): number[] {
  if (mcap < 50_000)  return [1];
  if (mcap < 100_000) return [1, 2, 5];
  if (mcap < 300_000) return [1, 2, 5, 7];
  return [1, 2, 5, 10];
}

export function calcMaxPosition(mcap: number): number {
  if (mcap < 50_000)    return 20;
  if (mcap < 100_000)   return 35;
  if (mcap < 300_000)   return 50;
  if (mcap < 1_000_000) return 75;
  return 100;
}

export function calcMaxOI(mcap: number): number {
  if (mcap < 50_000)    return 1_000;
  if (mcap < 100_000)   return 2_500;
  if (mcap < 300_000)   return 6_000;
  if (mcap < 1_000_000) return 15_000;
  if (mcap < 5_000_000) return 40_000;
  return 100_000;
}

export function calcMinInsurance(mcap: number): number {
  return Math.max(100, calcMaxOI(mcap) * 0.10);
}

// 0 = Green (healthy), 1 = Yellow (warning), 2 = Orange (frozen)
export function vaultHealth(vaultBalance: number, maxOI: number): 0 | 1 | 2 {
  if (maxOI === 0 || vaultBalance === 0) return 2;
  const ratio = vaultBalance / maxOI;
  if (ratio >= 0.30) return 0;
  if (ratio >= 0.15) return 1;
  return 2;
}

export function vaultHealthLabel(health: 0 | 1 | 2): string {
  if (health === 0) return "Healthy";
  if (health === 1) return "Warning";
  return "Unfunded";
}

export function vaultHealthColor(health: 0 | 1 | 2): string {
  if (health === 0) return "text-green-400";
  if (health === 1) return "text-yellow-400";
  return "text-orange-400";
}

export function vaultHealthBg(health: 0 | 1 | 2): string {
  if (health === 0) return "bg-green-500/15 border-green-500/30";
  if (health === 1) return "bg-yellow-500/15 border-yellow-500/30";
  return "bg-orange-500/15 border-orange-500/30";
}

export function vaultHealthBarColor(health: 0 | 1 | 2): string {
  if (health === 0) return "bg-green-500";
  if (health === 1) return "bg-yellow-500";
  return "bg-orange-500";
}

export function trustBadgeLabel(lockDays: number): string {
  if (lockDays >= 180) return "Platinum";
  if (lockDays >= 90)  return "Gold";
  if (lockDays >= 30)  return "Silver";
  return "None";
}

export function trustBadgeColor(lockDays: number): string {
  if (lockDays >= 180) return "text-cyan-300 bg-cyan-500/15 border-cyan-500/30";
  if (lockDays >= 90)  return "text-yellow-300 bg-yellow-500/15 border-yellow-500/30";
  if (lockDays >= 30)  return "text-slate-300 bg-slate-500/15 border-slate-500/30";
  return "text-white/40 bg-white/5 border-white/10";
}
