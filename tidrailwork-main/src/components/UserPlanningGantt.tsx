import { useMemo, useState, useRef, useEffect } from "react";
import { format, addDays, startOfWeek, parseISO, differenceInDays, addWeeks, subWeeks } from "date-fns";
import { sv } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Calendar, MapPin, FileText, Briefcase, Clock, Phone, Car } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface ScheduledAssignment {
  id: string;
  project_id: string;
  subproject_id: string | null;
  start_date: string;
  end_date: string;
  notes: string | null;
  first_shift_start_time: string | null;
  contact_person: string | null;
  contact_phone: string | null;
  vehicle: string | null;
  work_address: string | null;
  is_tentative?: boolean;
  projects: {
    name: string;
    location?: string | null;
    customer_name?: string | null;
    work_task?: string | null;
    description?: string | null;
  };
  subprojects: {
    name: string;
    description?: string | null;
  } | null;
}

interface UserPlanningGanttProps {
  assignments: ScheduledAssignment[];
}

const PROJECT_COLORS = [
  "bg-blue-500",
  "bg-green-500",
  "bg-purple-500",
  "bg-orange-500",
  "bg-pink-500",
  "bg-cyan-500",
  "bg-yellow-500",
  "bg-red-500",
  "bg-indigo-500",
  "bg-teal-500",
];

export function UserPlanningGantt({ assignments }: UserPlanningGanttProps) {
  const [viewStart, setViewStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [weeksToShow, setWeeksToShow] = useState(2);
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [selectedAssignment, setSelectedAssignment] = useState<ScheduledAssignment | null>(null);

  useEffect(() => {
    const updateWidth = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.offsetWidth);
      }
    };
    updateWidth();
    window.addEventListener("resize", updateWidth);
    return () => window.removeEventListener("resize", updateWidth);
  }, []);

  const viewEnd = useMemo(() => addDays(viewStart, weeksToShow * 7 - 1), [viewStart, weeksToShow]);

  const days = useMemo(() => {
    const result: Date[] = [];
    let current = viewStart;
    while (current <= viewEnd) {
      result.push(current);
      current = addDays(current, 1);
    }
    return result;
  }, [viewStart, viewEnd]);

  const weeks = useMemo(() => {
    const result: { weekNum: number; year: number; days: Date[] }[] = [];
    let currentWeekDays: Date[] = [];
    let currentWeekNum = -1;

    days.forEach((day) => {
      const weekNum = parseInt(format(day, "w", { locale: sv }));
      if (weekNum !== currentWeekNum) {
        if (currentWeekDays.length > 0) {
          result.push({ weekNum: currentWeekNum, year: day.getFullYear(), days: currentWeekDays });
        }
        currentWeekDays = [day];
        currentWeekNum = weekNum;
      } else {
        currentWeekDays.push(day);
      }
    });
    if (currentWeekDays.length > 0) {
      result.push({ weekNum: currentWeekNum, year: days[days.length - 1].getFullYear(), days: currentWeekDays });
    }
    return result;
  }, [days]);

  const dayWidth = useMemo(() => {
    const availableWidth = containerWidth;
    return Math.max(availableWidth / days.length, 32);
  }, [containerWidth, days.length]);

  // Filter out assignments with missing project data
  const validAssignments = useMemo(() => {
    return assignments.filter((a) => a.projects !== null);
  }, [assignments]);

  const projectColorMap = useMemo(() => {
    const map = new Map<string, string>();
    const uniqueProjects = [...new Set(validAssignments.map((a) => a.project_id))];
    uniqueProjects.forEach((projectId, index) => {
      map.set(projectId, PROJECT_COLORS[index % PROJECT_COLORS.length]);
    });
    return map;
  }, [validAssignments]);

  const getAssignmentPosition = (assignment: ScheduledAssignment) => {
    const start = parseISO(assignment.start_date);
    const end = parseISO(assignment.end_date);

    const visibleStart = start < viewStart ? viewStart : start;
    const visibleEnd = end > viewEnd ? viewEnd : end;

    if (visibleStart > viewEnd || visibleEnd < viewStart) {
      return null;
    }

    const startOffset = differenceInDays(visibleStart, viewStart);
    const duration = differenceInDays(visibleEnd, visibleStart) + 1;

    return {
      left: startOffset * dayWidth,
      width: duration * dayWidth - 4,
    };
  };

  const handlePrevious = () => setViewStart(subWeeks(viewStart, 1));
  const handleNext = () => setViewStart(addWeeks(viewStart, 1));
  const handleToday = () => setViewStart(startOfWeek(new Date(), { weekStartsOn: 1 }));

  return (
    <div className="space-y-4" ref={containerRef}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <Button variant="outline" size="sm" onClick={handlePrevious}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={handleToday}>
            <Calendar className="h-4 w-4 mr-1" />
            <span className="hidden sm:inline">Idag</span>
          </Button>
          <Button variant="outline" size="sm" onClick={handleNext}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-xs text-muted-foreground hidden sm:inline">Visa:</span>
          {[1, 2, 3, 4].map((w) => (
            <Button
              key={w}
              variant={weeksToShow === w ? "default" : "outline"}
              size="sm"
              onClick={() => setWeeksToShow(w)}
              className="px-2 text-xs"
            >
              {w}v
            </Button>
          ))}
        </div>
      </div>

      <div className="border rounded-lg overflow-hidden bg-card">
        {/* Header */}
        <div className="bg-muted/50">
          {/* Week headers */}
          <div className="flex border-b">
            {weeks.map((week, i) => (
              <div
                key={`week-${week.weekNum}-${i}`}
                className="text-center font-semibold text-xs py-1 border-r last:border-r-0 bg-muted/30"
                style={{ width: week.days.length * dayWidth }}
              >
                Vecka {week.weekNum}
              </div>
            ))}
          </div>
          {/* Day headers */}
          <div className="flex border-b">
            {days.map((day, i) => {
              const isWeekend = day.getDay() === 0 || day.getDay() === 6;
              const isToday = format(day, "yyyy-MM-dd") === format(new Date(), "yyyy-MM-dd");
              return (
                <div
                  key={i}
                  className={`text-center text-[10px] py-1 border-r last:border-r-0 ${
                    isWeekend ? "bg-muted/50" : ""
                  } ${isToday ? "bg-primary/20 font-bold" : ""}`}
                  style={{ width: dayWidth }}
                >
                  <div className="font-medium">{format(day, "EEE", { locale: sv })}</div>
                  <div>{format(day, "d MMM", { locale: sv })}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Assignments row */}
        <div className="relative min-h-[80px] p-2">
          {/* Grid lines */}
          <div className="absolute inset-0 flex pointer-events-none">
            {days.map((day, i) => {
              const isWeekend = day.getDay() === 0 || day.getDay() === 6;
              const isToday = format(day, "yyyy-MM-dd") === format(new Date(), "yyyy-MM-dd");
              return (
                <div
                  key={i}
                  className={`border-r last:border-r-0 ${isWeekend ? "bg-muted/20" : ""} ${
                    isToday ? "bg-primary/10" : ""
                  }`}
                  style={{ width: dayWidth }}
                />
              );
            })}
          </div>

          {/* Assignments */}
          <TooltipProvider>
            {validAssignments.map((assignment, index) => {
              const position = getAssignmentPosition(assignment);
              if (!position) return null;
              const color = assignment.is_tentative ? "bg-gray-400" : (projectColorMap.get(assignment.project_id) || "bg-gray-500");
              return (
                <Tooltip key={assignment.id}>
                  <TooltipTrigger asChild>
                    <div
                      className={`relative h-12 ${color} rounded cursor-pointer hover:opacity-80 transition-opacity flex items-center px-2 overflow-hidden shadow-sm mb-2 ${assignment.is_tentative ? "border-2 border-dashed border-gray-500" : ""}`}
                      style={{
                        marginLeft: position.left + 2,
                        width: position.width,
                      }}
                      onClick={() => setSelectedAssignment(assignment)}
                    >
                      <span className="text-white text-xs font-medium truncate">
                        {assignment.is_tentative ? "? " : ""}{assignment.projects.name}
                        {assignment.subprojects && ` - ${assignment.subprojects.name}`}
                      </span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-xs z-50 bg-popover border">
                    <p className="text-xs font-medium">{assignment.is_tentative ? "Eventuellt jobb - " : ""}{assignment.projects.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(parseISO(assignment.start_date), "d MMM", { locale: sv })} - {format(parseISO(assignment.end_date), "d MMM", { locale: sv })}
                    </p>
                    <p className="text-xs mt-1">Klicka för detaljer</p>
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </TooltipProvider>

          {validAssignments.length === 0 && (
            <div className="flex items-center justify-center h-16 text-muted-foreground text-sm">
              Ingen planering för denna period
            </div>
          )}
        </div>
      </div>

      {/* Legend */}
      {[...projectColorMap.entries()].length > 0 && (
        <div className="flex flex-wrap gap-3 p-3 bg-muted/30 rounded-lg text-xs">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-gray-400 border border-dashed border-gray-500" />
            <span>Eventuellt jobb</span>
          </div>
          {[...projectColorMap.entries()].map(([projectId, color]) => {
            const project = validAssignments.find((a) => a.project_id === projectId);
            return (
              <div key={projectId} className="flex items-center gap-1.5">
                <div className={`w-3 h-3 rounded ${color}`} />
                <span>{project?.projects?.name}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Assignment Details Dialog */}
      <Dialog open={!!selectedAssignment} onOpenChange={(open) => !open && setSelectedAssignment(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Briefcase className="h-5 w-5" />
              {selectedAssignment?.projects?.name}
            </DialogTitle>
            {selectedAssignment?.subprojects && (
              <DialogDescription>{selectedAssignment.subprojects.name}</DialogDescription>
            )}
          </DialogHeader>
          
          {selectedAssignment && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">Period:</span>
                <span>
                  {format(parseISO(selectedAssignment.start_date), "d MMMM", { locale: sv })} -{" "}
                  {format(parseISO(selectedAssignment.end_date), "d MMMM yyyy", { locale: sv })}
                </span>
              </div>

              {selectedAssignment.first_shift_start_time && (
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">Första skift:</span>
                  <span>{selectedAssignment.first_shift_start_time.slice(0, 5)}</span>
                </div>
              )}

              {selectedAssignment.vehicle && (
                <div className="flex items-center gap-2">
                  <Car className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">Fordon:</span>
                  <span>{selectedAssignment.vehicle}</span>
                </div>
              )}

              {selectedAssignment.projects?.customer_name && (
                <div className="flex items-center gap-2">
                  <Briefcase className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">Kund:</span>
                  <span>{selectedAssignment.projects.customer_name}</span>
                </div>
              )}

              {selectedAssignment.projects?.location && (
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">Plats:</span>
                  <span>{selectedAssignment.projects.location}</span>
                </div>
              )}

              {(selectedAssignment.contact_person || selectedAssignment.contact_phone) && (
                <div className="p-3 bg-muted/50 rounded-lg space-y-1">
                  <span className="font-medium text-sm">Kontaktperson:</span>
                  {selectedAssignment.contact_person && (
                    <p className="text-sm">{selectedAssignment.contact_person}</p>
                  )}
                  {selectedAssignment.contact_phone && (
                    <div className="flex items-center gap-1 text-sm">
                      <Phone className="h-3 w-3" />
                      <a href={`tel:${selectedAssignment.contact_phone}`} className="text-primary hover:underline">
                        {selectedAssignment.contact_phone}
                      </a>
                    </div>
                  )}
                </div>
              )}

              {selectedAssignment.work_address && (
                <div className="flex items-start gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <div>
                    <span className="font-medium">Arbetsplatsens adress:</span>
                    <p className="text-muted-foreground">{selectedAssignment.work_address}</p>
                  </div>
                </div>
              )}

              {selectedAssignment.projects?.work_task && (
                <div className="flex items-start gap-2">
                  <Briefcase className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <div>
                    <span className="font-medium">Arbetsuppgift:</span>
                    <p className="text-muted-foreground">{selectedAssignment.projects.work_task}</p>
                  </div>
                </div>
              )}

              {selectedAssignment.projects?.description && (
                <div className="flex items-start gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <div>
                    <span className="font-medium">Beskrivning:</span>
                    <p className="text-muted-foreground">{selectedAssignment.projects.description}</p>
                  </div>
                </div>
              )}

              {selectedAssignment.notes && (
                <div className="flex items-start gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <div>
                    <span className="font-medium">Anteckningar:</span>
                    <p className="text-muted-foreground">{selectedAssignment.notes}</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
