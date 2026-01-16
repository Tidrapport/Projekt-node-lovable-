import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { apiFetch } from "@/api/client";
import { ensureArray } from "@/lib/ensureArray";
import { toast } from "sonner";
import { ClipboardCheck } from "lucide-react";
import { format } from "date-fns";
import { sv } from "date-fns/locale";

type SelfCheckItem = {
  id: string | number;
  label: string;
};

type Assignment = {
  project_id: string | number;
  project_name: string;
  subproject_id?: string | number | null;
  subproject_name?: string | null;
  items: SelfCheckItem[];
  submitted_at?: string | null;
  submission_id?: string | number | null;
};

type AssignmentFormState = {
  notes: string;
  items: Record<string, boolean>;
};

const assignmentKey = (assignment: Assignment) => `${assignment.project_id}:${assignment.subproject_id || "none"}`;

const SelfChecks = () => {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(false);
  const [submittingKey, setSubmittingKey] = useState<string | null>(null);
  const [formState, setFormState] = useState<Record<string, AssignmentFormState>>({});

  const loadAssignments = async () => {
    setLoading(true);
    try {
      const data = await apiFetch<{ assignments?: Assignment[] }>("/self-check/assignments");
      const nextAssignments = ensureArray(data?.assignments);
      setAssignments(nextAssignments);
      setFormState((prev) => {
        const next = { ...prev };
        nextAssignments.forEach((assignment) => {
          const key = assignmentKey(assignment);
          if (!next[key]) {
            const itemsState: Record<string, boolean> = {};
            assignment.items.forEach((item) => {
              itemsState[String(item.id)] = false;
            });
            next[key] = { notes: "", items: itemsState };
          }
        });
        return next;
      });
    } catch (err: any) {
      toast.error(err.message || "Kunde inte hämta egenkontroll");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAssignments();
  }, []);

  const pendingAssignments = useMemo(
    () => assignments.filter((assignment) => !assignment.submitted_at),
    [assignments]
  );

  const handleSubmit = async (assignment: Assignment) => {
    const key = assignmentKey(assignment);
    const state = formState[key];
    setSubmittingKey(key);
    try {
      await apiFetch("/self-check/submissions", {
        method: "POST",
        json: {
          project_id: Number(assignment.project_id),
          subproject_id: assignment.subproject_id ? Number(assignment.subproject_id) : null,
          notes: state?.notes || null,
          items: assignment.items.map((item) => ({
            item_id: item.id,
            checked: state?.items?.[String(item.id)] || false,
          })),
        },
      });
      toast.success("Egenkontroll skickad.");
      await loadAssignments();
    } catch (err: any) {
      toast.error(err.message || "Kunde inte skicka egenkontroll");
    } finally {
      setSubmittingKey(null);
    }
  };

  return (
    <div className="container mx-auto space-y-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Egenkontroll</h1>
          <p className="text-muted-foreground">
            Fyll i egenkontroll för projekt och underprojekt som kräver kontroll.
          </p>
        </div>
        <ClipboardCheck className="h-6 w-6 text-muted-foreground" />
      </div>

      {loading && <p className="text-sm text-muted-foreground">Laddar egenkontroller...</p>}
      {!loading && assignments.length === 0 && (
        <Card>
          <CardContent className="py-6 text-sm text-muted-foreground">
            Inga projekt kräver egenkontroll just nu.
          </CardContent>
        </Card>
      )}

      <div className="space-y-4">
        {assignments.map((assignment) => {
          const key = assignmentKey(assignment);
          const state = formState[key];
          const submittedAt = assignment.submitted_at
            ? format(new Date(assignment.submitted_at), "d MMM yyyy", { locale: sv })
            : null;
          return (
            <Card key={key}>
              <CardHeader className="flex flex-row items-start justify-between gap-4">
                <div>
                  <CardTitle className="text-lg">
                    {assignment.project_name}
                    {assignment.subproject_name ? ` / ${assignment.subproject_name}` : ""}
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">
                    {assignment.subproject_name ? "Underprojekt" : "Projekt"}-egenkontroll
                  </p>
                </div>
                {submittedAt ? <Badge variant="secondary">Skickad {submittedAt}</Badge> : null}
              </CardHeader>
              <CardContent className="space-y-4">
                {assignment.submitted_at ? (
                  <p className="text-sm text-muted-foreground">
                    Din egenkontroll är inskickad och sparad.
                  </p>
                ) : (
                  <>
                    {assignment.items.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        Inga kontrollpunkter är kopplade till detta projekt ännu.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {assignment.items.map((item) => (
                          <label key={item.id} className="flex items-start gap-2 text-sm">
                            <Checkbox
                              checked={!!state?.items?.[String(item.id)]}
                              onCheckedChange={(checked) => {
                                setFormState((prev) => ({
                                  ...prev,
                                  [key]: {
                                    ...prev[key],
                                    items: {
                                      ...(prev[key]?.items || {}),
                                      [String(item.id)]: checked === true,
                                    },
                                  },
                                }));
                              }}
                            />
                            <span>{item.label}</span>
                          </label>
                        ))}
                      </div>
                    )}
                    <div className="space-y-2">
                      <Label>Kommentarer</Label>
                      <Textarea
                        value={state?.notes || ""}
                        onChange={(e) =>
                          setFormState((prev) => ({
                            ...prev,
                            [key]: { ...prev[key], notes: e.target.value },
                          }))
                        }
                        placeholder="Valfria kommentarer eller riskbedömning"
                      />
                    </div>
                    <Button
                      onClick={() => handleSubmit(assignment)}
                      disabled={submittingKey === key}
                    >
                      {submittingKey === key ? "Skickar..." : "Skicka egenkontroll"}
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {!loading && pendingAssignments.length === 0 && assignments.length > 0 && (
        <Card>
          <CardContent className="py-6 text-sm text-muted-foreground">
            Alla egenkontroller är inskickade. Bra jobbat!
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default SelfChecks;
