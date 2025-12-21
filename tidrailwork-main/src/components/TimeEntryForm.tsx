import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PROJECT_OPTIONS, ACTIVITY_OPTIONS, TimeEntry } from "@/types/timeEntry";
import { Clock } from "lucide-react";
import { toast } from "sonner";

// Generate time options in 10-minute intervals
const TIME_OPTIONS = Array.from({ length: 144 }, (_, i) => {
  const hours = Math.floor(i / 6).toString().padStart(2, '0');
  const minutes = ((i % 6) * 10).toString().padStart(2, '0');
  return `${hours}:${minutes}`;
});

interface TimeEntryFormProps {
  onAddEntry: (entry: TimeEntry) => void;
}

export const TimeEntryForm = ({ onAddEntry }: TimeEntryFormProps) => {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [breakMinutes, setBreakMinutes] = useState("0");
  const [project, setProject] = useState("");
  const [activity, setActivity] = useState("");
  const [description, setDescription] = useState("");

  const calculateHours = (start: string, end: string, breakMins: number): number => {
    if (!start || !end) return 0;

    const [startHour, startMin] = start.split(":").map(Number);
    const [endHour, endMin] = end.split(":").map(Number);

    const startDate = new Date();
    startDate.setHours(startHour, startMin, 0, 0);
    const endDate = new Date();
    endDate.setHours(endHour, endMin, 0, 0);

    if (endDate <= startDate) {
      endDate.setDate(endDate.getDate() + 1);
    }

    const totalMinutesRaw = Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60));
    const effectiveBreak = Math.max(0, Math.min(breakMins, totalMinutesRaw));
    const workMinutes = totalMinutesRaw - effectiveBreak;

    return workMinutes > 0 ? workMinutes / 60 : 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!startTime || !endTime || !project || !activity) {
      toast.error("Vänligen fyll i alla obligatoriska fält");
      return;
    }

    const totalHours = calculateHours(startTime, endTime, parseInt(breakMinutes));
    
    if (totalHours <= 0) {
      toast.error("Sluttid måste vara efter starttid");
      return;
    }

    const entry: TimeEntry = {
      id: crypto.randomUUID(),
      date,
      startTime,
      endTime,
      breakMinutes: parseInt(breakMinutes),
      project,
      activity,
      description,
      totalHours
    };

    onAddEntry(entry);
    
    // Reset form
    setStartTime("");
    setEndTime("");
    setBreakMinutes("0");
    setProject("");
    setActivity("");
    setDescription("");
    
    toast.success("Tidrapport tillagd!");
  };

  return (
    <Card className="shadow-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-heading">
          <Clock className="h-5 w-5 text-primary" />
          Ny tidrapport
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="date">Datum</Label>
              <Input
                id="date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="break">Rast (minuter)</Label>
              <Input
                id="break"
                type="number"
                value={breakMinutes}
                onChange={(e) => setBreakMinutes(e.target.value)}
                min="0"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startTime">Starttid</Label>
              <Select value={startTime} onValueChange={setStartTime} required>
                <SelectTrigger id="startTime">
                  <SelectValue placeholder="Välj starttid" />
                </SelectTrigger>
                <SelectContent>
                  {TIME_OPTIONS.map((time) => (
                    <SelectItem key={`start-${time}`} value={time}>
                      {time}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="endTime">Sluttid</Label>
              <Select value={endTime} onValueChange={setEndTime} required>
                <SelectTrigger id="endTime">
                  <SelectValue placeholder="Välj sluttid" />
                </SelectTrigger>
                <SelectContent>
                  {TIME_OPTIONS.map((time) => (
                    <SelectItem key={`end-${time}`} value={time}>
                      {time}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="project">Projekt</Label>
              <Select value={project} onValueChange={setProject} required>
                <SelectTrigger id="project">
                  <SelectValue placeholder="Välj projekt" />
                </SelectTrigger>
                <SelectContent>
                  {PROJECT_OPTIONS.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="activity">Aktivitet</Label>
              <Select value={activity} onValueChange={setActivity} required>
                <SelectTrigger id="activity">
                  <SelectValue placeholder="Välj aktivitet" />
                </SelectTrigger>
                <SelectContent>
                  {ACTIVITY_OPTIONS.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Beskrivning (valfritt)</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Beskriv arbetet..."
              rows={3}
            />
          </div>

          <Button type="submit" className="w-full bg-gradient-primary">
            Lägg till tidrapport
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};
