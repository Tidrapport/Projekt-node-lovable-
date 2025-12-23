import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format, isSameDay, isWithinInterval, parseISO } from "date-fns";
import { sv } from "date-fns/locale";
import { useState, useEffect } from "react";
import { apiFetch } from "@/api/client";
import { useEffectiveUser } from "@/hooks/useEffectiveUser";

interface TimeEntry {
  id: string;
  date: string;
  start_time: string;
  end_time: string;
  total_hours: number;
  project: { name: string };
}

interface ScheduledAssignment {
  id: string;
  start_date: string;
  end_date: string;
  project: { name: string };
  is_tentative: boolean;
}

interface TimeReportsCalendarViewProps {
  entries: TimeEntry[];
  onDateSelect?: (date: Date) => void;
}

export const TimeReportsCalendarView = ({ entries, onDateSelect }: TimeReportsCalendarViewProps) => {
  const { effectiveUserId } = useEffectiveUser();
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [month, setMonth] = useState<Date>(new Date());
  const [assignments, setAssignments] = useState<ScheduledAssignment[]>([]);

  useEffect(() => {
    const fetchAssignments = async () => {
      if (!effectiveUserId) return;

      try {
        // Backend endpoint for plans/scheduled assignments is not defined yet;
        // fall back to an empty list to avoid Supabase dependency.
        const data = await apiFetch<ScheduledAssignment[]>(`/planning?user_id=${effectiveUserId}`).catch(() => []);
        if (Array.isArray(data)) setAssignments(data);
      } catch {
        setAssignments([]);
      }
    };
    
    fetchAssignments();
  }, [effectiveUserId]);

  // Get dates that have entries
  const datesWithEntries = entries.map(entry => new Date(entry.date));

  // Check if a date is within any scheduled assignment
  const isScheduledDay = (date: Date): boolean => {
    return assignments.some(assignment => {
      const start = parseISO(assignment.start_date);
      const end = parseISO(assignment.end_date);
      return isWithinInterval(date, { start, end });
    });
  };

  // Get assignment for a specific date
  const getAssignmentForDate = (date: Date): ScheduledAssignment | undefined => {
    return assignments.find(assignment => {
      const start = parseISO(assignment.start_date);
      const end = parseISO(assignment.end_date);
      return isWithinInterval(date, { start, end });
    });
  };

  // Get entries for selected date
  const selectedDateEntries = selectedDate
    ? entries.filter(entry => isSameDay(new Date(entry.date), selectedDate))
    : [];

  const selectedDateAssignment = selectedDate ? getAssignmentForDate(selectedDate) : undefined;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="text-lg">Kalender</CardTitle>
        </CardHeader>
        <CardContent>
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={(date) => {
              setSelectedDate(date);
              if (date && onDateSelect) onDateSelect(date);
            }}
            month={month}
            onMonthChange={setMonth}
            locale={sv}
            className="pointer-events-auto"
            components={{
              DayContent: ({ date }) => {
                const hasEntry = datesWithEntries.some(d => isSameDay(d, date));
                const isScheduled = isScheduledDay(date);
                const assignment = getAssignmentForDate(date);
                
                return (
                <div 
                    className={`relative w-full h-full flex flex-col items-center justify-center rounded-md ${
                      isScheduled 
                        ? assignment?.is_tentative 
                          ? 'bg-muted border border-dashed border-muted-foreground/50' 
                          : 'bg-primary/30'
                        : ''
                    }`}
                  >
                    <span className={isScheduled ? 'font-medium' : ''}>{date.getDate()}</span>
                    {hasEntry && (
                      <div className="absolute bottom-0.5 left-1/2 transform -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-primary" />
                    )}
                  </div>
                );
              },
            }}
          />
          <div className="mt-4 space-y-2 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-primary/30" />
              <span>Schemalagd arbetsdag</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-primary" />
              <span>Tidrapport inlämnad</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-muted/50 border border-dashed border-muted-foreground/30" />
              <span>Eventuellt jobb</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="text-lg">
            {selectedDate 
              ? format(selectedDate, "EEEE d MMMM", { locale: sv })
              : "Välj en dag"
            }
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!selectedDate ? (
            <p className="text-muted-foreground text-sm">
              Klicka på en dag i kalendern för att se tidrapporter
            </p>
          ) : (
            <div className="space-y-4">
              {selectedDateAssignment && (
                <div className={`p-3 rounded-lg border ${selectedDateAssignment.is_tentative ? 'bg-muted/30 border-dashed' : 'bg-primary/10 border-primary/20'}`}>
                  <p className="text-xs text-muted-foreground mb-1">Schemalagd på</p>
                  <p className="font-medium">
                    {selectedDateAssignment.is_tentative && '? '}
                    {selectedDateAssignment.project?.name}
                  </p>
                </div>
              )}
              
              {selectedDateEntries.length === 0 ? (
                <div className="text-center py-6">
                  <p className="text-muted-foreground">Ingen tidrapport för denna dag</p>
                  {selectedDateAssignment && (
                    <Badge variant="destructive" className="mt-2">Tidrapport saknas</Badge>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  {selectedDateEntries.map((entry) => (
                    <div 
                      key={entry.id} 
                      className="p-3 rounded-lg border bg-muted/30 hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-medium">{entry.project?.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {entry.start_time} - {entry.end_time}
                          </p>
                        </div>
                        <Badge variant="secondary">
                          {entry.total_hours.toFixed(1)}h
                        </Badge>
                      </div>
                    </div>
                  ))}
                  <div className="pt-3 border-t">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">Totalt</span>
                      <Badge>
                        {selectedDateEntries.reduce((sum, e) => sum + e.total_hours, 0).toFixed(1)}h
                      </Badge>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
