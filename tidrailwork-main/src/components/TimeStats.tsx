import { TimeEntry } from "@/types/timeEntry";
import { Card, CardContent } from "@/components/ui/card";
import { Clock, Calendar, TrendingUp } from "lucide-react";
import { startOfWeek, startOfMonth, endOfWeek, endOfMonth, isWithinInterval } from "date-fns";

interface TimeStatsProps {
  entries: TimeEntry[];
}

export const TimeStats = ({ entries }: TimeStatsProps) => {
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  
  const weekStart = startOfWeek(today, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(today, { weekStartsOn: 1 });
  const monthStart = startOfMonth(today);
  const monthEnd = endOfMonth(today);

  const todayHours = entries
    .filter(e => e.date === todayStr)
    .reduce((sum, e) => sum + e.totalHours, 0);

  const weekHours = entries
    .filter(e => {
      const entryDate = new Date(e.date);
      return isWithinInterval(entryDate, { start: weekStart, end: weekEnd });
    })
    .reduce((sum, e) => sum + e.totalHours, 0);

  const monthHours = entries
    .filter(e => {
      const entryDate = new Date(e.date);
      return isWithinInterval(entryDate, { start: monthStart, end: monthEnd });
    })
    .reduce((sum, e) => sum + e.totalHours, 0);

  const stats = [
    { label: "Idag", value: todayHours, icon: Clock, color: "text-accent" },
    { label: "Denna vecka", value: weekHours, icon: Calendar, color: "text-primary" },
    { label: "Denna månad", value: monthHours, icon: TrendingUp, color: "text-primary" },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {stats.map((stat) => (
        <Card key={stat.label} className="shadow-card hover:shadow-elevated transition-shadow">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">{stat.label}</p>
                <p className="text-3xl font-bold font-heading">
                  {stat.value.toFixed(1)}
                  <span className="text-lg text-muted-foreground ml-1">h</span>
                </p>
              </div>
              <stat.icon className={`h-10 w-10 ${stat.color} opacity-80`} />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
