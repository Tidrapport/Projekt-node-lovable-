import { useMemo, useState, useRef, useEffect, useCallback } from "react";
import { format, addDays, startOfWeek, parseISO, differenceInDays, addWeeks, subWeeks } from "date-fns";
import { sv } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Calendar, Trash2, MapPin, User, FileText, Briefcase, Clock, Phone, Car, Pencil } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface ScheduledAssignment {
  id: string;
  user_id: string;
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
  is_tentative: boolean;
  profiles: {
    full_name: string;
  };
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

interface UserProfile {
  id: string;
  full_name: string;
}

interface DragSelection {
  userId: string;
  startDayIndex: number;
  endDayIndex: number;
}

interface PlanningGanttProps {
  assignments: ScheduledAssignment[];
  users: UserProfile[];
  onDeleteAssignment: (id: string) => void;
  onCreateAssignment?: (userId: string, startDate: Date, endDate: Date) => void;
  onEditAssignment?: (assignment: ScheduledAssignment) => void;
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

export function PlanningGantt({ assignments, users, onDeleteAssignment, onCreateAssignment, onEditAssignment }: PlanningGanttProps) {
  const [viewStart, setViewStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [weeksToShow, setWeeksToShow] = useState(2);
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [selectedAssignment, setSelectedAssignment] = useState<ScheduledAssignment | null>(null);
  const [dragSelection, setDragSelection] = useState<DragSelection | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const NAME_COL_WIDTH = 140;

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
    const availableWidth = containerWidth - NAME_COL_WIDTH;
    return Math.max(availableWidth / days.length, 24);
  }, [containerWidth, days.length]);

  const projectColorMap = useMemo(() => {
    const map = new Map<string, string>();
    const uniqueProjects = [...new Set(assignments.map((a) => a.project_id))];
    uniqueProjects.forEach((projectId, index) => {
      map.set(projectId, PROJECT_COLORS[index % PROJECT_COLORS.length]);
    });
    return map;
  }, [assignments]);

  const getUserAssignments = (userId: string) => {
    return assignments.filter((a) => a.user_id === userId);
  };

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

  // Drag selection handlers
  const handleDragStart = useCallback((userId: string, dayIndex: number) => {
    setIsDragging(true);
    setDragSelection({ userId, startDayIndex: dayIndex, endDayIndex: dayIndex });
  }, []);

  const handleDragMove = useCallback((userId: string, dayIndex: number) => {
    if (isDragging && dragSelection && dragSelection.userId === userId) {
      setDragSelection(prev => prev ? { ...prev, endDayIndex: dayIndex } : null);
    }
  }, [isDragging, dragSelection]);

  const handleDragEnd = useCallback(() => {
    if (isDragging && dragSelection && onCreateAssignment) {
      const startIndex = Math.min(dragSelection.startDayIndex, dragSelection.endDayIndex);
      const endIndex = Math.max(dragSelection.startDayIndex, dragSelection.endDayIndex);
      const startDate = days[startIndex];
      const endDate = days[endIndex];
      onCreateAssignment(dragSelection.userId, startDate, endDate);
    }
    setIsDragging(false);
    setDragSelection(null);
  }, [isDragging, dragSelection, days, onCreateAssignment]);

  // Global mouse up listener
  useEffect(() => {
    const handleMouseUp = () => {
      if (isDragging) {
        handleDragEnd();
      }
    };
    window.addEventListener("mouseup", handleMouseUp);
    return () => window.removeEventListener("mouseup", handleMouseUp);
  }, [isDragging, handleDragEnd]);

  const getSelectionStyle = (userId: string) => {
    if (!dragSelection || dragSelection.userId !== userId) return null;
    
    const startIndex = Math.min(dragSelection.startDayIndex, dragSelection.endDayIndex);
    const endIndex = Math.max(dragSelection.startDayIndex, dragSelection.endDayIndex);
    const width = (endIndex - startIndex + 1) * dayWidth - 4;
    
    return {
      left: startIndex * dayWidth + 2,
      width: width,
    };
  };

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

      <div className="text-xs text-muted-foreground mb-2">
        💡 Dra över dagar för att skapa ny planering
      </div>

      <div className="border rounded-lg overflow-hidden bg-card select-none">
        {/* Header */}
        <div className="flex border-b bg-muted/50">
          <div 
            className="p-2 font-semibold text-xs border-r bg-muted/50 shrink-0"
            style={{ width: NAME_COL_WIDTH }}
          >
            Anställd
          </div>
          <div className="flex-1 overflow-hidden">
            {/* Week headers */}
            <div className="flex border-b">
              {weeks.map((week, i) => (
                <div
                  key={`week-${week.weekNum}-${i}`}
                  className="text-center font-semibold text-xs py-1 border-r last:border-r-0 bg-muted/30"
                  style={{ width: week.days.length * dayWidth }}
                >
                  v.{week.weekNum}
                </div>
              ))}
            </div>
            {/* Day headers */}
            <div className="flex">
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
                    <div>{format(day, "EEEEE", { locale: sv })}</div>
                    <div>{format(day, "d")}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* User rows */}
        {users.map((user) => {
          const userAssignments = getUserAssignments(user.id);
          const selectionStyle = getSelectionStyle(user.id);
          
          return (
            <div key={user.id} className="flex border-b last:border-b-0 hover:bg-muted/20">
              <div 
                className="p-2 border-r text-xs font-medium truncate bg-background shrink-0"
                style={{ width: NAME_COL_WIDTH }}
                title={user.full_name}
              >
                {user.full_name}
              </div>
              <div className="flex-1 relative h-12 overflow-hidden">
                {/* Grid lines - now interactive for drag */}
                <div className="absolute inset-0 flex">
                  {days.map((day, i) => {
                    const isWeekend = day.getDay() === 0 || day.getDay() === 6;
                    const isToday = format(day, "yyyy-MM-dd") === format(new Date(), "yyyy-MM-dd");
                    return (
                      <div
                        key={i}
                        className={`border-r last:border-r-0 cursor-crosshair ${isWeekend ? "bg-muted/30" : ""} ${
                          isToday ? "bg-primary/10" : ""
                        }`}
                        style={{ width: dayWidth }}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          handleDragStart(user.id, i);
                        }}
                        onMouseEnter={() => handleDragMove(user.id, i)}
                      />
                    );
                  })}
                </div>

                {/* Drag selection overlay */}
                {selectionStyle && (
                  <div
                    className="absolute top-1.5 h-9 bg-primary/40 rounded border-2 border-primary border-dashed pointer-events-none"
                    style={{
                      left: selectionStyle.left,
                      width: selectionStyle.width,
                    }}
                  />
                )}

                {/* Assignments */}
                <TooltipProvider>
                {userAssignments.map((assignment) => {
                    const position = getAssignmentPosition(assignment);
                    if (!position) return null;
                    const color = assignment.is_tentative ? "bg-gray-400" : (projectColorMap.get(assignment.project_id) || "bg-gray-500");
                    return (
                      <Tooltip key={assignment.id}>
                        <TooltipTrigger asChild>
                          <div
                            className={`absolute top-1.5 h-9 ${color} rounded cursor-pointer hover:opacity-80 transition-opacity flex items-center px-1 overflow-hidden shadow-sm z-10 ${assignment.is_tentative ? "border-2 border-dashed border-gray-500" : ""}`}
                            style={{
                              left: position.left + 2,
                              width: position.width,
                            }}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedAssignment(assignment);
                            }}
                          >
                            <span className="text-white text-[10px] font-medium truncate">
                              {assignment.is_tentative ? "? " : ""}{assignment.projects.name}
                            </span>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-xs z-50 bg-popover border">
                          <p className="text-xs">{assignment.is_tentative ? "Eventuellt jobb - " : ""}Klicka för detaljer</p>
                        </TooltipContent>
                      </Tooltip>
                    );
                  })}
                </TooltipProvider>
              </div>
            </div>
          );
        })}

        {users.length === 0 && (
          <div className="p-8 text-center text-muted-foreground">
            Inga användare att visa
          </div>
        )}
      </div>

      {/* Legend */}
      {[...projectColorMap.entries()].length > 0 && (
        <div className="flex flex-wrap gap-2 p-2 bg-muted/30 rounded-lg text-xs">
          <div className="flex items-center gap-1">
            <div className="w-2.5 h-2.5 rounded bg-gray-400 border border-dashed border-gray-500" />
            <span>Eventuellt jobb</span>
          </div>
          {[...projectColorMap.entries()].map(([projectId, color]) => {
            const project = assignments.find((a) => a.project_id === projectId);
            return (
              <div key={projectId} className="flex items-center gap-1">
                <div className={`w-2.5 h-2.5 rounded ${color}`} />
                <span>{project?.projects.name}</span>
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
              {selectedAssignment?.projects.name}
            </DialogTitle>
            {selectedAssignment?.subprojects && (
              <DialogDescription>{selectedAssignment.subprojects.name}</DialogDescription>
            )}
          </DialogHeader>
          
          {selectedAssignment && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">Anställd:</span>
                <span>{selectedAssignment.profiles.full_name}</span>
              </div>

              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">Period:</span>
                <span>
                  {format(parseISO(selectedAssignment.start_date), "d MMMM", { locale: sv })} -{" "}
                  {format(parseISO(selectedAssignment.end_date), "d MMMM yyyy", { locale: sv })}
                </span>
              </div>

              {selectedAssignment.projects.customer_name && (
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">Kund:</span>
                  <span>{selectedAssignment.projects.customer_name}</span>
                </div>
              )}

              {selectedAssignment.projects.location && (
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">Plats:</span>
                  <span>{selectedAssignment.projects.location}</span>
                </div>
              )}

              {selectedAssignment.projects.work_task && (
                <div className="flex items-start gap-2">
                  <Briefcase className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <div>
                    <span className="font-medium">Arbetsuppgift:</span>
                    <p className="text-muted-foreground">{selectedAssignment.projects.work_task}</p>
                  </div>
                </div>
              )}

              {selectedAssignment.projects.description && (
                <div className="flex items-start gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <div>
                    <span className="font-medium">Beskrivning:</span>
                    <p className="text-muted-foreground">{selectedAssignment.projects.description}</p>
                  </div>
                </div>
              )}

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

              {selectedAssignment.notes && (
                <div className="p-3 bg-muted/50 rounded-lg">
                  <span className="font-medium text-sm">Planeringsnotering:</span>
                  <p className="text-sm text-muted-foreground mt-1">{selectedAssignment.notes}</p>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                {onEditAssignment && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      onEditAssignment(selectedAssignment);
                      setSelectedAssignment(null);
                    }}
                  >
                    <Pencil className="h-4 w-4 mr-2" />
                    Redigera
                  </Button>
                )}
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => {
                    onDeleteAssignment(selectedAssignment.id);
                    setSelectedAssignment(null);
                  }}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Ta bort planering
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
