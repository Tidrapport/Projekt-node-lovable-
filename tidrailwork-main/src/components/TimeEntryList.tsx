import { TimeEntry } from "@/types/timeEntry";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Trash2, FileText } from "lucide-react";
import { format } from "date-fns";
import { sv } from "date-fns/locale";

interface TimeEntryListProps {
  entries: TimeEntry[];
  onDeleteEntry: (id: string) => void;
}

export const TimeEntryList = ({ entries, onDeleteEntry }: TimeEntryListProps) => {
  const sortedEntries = [...entries].sort((a, b) => 
    new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  if (entries.length === 0) {
    return (
      <Card className="shadow-card">
        <CardContent className="pt-6">
          <div className="text-center text-muted-foreground py-8">
            <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>Inga tidrapporter ännu</p>
            <p className="text-sm mt-1">Lägg till din första tidrapport ovan</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-card">
      <CardHeader>
        <CardTitle className="font-heading">Tidrapporter</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {sortedEntries.map((entry) => (
            <div
              key={entry.id}
              className="border border-border rounded-lg p-4 hover:shadow-md transition-shadow bg-card"
            >
              <div className="flex justify-between items-start mb-2">
                <div>
                  <div className="font-semibold text-foreground">
                    {format(new Date(entry.date), "d MMMM yyyy", { locale: sv })}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {entry.startTime} - {entry.endTime} ({entry.totalHours.toFixed(2)}h)
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onDeleteEntry(entry.id)}
                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              
              <div className="grid grid-cols-2 gap-2 text-sm mb-2">
                <div>
                  <span className="text-muted-foreground">Projekt:</span>{" "}
                  <span className="font-medium">{entry.project}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Aktivitet:</span>{" "}
                  <span className="font-medium">{entry.activity}</span>
                </div>
              </div>
              
              {entry.description && (
                <div className="text-sm text-muted-foreground mt-2 pt-2 border-t border-border">
                  {entry.description}
                </div>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
