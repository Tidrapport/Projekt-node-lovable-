import { useState, useEffect } from "react";
import { TimeEntry } from "@/types/timeEntry";
import { TimeEntryForm } from "@/components/TimeEntryForm";
import { TimeEntryList } from "@/components/TimeEntryList";
import { TimeStats } from "@/components/TimeStats";
import { Train } from "lucide-react";
import { toast } from "sonner";

const STORAGE_KEY = "railway-time-entries";

const Index = () => {
  const [entries, setEntries] = useState<TimeEntry[]>([]);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        setEntries(JSON.parse(stored));
      } catch (error) {
        console.error("Failed to load entries:", error);
        toast.error("Kunde inte ladda sparade tidrapporter");
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  }, [entries]);

  const handleAddEntry = (entry: TimeEntry) => {
    setEntries([...entries, entry]);
  };

  const handleDeleteEntry = (id: string) => {
    setEntries(entries.filter(e => e.id !== id));
    toast.success("Tidrapport borttagen");
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-gradient-primary text-primary-foreground shadow-elevated">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center gap-3">
            <Train className="h-8 w-8" />
            <div>
              <h1 className="text-3xl font-bold font-heading">Järnvägen Tidrapportering</h1>
              <p className="text-primary-foreground/80 text-sm mt-1">
                Registrera och spåra din arbetstid
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="space-y-8">
          {/* Stats */}
          <TimeStats entries={entries} />

          {/* Form */}
          <TimeEntryForm onAddEntry={handleAddEntry} />

          {/* List */}
          <TimeEntryList entries={entries} onDeleteEntry={handleDeleteEntry} />
        </div>
      </main>

      {/* Footer */}
      <footer className="mt-16 border-t border-border bg-muted/30">
        <div className="container mx-auto px-4 py-6 text-center text-sm text-muted-foreground">
          <p>© 2025 Järnvägen Tidrapportering. All data lagras lokalt i din webbläsare.</p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
