export type LineData = {
  line: number; active: boolean; dailyTarget: number; smv: number; manpower: number;
  efficiencyTarget: number; dhuTarget: number; workingMinutes: number;
  buyer: string; style: string; po: string; color: string;
  hourlyTargets: number[]; hasCustomHourlyTargets?: boolean;
  hourlyActual: number[]; actual: number; maxHour: number; buyers: string[]; styles: string[];
  achievement: number; gap: number; paceTarget: number; paceAchievement: number; efficiency: number | null; earnedMinutes: number;
  availableMinutes: number; dhu: number | null; qualityChecked: number; qualityPass: number; qualityDefect: number; qualityStatus: string; status: string;
};
export type DashboardData = {
  date: string; timestamp: string; lastUpdated: string | null; dataVersion: string;
  kpis: { dailyTarget: number; actual: number; gap: number; achievement: number; efficiency: number | null;
    activeLines: number; belowTargetLines: number; configuredLines: number; efficiencyTarget: number;
    bestLine: { line: number; achievement: number } | null; worstLine: { line: number; achievement: number } | null; currentHour: number };
  hourly: { hour: number; target: number; actual: number; gap: number }[];
  lines: LineData[];
};
export type QualityLine = { line: number; checked: number; pass: number; defect: number; passRate: number; dhu: number; dhuTarget: number; status: string };
export type QualityData = {
  date: string; timestamp: string; lastUpdated: string | null; dataVersion: string;
  kpis: { checked: number; pass: number; defect: number; passRate: number; dhu: number; linesWithData: number; actionLines: number };
  lines: QualityLine[]; topDefects: { name: string; pcs: number }[];
};
export type TargetLine = {
  line: number; active: boolean; dailyTarget: number; smv: number; manpower: number;
  efficiencyTarget: number; dhuTarget: number; workingMinutes: number;
  buyer: string; style: string; po: string; color: string; hourlyTargets: number[]; hasCustomHourlyTargets?: boolean;
};
