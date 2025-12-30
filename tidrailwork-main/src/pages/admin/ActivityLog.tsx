import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/api/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format, subDays } from "date-fns";
import { sv } from "date-fns/locale";
import { RefreshCcw } from "lucide-react";

type AuditLog = {
  id: number | string;
  created_at: string;
  company_id: number | string | null;
  actor_user_id: number | string | null;
  actor_name?: string | null;
  actor_email?: string | null;
  action: string;
  entity_type?: string | null;
  entity_id?: string | null;
  metadata?: string | null;
  success?: number | null;
  ip?: string | null;
  user_agent?: string | null;
};

type UserOption = {
  id: number | string;
  full_name?: string | null;
  email?: string | null;
};

const ACTION_LABELS: Record<string, string> = {
  LOGIN_SUCCESS: "Inloggning lyckad",
  LOGIN_FAILED: "Inloggning misslyckad",
  USER_CREATED: "Skapade användare",
  USER_UPDATED: "Uppdaterade användare",
  ROLE_CHANGED: "Ändrade roll",
  USER_DEACTIVATED: "Avaktiverade användare",
  USER_REACTIVATED: "Återaktiverade användare",
  USER_PASSWORD_RESET: "Återställde lösenord",
  TIME_ENTRY_CREATED: "Skapade tidrad",
  TIME_ENTRY_UPDATED: "Uppdaterade tidrad",
  TIME_ENTRY_DELETED: "Raderade tidrad",
  TIME_ENTRY_ATTESTED: "Attesterade tidrad",
  TIME_ENTRY_REJECTED: "Återkallade attest",
  IMPERSONATE_START: "Impersonate start",
  IMPERSONATE_STOP: "Impersonate stopp",
  SETTINGS_UPDATED: "Uppdaterade inställningar",
};

const ENTITY_LABELS: Record<string, string> = {
  auth: "Auth",
  user: "Användare",
  time_entry: "Tidrad",
  ob_settings: "OB-inställning",
  compensation_settings: "Restidsersättning",
  company: "Företag",
};

const ActivityLog = () => {
  const { companyId } = useAuth();
  const [from, setFrom] = useState(() => format(subDays(new Date(), 30), "yyyy-MM-dd"));
  const [to, setTo] = useState(() => format(new Date(), "yyyy-MM-dd"));
  const [userId, setUserId] = useState("all");
  const [action, setAction] = useState("all");
  const [entityType, setEntityType] = useState("all");
  const [status, setStatus] = useState("all");

  const { data: users = [] } = useQuery({
    queryKey: ["audit-users", companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const data = await apiFetch<UserOption[]>(`/admin/users?company_id=${companyId}&include_inactive=1`);
      return data || [];
    },
    enabled: !!companyId,
  });

  const queryParams = useMemo(() => {
    const params = new URLSearchParams();
    if (from) params.set("from", `${from} 00:00:00`);
    if (to) params.set("to", `${to} 23:59:59`);
    if (userId !== "all") params.set("user_id", userId);
    if (action !== "all") params.set("action", action);
    if (entityType !== "all") params.set("entity_type", entityType);
    if (status !== "all") params.set("success", status === "success" ? "1" : "0");
    params.set("limit", "300");
    return params.toString();
  }, [from, to, userId, action, entityType, status]);

  const {
    data: logs = [],
    isFetching,
    refetch,
  } = useQuery({
    queryKey: ["audit-logs", queryParams],
    queryFn: async () => {
      const data = await apiFetch<AuditLog[]>(`/admin/audit-logs?${queryParams}`);
      return data || [];
    },
  });

  const actionOptions = useMemo(() => {
    return ["all", ...Object.keys(ACTION_LABELS)];
  }, []);

  const entityOptions = useMemo(() => {
    return ["all", ...Object.keys(ENTITY_LABELS)];
  }, []);

  const formatActor = (log: AuditLog) => {
    const name = log.actor_name?.trim();
    if (name) return name;
    if (log.actor_email) return log.actor_email;
    return "System";
  };

  const formatMetadata = (value?: string | null) => {
    if (!value) return "";
    try {
      const parsed = JSON.parse(value);
      return JSON.stringify(parsed);
    } catch {
      return value;
    }
  };

  return (
    <div className="container mx-auto space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">Aktivitetslogg</h1>
        <p className="text-muted-foreground">Översikt över inloggningar och viktiga ändringar</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filter</CardTitle>
          <CardDescription>Avgränsa loggen på datum, användare och händelse</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
          <div className="space-y-2">
            <Label>Från</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Till</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Användare</Label>
            <Select value={userId} onValueChange={setUserId}>
              <SelectTrigger>
                <SelectValue placeholder="Alla" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alla</SelectItem>
                {users.map((user) => (
                  <SelectItem key={user.id} value={String(user.id)}>
                    {user.full_name || user.email || `User ${user.id}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Händelse</Label>
            <Select value={action} onValueChange={setAction}>
              <SelectTrigger>
                <SelectValue placeholder="Alla" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alla</SelectItem>
                {actionOptions.filter((opt) => opt !== "all").map((opt) => (
                  <SelectItem key={opt} value={opt}>
                    {ACTION_LABELS[opt] || opt}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Objekt</Label>
            <Select value={entityType} onValueChange={setEntityType}>
              <SelectTrigger>
                <SelectValue placeholder="Alla" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alla</SelectItem>
                {entityOptions.filter((opt) => opt !== "all").map((opt) => (
                  <SelectItem key={opt} value={opt}>
                    {ENTITY_LABELS[opt] || opt}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger>
                <SelectValue placeholder="Alla" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alla</SelectItem>
                <SelectItem value="success">Lyckad</SelectItem>
                <SelectItem value="fail">Misslyckad</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            <Button variant="outline" className="w-full" onClick={() => refetch()} disabled={isFetching}>
              <RefreshCcw className="mr-2 h-4 w-4" />
              Uppdatera
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Händelser</CardTitle>
          <CardDescription>
            Visar {logs.length} poster
          </CardDescription>
        </CardHeader>
        <CardContent>
          {logs.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              Inga loggar för vald period.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tid</TableHead>
                    <TableHead>Användare</TableHead>
                    <TableHead>Händelse</TableHead>
                    <TableHead>Objekt</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>IP</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => {
                    const metadata = formatMetadata(log.metadata);
                    return (
                      <TableRow key={log.id}>
                        <TableCell className="whitespace-nowrap">
                          {log.created_at
                            ? format(new Date(log.created_at), "d MMM yyyy HH:mm", { locale: sv })
                            : "-"}
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">{formatActor(log)}</div>
                          {log.actor_email && (
                            <div className="text-xs text-muted-foreground">{log.actor_email}</div>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">{ACTION_LABELS[log.action] || log.action}</div>
                          {metadata && (
                            <div className="text-xs text-muted-foreground break-all">{metadata}</div>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">
                            {ENTITY_LABELS[log.entity_type || ""] || log.entity_type || "-"}
                          </div>
                          {log.entity_id && (
                            <div className="text-xs text-muted-foreground">#{log.entity_id}</div>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant={log.success ? "default" : "destructive"}>
                            {log.success ? "Lyckad" : "Misslyckad"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">{log.ip || "-"}</div>
                          {log.user_agent && (
                            <div className="text-xs text-muted-foreground line-clamp-2">{log.user_agent}</div>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ActivityLog;
