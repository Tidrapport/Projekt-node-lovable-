/**
 * Swedish tax calculation utilities
 * 
 * In Sweden, income tax consists of:
 * 1. Municipal tax (kommunalskatt) - varies by municipality, typically 29-35%
 * 2. State income tax (statlig inkomstskatt) - 20% on income above the threshold
 * 
 * The threshold for state tax (2024): ~598,500 SEK/year = ~49,875 SEK/month
 * We use a slightly higher monthly threshold of ~51,000 SEK to account for variation
 */

// State tax threshold per month (approximately 598,500 SEK/year / 12)
export const STATE_TAX_MONTHLY_THRESHOLD = 51000;
export const STATE_TAX_RATE = 0.20; // 20% state tax

/**
 * Calculate net salary (nettolön) based on gross salary and tax table percentage
 * Includes state tax on income above the threshold
 * 
 * @param grossSalary - Total gross salary including base salary, OB, travel
 * @param taxTablePercentage - Municipal tax table percentage (e.g., 30 = 30%)
 * @returns Object with net salary and tax breakdown
 */
export const calculateNetSalaryWithStateTax = (
  grossSalary: number,
  taxTablePercentage: number
): {
  netSalary: number;
  municipalTax: number;
  stateTax: number;
  totalTax: number;
} => {
  if (!taxTablePercentage || taxTablePercentage < 0 || taxTablePercentage > 100) {
    return {
      netSalary: grossSalary,
      municipalTax: 0,
      stateTax: 0,
      totalTax: 0,
    };
  }

  // Calculate municipal tax on entire gross salary
  const municipalTax = grossSalary * (taxTablePercentage / 100);

  // Calculate state tax only on income above threshold
  let stateTax = 0;
  if (grossSalary > STATE_TAX_MONTHLY_THRESHOLD) {
    const taxableAmountForStateTax = grossSalary - STATE_TAX_MONTHLY_THRESHOLD;
    stateTax = taxableAmountForStateTax * STATE_TAX_RATE;
  }

  const totalTax = municipalTax + stateTax;
  const netSalary = Math.max(0, grossSalary - totalTax);

  return {
    netSalary,
    municipalTax,
    stateTax,
    totalTax,
  };
};

/**
 * Legacy function for backward compatibility
 * Calculate net salary (nettolön) based on gross salary and tax table percentage
 * @param grossSalary - Total gross salary including base salary, OB, travel, and per diem
 * @param taxTablePercentage - Tax table percentage (e.g., 30 = 30% tax)
 * @returns Net salary after tax
 */
export const calculateNetSalary = (
  grossSalary: number,
  taxTablePercentage: number
): number => {
  const result = calculateNetSalaryWithStateTax(grossSalary, taxTablePercentage);
  return result.netSalary;
};

/**
 * Common Swedish tax table percentages
 */
export const COMMON_TAX_TABLES = [
  { value: 25, label: "Tabell 25 (25%)" },
  { value: 26, label: "Tabell 26 (26%)" },
  { value: 27, label: "Tabell 27 (27%)" },
  { value: 28, label: "Tabell 28 (28%)" },
  { value: 29, label: "Tabell 29 (29%)" },
  { value: 30, label: "Tabell 30 (30%)" },
  { value: 31, label: "Tabell 31 (31%)" },
  { value: 32, label: "Tabell 32 (32%)" },
  { value: 33, label: "Tabell 33 (33%)" },
  { value: 34, label: "Tabell 34 (34%)" },
  { value: 35, label: "Tabell 35 (35%)" },
];
