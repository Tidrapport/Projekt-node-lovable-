import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch } from "@/api/client";
import { login, getMe, logout } from "@/api/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Download, AlertTriangle, CheckCircle, Settings, FileText, Users, Calendar, CheckSquare, Square, Plus, Trash2 } from "lucide-react";
import { format, startOfMonth, endOfMonth, subMonths, getMonth, getYear } from "date-fns";
import { sv } from "date-fns/locale";
import { generatePAXml, downloadPAXml, type PAXmlEmployee, type PAXmlEntry } from "@/lib/paxml";
import { calculateOBDistribution } from "@/lib/obDistribution";
interface Profile {
  id: string;
  full_name: string;
  employee_type: string | null;
  email: string | null;
  employee_number: string | null;
}
interface TimeEntry {
  id: string;
  user_id: string;
  date: string;
  start_time: string;
  end_time: string;
  break_minutes: number;
  total_hours: number;
  overtime_weekday_hours: number;
  overtime_weekend_hours: number;
  travel_time_hours: number;
  per_diem_type: string;
  save_travel_compensation: boolean;
  attested_at: string | null;
  project: {
    name: string;
  };
}
interface SalaryCode {
  code: string;
  name: string;
  description: string | null;
  category: string;
  default_fortnox_code: string | null;
}
interface CompanyMapping {
  internal_code: string;
  fortnox_code: string;
}
interface EmployeeSummary {
  userId: string;
  fullName: string;
  employeeNumber: string | null;
  workHours: number;
  overtimeWeekday: number;
  overtimeWeekend: number;
  obKvall: number;
  obNatt: number;
  obHelg: number;
  travelHours: number;
  perDiemFull: number;
  perDiemHalf: number;
  entries: TimeEntry[];
  hasEmployeeNumber: boolean;
}
interface ValidationIssue {
  type: 'employee_number' | 'mapping';
  userId?: string;
  employeeName?: string;
  code?: string;
  codeName?: string;
}
const monthOptions = Array.from({
  length: 12
}, (_, i) => {
  const date = subMonths(new Date(), i);
  return {
    value: `${getYear(date)}-${String(getMonth(date) + 1).padStart(2, '0')}`,
    label: format(date, 'MMMM yyyy', {
      locale: sv
    })
  };
});
export default function AdminSalaries() {
  const {
    user,
    companyId
  } = useAuth();
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState(monthOptions[0].value);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [salaryCodes, setSalaryCodes] = useState<SalaryCode[]>([]);
  const [companyMappings, setCompanyMappings] = useState<CompanyMapping[]>([]);
  const [shiftConfig, setShiftConfig] = useState<any[]>([]);

  // Dialogs
  const [showMappingDialog, setShowMappingDialog] = useState(false);
  const [showAllMappingsDialog, setShowAllMappingsDialog] = useState(false);
  const [showAddCodeDialog, setShowAddCodeDialog] = useState(false);
  const [showEmployeeDialog, setShowEmployeeDialog] = useState(false);
  const [showPreviewDialog, setShowPreviewDialog] = useState(false);

  // Mapping state
  const [missingMappings, setMissingMappings] = useState<SalaryCode[]>([]);
  const [mappingInputs, setMappingInputs] = useState<Record<string, string>>({});
  const [allMappingInputs, setAllMappingInputs] = useState<Record<string, string>>({});

  // New code state
  const [newCodeName, setNewCodeName] = useState('');
  const [newCodeFortnox, setNewCodeFortnox] = useState('');
  const [newCodeDescription, setNewCodeDescription] = useState('');
  const [newCodeCategory, setNewCodeCategory] = useState('custom');

  // Employee number state
  const [missingEmployeeNumbers, setMissingEmployeeNumbers] = useState<EmployeeSummary[]>([]);
  const [employeeNumberInputs, setEmployeeNumberInputs] = useState<Record<string, string>>({});

  // Selection state
  const [selectedEmployees, setSelectedEmployees] = useState<Set<string>>(new Set());

  // Period dates
  const periodDates = useMemo(() => {
    const [year, month] = selectedPeriod.split('-').map(Number);
    const date = new Date(year, month - 1, 1);
    return {
      start: startOfMonth(date),
      end: endOfMonth(date)
    };
  }, [selectedPeriod]);

  // Fetch data
  useEffect(() => {
    if (!user || !companyId) return;
    const fetchData = async () => {
      setLoading(true);
      try {
        // Fetch profiles
        const profilesData = await apiFetch(`/profiles?company_id=${companyId}`);

        // Fetch time entries for period (only attested)
        const entriesData = await apiFetch(`/time-entries?company_id=${companyId}&gte=${format(periodDates.start, 'yyyy-MM-dd')}&lte=${format(periodDates.end, 'yyyy-MM-dd')}&attested=true`);

        // Fetch salary codes
        const codesData = await apiFetch(`/fortnox_salary_codes`);

        // Fetch company mappings
        const mappingsData = await apiFetch(`/fortnox_company_mappings?company_id=${companyId}`);

        // Fetch shift config for OB calculations
        const shiftData = await apiFetch(`/shift_types_config?company_id=${companyId}`);
        setProfiles(profilesData || []);
        setEntries(entriesData as TimeEntry[] || []);
        setSalaryCodes(codesData || []);
        setCompanyMappings(mappingsData || []);
        setShiftConfig(shiftData || []);
      } catch (error) {
        console.error('Error fetching data:', error);
        toast.error('Kunde inte hämta data');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [user, companyId, periodDates]);

  // Calculate employee summaries
  const employeeSummaries = useMemo(() => {
    const summaries: EmployeeSummary[] = [];
    for (const profile of profiles) {
      const userEntries = entries.filter(e => e.user_id === profile.id);
      if (userEntries.length === 0) continue;
      let workHours = 0;
      let overtimeWeekday = 0;
      let overtimeWeekend = 0;
      let obKvall = 0;
      let obNatt = 0;
      let obHelg = 0;
      let travelHours = 0;
      
      // Track per diem per unique date to avoid counting multiple entries on same day
      const perDiemByDate = new Map<string, 'full' | 'half'>();
      
      for (const entry of userEntries) {
        // Calculate OB distribution for this entry
        const obDist = calculateOBDistribution(entry.date, entry.start_time, entry.end_time, entry.break_minutes || 0);

        // Base work hours (excluding overtime)
        const baseHours = entry.total_hours - (entry.overtime_weekday_hours || 0) - (entry.overtime_weekend_hours || 0);
        workHours += baseHours;

        // Overtime
        overtimeWeekday += entry.overtime_weekday_hours || 0;
        overtimeWeekend += entry.overtime_weekend_hours || 0;

        // OB hours from distribution
        obKvall += obDist.evening;
        obNatt += obDist.night;
        obHelg += obDist.weekend;

        // Travel (only if not saved)
        if (!entry.save_travel_compensation) {
          travelHours += entry.travel_time_hours || 0;
        }

        // Per diem - track per unique date (full takes precedence over half)
        if (entry.per_diem_type === 'full') {
          perDiemByDate.set(entry.date, 'full');
        } else if (entry.per_diem_type === 'half' && perDiemByDate.get(entry.date) !== 'full') {
          perDiemByDate.set(entry.date, 'half');
        }
      }

      // Count unique per diem days
      let perDiemFull = 0;
      let perDiemHalf = 0;
      for (const type of perDiemByDate.values()) {
        if (type === 'full') perDiemFull++;
        else if (type === 'half') perDiemHalf++;
      }

      // Use the employee_number field from the profile
      const employeeNumber = profile.employee_number || null;
      summaries.push({
        userId: profile.id,
        fullName: profile.full_name,
        employeeNumber,
        workHours,
        overtimeWeekday,
        overtimeWeekend,
        obKvall,
        obNatt,
        obHelg,
        travelHours,
        perDiemFull,
        perDiemHalf,
        entries: userEntries,
        hasEmployeeNumber: !!employeeNumber
      });
    }
    return summaries.sort((a, b) => a.fullName.localeCompare(b.fullName));
  }, [profiles, entries, shiftConfig]);

  // Select all employees by default when summaries change
  useEffect(() => {
    setSelectedEmployees(new Set(employeeSummaries.map(s => s.userId)));
  }, [employeeSummaries]);

  // Selection helpers
  const toggleEmployee = (userId: string) => {
    setSelectedEmployees(prev => {
      const next = new Set(prev);
      if (next.has(userId)) {
        next.delete(userId);
      } else {
        next.add(userId);
      }
      return next;
    });
  };
  const selectAll = () => {
    setSelectedEmployees(new Set(employeeSummaries.map(s => s.userId)));
  };
  const deselectAll = () => {
    setSelectedEmployees(new Set());
  };
  const allSelected = employeeSummaries.length > 0 && selectedEmployees.size === employeeSummaries.length;
  const someSelected = selectedEmployees.size > 0 && selectedEmployees.size < employeeSummaries.length;

  // Selected summaries for export
  const selectedSummaries = useMemo(() => employeeSummaries.filter(s => selectedEmployees.has(s.userId)), [employeeSummaries, selectedEmployees]);

  // Determine which codes are used by selected employees
  const usedCodes = useMemo(() => {
    const codes = new Set<string>();
    for (const summary of selectedSummaries) {
      if (summary.workHours > 0) codes.add('ARBETE');
      if (summary.overtimeWeekday > 0) codes.add('OVERTID_VARDAG');
      if (summary.overtimeWeekend > 0) codes.add('OVERTID_HELG');
      if (summary.obKvall > 0) codes.add('OB_KVALL');
      if (summary.obNatt > 0) codes.add('OB_NATT');
      if (summary.obHelg > 0) codes.add('OB_HELG');
      if (summary.travelHours > 0) codes.add('RESTID');
      if (summary.perDiemFull > 0) codes.add('TRAKTAMENTE_HEL');
      if (summary.perDiemHalf > 0) codes.add('TRAKTAMENTE_HALV');
    }
    return codes;
  }, [selectedSummaries]);

  // Get Fortnox code for an internal code
  // NOTE: We intentionally require explicit company mappings for export.
  // The default_fortnox_code values are only suggestions and may not exist in the customer's Fortnox.
  const getFortnoxCode = (internalCode: string): string | null => {
    const mapping = companyMappings.find(m => m.internal_code === internalCode);
    return mapping?.fortnox_code || null;
  };

  // Suggested default (used only to pre-fill the mapping dialog)
  const getSuggestedFortnoxCode = (internalCode: string): string | null => {
    const salaryCode = salaryCodes.find(c => c.code === internalCode);
    return salaryCode?.default_fortnox_code || null;
  };

  // Validate before export (only selected employees)
  const validateExport = (): ValidationIssue[] => {
    const issues: ValidationIssue[] = [];

    // Check employee numbers for selected employees only
    for (const summary of selectedSummaries) {
      if (!summary.hasEmployeeNumber) {
        issues.push({
          type: 'employee_number',
          userId: summary.userId,
          employeeName: summary.fullName
        });
      }
    }

    // Check mappings for used codes (require explicit company mappings)
    for (const code of usedCodes) {
      if (!getFortnoxCode(code)) {
        const salaryCode = salaryCodes.find(c => c.code === code);
        issues.push({
          type: 'mapping',
          code,
          codeName: salaryCode?.name || code
        });
      }
    }
    return issues;
  };

  // Handle export click
  const handleExportClick = () => {
    const issues = validateExport();
    const employeeIssues = issues.filter(i => i.type === 'employee_number');
    const mappingIssues = issues.filter(i => i.type === 'mapping');
    if (mappingIssues.length > 0) {
      // Show mapping dialog first
      const missing = mappingIssues.map(i => salaryCodes.find(c => c.code === i.code)!).filter(Boolean);
      setMissingMappings(missing);

      // Pre-fill with defaults
      const inputs: Record<string, string> = {};
      for (const code of missing) {
        inputs[code.code] = code.default_fortnox_code || '';
      }
      setMappingInputs(inputs);
      setShowMappingDialog(true);
      return;
    }
    if (employeeIssues.length > 0) {
      // Show employee number dialog
      const missing = employeeIssues.map(i => employeeSummaries.find(s => s.userId === i.userId)!).filter(Boolean);
      setMissingEmployeeNumbers(missing);
      const inputs: Record<string, string> = {};
      for (const emp of missing) {
        inputs[emp.userId] = '';
      }
      setEmployeeNumberInputs(inputs);
      setShowEmployeeDialog(true);
      return;
    }

    // All good, show preview
    setShowPreviewDialog(true);
  };

  // Save mappings
  const handleSaveMappings = async () => {
    try {
      const mappingsToSave = Object.entries(mappingInputs).filter(([_, value]) => value.trim()).map(([code, fortnoxCode]) => ({
        company_id: companyId,
        internal_code: code,
        fortnox_code: fortnoxCode.trim()
      }));
      if (mappingsToSave.length > 0) {
        const saved = await apiFetch('/fortnox_company_mappings', { method: 'POST', json: mappingsToSave });
        if (!saved) throw new Error('Kunde inte spara mappningar');

        // Update local state (reflect mappings we just saved)
        setCompanyMappings(prev => [...prev.filter(m => !mappingsToSave.some(ms => ms.internal_code === m.internal_code)), ...mappingsToSave.map(m => ({
          internal_code: m.internal_code,
          fortnox_code: m.fortnox_code
        }))]);
        toast.success('Mappningar sparade');
      }
      setShowMappingDialog(false);

      // Continue with validation
      handleExportClick();
    } catch (error) {
      console.error('Error saving mappings:', error);
      toast.error('Kunde inte spara mappningar');
    }
  };

  // Get used salary codes (only codes actually used in time entries)
  const usedSalaryCodes = useMemo(() => {
    return salaryCodes.filter(code => usedCodes.has(code.code));
  }, [salaryCodes, usedCodes]);

  // Open all mappings dialog (only show used codes)
  const handleOpenAllMappings = () => {
    const inputs: Record<string, string> = {};
    for (const code of usedSalaryCodes) {
      const mapping = companyMappings.find(m => m.internal_code === code.code);
      inputs[code.code] = mapping?.fortnox_code || '';
    }
    setAllMappingInputs(inputs);
    setShowAllMappingsDialog(true);
  };

  // Save all mappings
  const handleSaveAllMappings = async () => {
    try {
      const mappingsToSave = Object.entries(allMappingInputs)
        .filter(([_, value]) => value.trim())
        .map(([code, fortnoxCode]) => ({
          company_id: companyId,
          internal_code: code,
          fortnox_code: fortnoxCode.trim(),
        }));

      if (mappingsToSave.length > 0) {
        const saved = await apiFetch('/fortnox_company_mappings', { method: 'POST', json: mappingsToSave });
        if (!saved) throw new Error('Kunde inte spara mappningar');

        setCompanyMappings(prev => [
          ...prev.filter(m => !mappingsToSave.some(ms => ms.internal_code === m.internal_code)),
          ...mappingsToSave.map(m => ({
            internal_code: m.internal_code,
            fortnox_code: m.fortnox_code,
          })),
        ]);
        toast.success('Mappningar sparade');
      }
      setShowAllMappingsDialog(false);
    } catch (error) {
      console.error('Error saving mappings:', error);
      toast.error('Kunde inte spara mappningar');
    }
  };

  // Add new custom salary code
  const handleAddNewCode = async () => {
    if (!newCodeName.trim() || !newCodeFortnox.trim()) {
      toast.error('Namn och Fortnox-kod krävs');
      return;
    }

    const internalCode = newCodeName.toUpperCase().replace(/\s+/g, '_').replace(/[^A-Z0-9_]/g, '');
    
    try {
      // Insert the new salary code
      const created = await apiFetch('/fortnox_salary_codes', {
        method: 'POST',
        json: {
          code: internalCode,
          name: newCodeName.trim(),
          description: newCodeDescription.trim() || null,
          category: newCodeCategory,
          default_fortnox_code: newCodeFortnox.trim(),
          company_id: companyId,
        }
      });

      if (!created) throw new Error('Kunde inte skapa lönekod');

      // Also create the mapping automatically
      const mapped = await apiFetch('/fortnox_company_mappings', {
        method: 'POST',
        json: {
          company_id: companyId,
          internal_code: internalCode,
          fortnox_code: newCodeFortnox.trim(),
        }
      });

      if (!mapped) throw new Error('Kunde inte skapa mappning');

      // Refresh salary codes
      const newCodes = await apiFetch(`/fortnox_salary_codes?company_id=${companyId}`) || [];
      setSalaryCodes(newCodes);

      // Refresh mappings
      const newMappings = await apiFetch(`/fortnox_company_mappings?company_id=${companyId}`) || [];
      setCompanyMappings(newMappings);

      toast.success(`Lönekod "${newCodeName}" tillagd`);
      setShowAddCodeDialog(false);
      setNewCodeName('');
      setNewCodeFortnox('');
      setNewCodeDescription('');
      setNewCodeCategory('custom');
    } catch (error) {
      console.error('Error adding salary code:', error);
      toast.error('Kunde inte lägga till lönekod');
    }
  };

  // Delete custom salary code
  const handleDeleteCode = async (code: string) => {
    try {
      const res = await apiFetch('/fortnox_salary_codes', { method: 'DELETE', json: { code, company_id: companyId } });
      if (!res) throw new Error('Kunde inte ta bort lönekod');

      setSalaryCodes(prev => prev.filter(c => c.code !== code));
      toast.success('Lönekod borttagen');
    } catch (error) {
      console.error('Error deleting salary code:', error);
      toast.error('Kunde inte ta bort lönekod');
    }
  };

  // Generate and download PAXml
  const handleGenerateExport = async () => {
    try {
      const employees: PAXmlEmployee[] = [];
      
      // Use the period start date for all entries (Fortnox expects a date)
      const periodDateStr = format(periodDates.start, 'yyyy-MM-dd');
      
      for (const summary of selectedSummaries) {
        const entries: PAXmlEntry[] = [];
        
        // Use the pre-calculated summary values directly - these are already correct!
        // This ensures the export matches what's shown in the UI
        
        if (summary.workHours > 0) {
          const fortnoxCode = getFortnoxCode('ARBETE');
          if (fortnoxCode) {
            entries.push({
              date: periodDateStr,
              fortnoxCode,
              hours: Math.round(summary.workHours * 100) / 100
            });
          }
        }
        
        if (summary.overtimeWeekday > 0) {
          const fortnoxCode = getFortnoxCode('OVERTID_VARDAG');
          if (fortnoxCode) {
            entries.push({
              date: periodDateStr,
              fortnoxCode,
              hours: Math.round(summary.overtimeWeekday * 100) / 100
            });
          }
        }
        
        if (summary.overtimeWeekend > 0) {
          const fortnoxCode = getFortnoxCode('OVERTID_HELG');
          if (fortnoxCode) {
            entries.push({
              date: periodDateStr,
              fortnoxCode,
              hours: Math.round(summary.overtimeWeekend * 100) / 100
            });
          }
        }
        
        if (summary.obKvall > 0) {
          const fortnoxCode = getFortnoxCode('OB_KVALL');
          if (fortnoxCode) {
            entries.push({
              date: periodDateStr,
              fortnoxCode,
              hours: Math.round(summary.obKvall * 100) / 100
            });
          }
        }
        
        if (summary.obNatt > 0) {
          const fortnoxCode = getFortnoxCode('OB_NATT');
          if (fortnoxCode) {
            entries.push({
              date: periodDateStr,
              fortnoxCode,
              hours: Math.round(summary.obNatt * 100) / 100
            });
          }
        }
        
        if (summary.obHelg > 0) {
          const fortnoxCode = getFortnoxCode('OB_HELG');
          if (fortnoxCode) {
            entries.push({
              date: periodDateStr,
              fortnoxCode,
              hours: Math.round(summary.obHelg * 100) / 100
            });
          }
        }
        
        if (summary.travelHours > 0) {
          const fortnoxCode = getFortnoxCode('RESTID');
          if (fortnoxCode) {
            entries.push({
              date: periodDateStr,
              fortnoxCode,
              hours: Math.round(summary.travelHours * 100) / 100
            });
          }
        }
        
        if (summary.perDiemFull > 0) {
          const fortnoxCode = getFortnoxCode('TRAKTAMENTE_HEL');
          if (fortnoxCode) {
            entries.push({
              date: periodDateStr,
              fortnoxCode,
              quantity: summary.perDiemFull
            });
          }
        }
        
        if (summary.perDiemHalf > 0) {
          const fortnoxCode = getFortnoxCode('TRAKTAMENTE_HALV');
          if (fortnoxCode) {
            entries.push({
              date: periodDateStr,
              fortnoxCode,
              quantity: summary.perDiemHalf
            });
          }
        }
        
        if (entries.length > 0) {
          employees.push({
            employeeNumber: summary.employeeNumber!,
            fullName: summary.fullName,
            entries
          });
        }
      }

      // Fetch company info
      const company = await apiFetch(`/companies/${companyId}`);

      // Generate PAXml
      const xml = generatePAXml({
        companyName: company?.name || 'Företag',
        organizationNumber: company?.org_number || undefined,
        periodStart: format(periodDates.start, 'yyyy-MM-dd'),
        periodEnd: format(periodDates.end, 'yyyy-MM-dd'),
        employees
      });

      // Calculate total entries
      const totalEntries = employees.reduce((sum, emp) => sum + emp.entries.length, 0);

      // Log export
      const filename = `loneunderlag_${selectedPeriod}.xml`;
      await apiFetch('/fortnox_export_logs', {
        method: 'POST',
        json: {
          company_id: companyId,
          period_start: format(periodDates.start, 'yyyy-MM-dd'),
          period_end: format(periodDates.end, 'yyyy-MM-dd'),
          employee_count: employees.length,
          entry_count: totalEntries,
          exported_by: user!.id,
          filename
        }
      });

      // Download
      downloadPAXml(xml, filename);
      toast.success(`Löneunderlag exporterat (${employees.length} anställda, ${totalEntries} poster)`);
      setShowPreviewDialog(false);
    } catch (error) {
      console.error('Error generating export:', error);
      toast.error('Kunde inte skapa export');
    }
  };

  // Stats
  const totalEmployees = employeeSummaries.length;
  const selectedCount = selectedEmployees.size;
  const selectedHours = selectedSummaries.reduce((sum, s) => sum + s.workHours, 0);
  const selectedEntries = selectedSummaries.reduce((sum, s) => sum + s.entries.length, 0);
  if (loading) {
    return (
      <div className="container mx-auto flex items-center justify-center min-h-[400px] p-6">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }
  return (
    <div className="container mx-auto space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold"> Löner – Fortnox Export</h1>
        <p className="text-muted-foreground"> Skapa och exportera löneunderlag för import till Fortnox Lön</p>
      </div>

      {/* Period selection and stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Löneperiod
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {monthOptions.map(option => <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>)}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Users className="h-4 w-4" />
              Anställda
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{selectedCount} <span className="text-base font-normal text-muted-foreground">/ {totalEmployees}</span></p>
            <p className="text-xs text-muted-foreground">valda för export</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Tidrapporter
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{selectedEntries}</p>
            <p className="text-xs text-muted-foreground">poster från valda</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Totalt timmar</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{selectedHours.toFixed(2)}</p>
            <p className="text-xs text-muted-foreground">timmar från valda</p>
          </CardContent>
        </Card>
      </div>

      {/* Employee summary table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Sammanställning per anställd</CardTitle>
              <CardDescription>
                Översikt av tid, OB, övertid och traktamente för vald period
              </CardDescription>
            </div>
            {employeeSummaries.length > 0 && <Button variant="outline" size="sm" onClick={allSelected ? deselectAll : selectAll}>
                {allSelected ? <>
                    <Square className="h-4 w-4 mr-2" />
                    Avmarkera alla
                  </> : <>
                    <CheckSquare className="h-4 w-4 mr-2" />
                    Markera alla
                  </>}
              </Button>}
          </div>
        </CardHeader>
        <CardContent>
          {employeeSummaries.length === 0 ? <div className="text-center py-8 text-muted-foreground">
              <p>Inga attesterade tidrapporter för vald period</p>
            </div> : <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <Checkbox checked={allSelected} onCheckedChange={checked => checked ? selectAll() : deselectAll()} aria-label="Markera alla" />
                    </TableHead>
                    <TableHead>Anställd</TableHead>
                    <TableHead className="text-right">Arbete</TableHead>
                    <TableHead className="text-right">ÖT Vardag</TableHead>
                    <TableHead className="text-right">ÖT Helg</TableHead>
                    <TableHead className="text-right">OB Kväll</TableHead>
                    <TableHead className="text-right">OB Natt</TableHead>
                    <TableHead className="text-right">OB Helg</TableHead>
                    <TableHead className="text-right">Restid</TableHead>
                    <TableHead className="text-right">Trakt.</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {employeeSummaries.map(summary => <TableRow key={summary.userId} className={!selectedEmployees.has(summary.userId) ? 'opacity-50' : ''}>
                      <TableCell>
                        <Checkbox checked={selectedEmployees.has(summary.userId)} onCheckedChange={() => toggleEmployee(summary.userId)} aria-label={`Välj ${summary.fullName}`} />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {summary.fullName}
                          {!summary.hasEmployeeNumber && <Badge variant="outline" className="text-orange-500 border-orange-500">
                              <AlertTriangle className="h-3 w-3 mr-1" />
                              Saknar anst.nr
                            </Badge>}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">{summary.workHours.toFixed(2)}h</TableCell>
                      <TableCell className="text-right">
                        {summary.overtimeWeekday > 0 ? `${summary.overtimeWeekday.toFixed(2)}h` : '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        {summary.overtimeWeekend > 0 ? `${summary.overtimeWeekend.toFixed(2)}h` : '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        {summary.obKvall > 0 ? `${summary.obKvall.toFixed(2)}h` : '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        {summary.obNatt > 0 ? `${summary.obNatt.toFixed(2)}h` : '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        {summary.obHelg > 0 ? `${summary.obHelg.toFixed(2)}h` : '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        {summary.travelHours > 0 ? `${summary.travelHours.toFixed(2)}h` : '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        {summary.perDiemFull > 0 || summary.perDiemHalf > 0 ? <span>
                            {summary.perDiemFull > 0 && `${summary.perDiemFull} hel`}
                            {summary.perDiemFull > 0 && summary.perDiemHalf > 0 && ', '}
                            {summary.perDiemHalf > 0 && `${summary.perDiemHalf} halv`}
                          </span> : '-'}
                      </TableCell>
                    </TableRow>)}
                </TableBody>
              </Table>
            </div>}
        </CardContent>
      </Card>

      {/* Action buttons */}
      <div className="flex justify-end gap-4">
        <Button variant="outline" onClick={handleOpenAllMappings}>
          <Settings className="mr-2 h-4 w-4" />
          Hantera Fortnox-mappningar
        </Button>
        <Button onClick={handleExportClick} disabled={selectedCount === 0} size="lg">
          <Download className="mr-2 h-5 w-5" />
          Skapa löneunderlag för Fortnox ({selectedCount} anställda)
        </Button>
      </div>

      {/* Mapping Dialog */}
      <Dialog open={showMappingDialog} onOpenChange={setShowMappingDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Konfigurera Fortnox-koder
            </DialogTitle>
            <DialogDescription>
              Följande koder används i perioden men saknar Fortnox-mappning. 
              Ange era Fortnox lönearter (t.ex. 11, 310, 530).
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {missingMappings.map(code => <div key={code.code} className="space-y-2">
                <Label htmlFor={code.code}>
                  {code.name}
                  <span className="text-muted-foreground ml-2 text-sm font-normal">
                    ({code.code})
                  </span>
                </Label>
                <Input id={code.code} placeholder={`Fortnox-kod (förslag: ${code.default_fortnox_code})`} value={mappingInputs[code.code] || ''} onChange={e => setMappingInputs(prev => ({
              ...prev,
              [code.code]: e.target.value
            }))} />
                <p className="text-xs text-muted-foreground">{code.description}</p>
              </div>)}
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowMappingDialog(false)}>
              Avbryt
            </Button>
            <Button onClick={handleSaveMappings}>
              Spara och fortsätt
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* All Mappings Dialog */}
      <Dialog open={showAllMappingsDialog} onOpenChange={setShowAllMappingsDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Fortnox-mappningar
            </DialogTitle>
            <DialogDescription>
              Mappa interna koder till era lönearter i Fortnox. Endast koder som används i tidrapporterna visas.
            </DialogDescription>
          </DialogHeader>

          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={() => setShowAddCodeDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Lägg till egen lönekod
            </Button>
          </div>
          
          <div className="space-y-4 py-4">
            {usedSalaryCodes.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                Inga koder används för de valda anställda i denna period.
              </p>
            ) : usedSalaryCodes.map(code => {
              const currentMapping = companyMappings.find(m => m.internal_code === code.code);
              const isCustomCode = code.category === 'custom';
              return (
                <div key={code.code} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor={`all-${code.code}`}>
                      {code.name}
                      <span className="text-muted-foreground ml-2 text-sm font-normal">
                        ({code.code})
                      </span>
                      {isCustomCode && (
                        <Badge variant="secondary" className="ml-2">Egen kod</Badge>
                      )}
                    </Label>
                    <div className="flex items-center gap-2">
                      {currentMapping && (
                        <Badge variant="outline" className="text-green-600 border-green-600">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Mappad
                        </Badge>
                      )}
                      {isCustomCode && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                          onClick={() => handleDeleteCode(code.code)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                  <Input
                    id={`all-${code.code}`}
                    placeholder={`Fortnox-kod (förslag: ${code.default_fortnox_code || 'ej angiven'})`}
                    value={allMappingInputs[code.code] || ''}
                    onChange={e =>
                      setAllMappingInputs(prev => ({
                        ...prev,
                        [code.code]: e.target.value,
                      }))
                    }
                  />
                  <p className="text-xs text-muted-foreground">{code.description}</p>
                </div>
              );
            })}
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAllMappingsDialog(false)}>
              Avbryt
            </Button>
            <Button onClick={handleSaveAllMappings}>
              Spara mappningar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Code Dialog */}
      <Dialog open={showAddCodeDialog} onOpenChange={setShowAddCodeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5" />
              Lägg till egen lönekod
            </DialogTitle>
            <DialogDescription>
              Skapa en egen lönekod som matchar en löneart i ert Fortnox.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="new-code-name">Namn *</Label>
              <Input
                id="new-code-name"
                placeholder="T.ex. Övertid 70%"
                value={newCodeName}
                onChange={e => setNewCodeName(e.target.value)}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="new-code-fortnox">Fortnox löneart *</Label>
              <Input
                id="new-code-fortnox"
                placeholder="T.ex. 315"
                value={newCodeFortnox}
                onChange={e => setNewCodeFortnox(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Ange exakt samma kod som i ert Fortnox-register
              </p>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="new-code-description">Beskrivning</Label>
              <Input
                id="new-code-description"
                placeholder="T.ex. Övertid med 70% tillägg"
                value={newCodeDescription}
                onChange={e => setNewCodeDescription(e.target.value)}
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddCodeDialog(false)}>
              Avbryt
            </Button>
            <Button onClick={handleAddNewCode}>
              Lägg till
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Employee Number Dialog */}
      <Dialog open={showEmployeeDialog} onOpenChange={setShowEmployeeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-500" />
              Anställningsnummer saknas
            </DialogTitle>
            <DialogDescription>
              Följande anställda saknar anställningsnummer som krävs för Fortnox-exporten. 
              Gå till AdminHub → Användare och lägg till anställningsnummer för dessa personer.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-2 py-4">
            {missingEmployeeNumbers.map(emp => <div key={emp.userId} className="flex items-center gap-2 p-2 border rounded">
                <AlertTriangle className="h-4 w-4 text-orange-500" />
                <span>{emp.fullName}</span>
              </div>)}
          </div>
          
          <DialogFooter>
            <Button onClick={() => setShowEmployeeDialog(false)}>
              Stäng
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={showPreviewDialog} onOpenChange={setShowPreviewDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              Förhandsgranska export
            </DialogTitle>
            <DialogDescription>
              Kontrollera att allt ser korrekt ut innan du skapar löneunderlaget.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Period</p>
                <p className="font-medium">
                  {format(periodDates.start, 'd MMMM', {
                  locale: sv
                })} - {format(periodDates.end, 'd MMMM yyyy', {
                  locale: sv
                })}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Anställda</p>
                <p className="font-medium">{selectedCount} personer</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Kalenderposter</p>
                <p className="font-medium">
                  {selectedSummaries.reduce((sum, s) => sum + s.entries.length, 0)} poster
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Filformat</p>
                <p className="font-medium">PAXml 2.0</p>
              </div>
            </div>
            
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-sm">
                <strong>Tips:</strong> I Fortnox, gå till Lön → Kalender → Importera löneunderlag 
                och välj den nedladdade XML-filen.
              </p>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPreviewDialog(false)}>
              Avbryt
            </Button>
            <Button onClick={handleGenerateExport}>
              <Download className="mr-2 h-4 w-4" />
              Ladda ner PAXml
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
