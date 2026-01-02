import { useEffect, useMemo, useState } from "react";
import { View, Text, Pressable, FlatList, StyleSheet } from "react-native";
import { useAuth } from "../../src/auth/AuthProvider";
import { listPlans } from "../../src/api/plans";
import { spacing, radius, cardShadow, useTheme } from "../../src/ui/theme";

export default function Planning() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin" || user?.role === "super_admin";
  const styles = useMemo(() => createStyles(colors), [colors]);
  const today = new Date();
  const [selectedDate, setSelectedDate] = useState(formatLocalDate(today));
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const calendarDays = useMemo(() => buildCalendarDays(viewYear, viewMonth), [viewYear, viewMonth]);
  const plansForSelectedDate = useMemo(
    () => plans.filter((plan) => isBetween(selectedDate, plan.start_date, plan.end_date)),
    [plans, selectedDate]
  );

  const shiftMonth = (delta) => {
    const next = new Date(viewYear, viewMonth + delta, 1);
    setViewYear(next.getFullYear());
    setViewMonth(next.getMonth());
  };

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await listPlans();
        setPlans(Array.isArray(data) ? data : []);
      } catch (e) {
        setError(e.message || "Kunde inte hämta planeringar.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Planering</Text>
      <View style={[styles.card, cardShadow]}>
        <View style={styles.calendarHeader}>
          <Pressable onPress={() => shiftMonth(-1)}>
            <Text style={styles.calendarNav}>‹</Text>
          </Pressable>
          <Text style={styles.sectionTitle}>{formatMonthYear(viewYear, viewMonth)}</Text>
          <Pressable onPress={() => shiftMonth(1)}>
            <Text style={styles.calendarNav}>›</Text>
          </Pressable>
        </View>

        <View style={styles.calendarWeekdays}>
          {[
            { label: "M", key: "mon" },
            { label: "T", key: "tue" },
            { label: "O", key: "wed" },
            { label: "T", key: "thu" },
            { label: "F", key: "fri" },
            { label: "L", key: "sat" },
            { label: "S", key: "sun" },
          ].map((d) => (
            <Text key={d.key} style={styles.calendarWeekday}>{d.label}</Text>
          ))}
        </View>

        <FlatList
          data={calendarDays}
          keyExtractor={(item, idx) => `${item.value}-${idx}`}
          numColumns={7}
          renderItem={({ item }) => (
            <Pressable
              style={[
                styles.calendarDay,
                item.isEmpty && styles.calendarDayEmpty,
                item.value === selectedDate && styles.calendarDayActive,
              ]}
              disabled={item.isEmpty}
              onPress={() => setSelectedDate(item.value)}
            >
              <Text style={item.value === selectedDate ? styles.calendarDayTextActive : styles.calendarDayText}>
                {item.label}
              </Text>
              {item.value && hasPlansForDay(plans, item.value) ? <View style={styles.calendarDot} /> : null}
            </Pressable>
          )}
        />
      </View>

      <View style={[styles.card, cardShadow]}>
        <Text style={styles.sectionTitle}>Planering för {selectedDate}</Text>
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        {loading ? <Text style={styles.muted}>Laddar planering…</Text> : null}
        {!loading && plansForSelectedDate.length === 0 ? (
          <Text style={styles.muted}>Ingen planering registrerad denna dag.</Text>
        ) : null}
        {plansForSelectedDate.map((plan) => (
          <View key={plan.id} style={styles.planCard}>
            <View style={styles.planHeader}>
              <Text style={styles.planTitle}>{plan.project || plan.project_name || "Projekt"}</Text>
              {plan.tentative ? <Text style={styles.planBadge}>Eventuellt</Text> : null}
            </View>
            {plan.subproject ? <Text style={styles.muted}>Underprojekt: {plan.subproject}</Text> : null}
            {isAdmin ? (
              <Text style={styles.muted}>{formatUser(plan)}</Text>
            ) : null}
            <Text style={styles.muted}>
              {plan.start_date} – {plan.end_date}
            </Text>
            {plan.destination ? <Text style={styles.muted}>Destination: {plan.destination}</Text> : null}
            {plan.work_address ? <Text style={styles.muted}>Adress: {plan.work_address}</Text> : null}
            {plan.first_shift_start_time ? (
              <Text style={styles.muted}>Starttid: {plan.first_shift_start_time}</Text>
            ) : null}
            {plan.contact_person ? (
              <Text style={styles.muted}>
                Kontakt: {plan.contact_person} {plan.contact_phone ? `(${plan.contact_phone})` : ""}
              </Text>
            ) : null}
            {plan.notes ? <Text style={styles.notes}>📝 {plan.notes}</Text> : null}
          </View>
        ))}
      </View>
    </View>
  );
}

const createStyles = (colors) => StyleSheet.create({
  container: {
    flex: 1,
    padding: spacing.md,
    backgroundColor: colors.background,
    gap: spacing.md,
  },
  title: {
    fontSize: 22,
    fontWeight: "800",
    color: colors.text,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sectionTitle: {
    fontWeight: "800",
    color: colors.text,
  },
  muted: {
    color: colors.muted,
  },
  calendarHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  calendarNav: {
    fontSize: 22,
    color: colors.primary,
    fontWeight: "700",
    paddingHorizontal: 8,
  },
  calendarWeekdays: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: spacing.xs,
  },
  calendarWeekday: {
    width: "14%",
    textAlign: "center",
    color: colors.muted,
    fontWeight: "700",
  },
  calendarDay: {
    width: "14%",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    borderRadius: radius.sm,
  },
  calendarDayEmpty: {
    opacity: 0,
  },
  calendarDayActive: {
    backgroundColor: colors.primary,
  },
  calendarDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.accent,
    marginTop: 4,
  },
  calendarDayText: {
    color: colors.text,
    fontWeight: "600",
  },
  calendarDayTextActive: {
    color: "#fff",
    fontWeight: "700",
  },
  planCard: {
    backgroundColor: colors.navAccent,
    borderRadius: radius.md,
    padding: spacing.sm,
    gap: spacing.xs,
  },
  planHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  planTitle: {
    fontWeight: "800",
    color: colors.text,
  },
  planBadge: {
    backgroundColor: "rgba(245, 158, 11, 0.2)",
    color: "#b45309",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.sm,
    fontWeight: "700",
  },
  notes: {
    color: colors.text,
  },
  errorText: {
    color: colors.danger,
  },
});

const formatMonthYear = (year, month) => {
  const months = ["Jan", "Feb", "Mar", "Apr", "Maj", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dec"];
  return `${months[month]} ${year}`;
};

function formatLocalDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

const buildCalendarDays = (year, month) => {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startWeekday = (firstDay.getDay() + 6) % 7;
  const daysInMonth = lastDay.getDate();
  const items = [];
  for (let i = 0; i < startWeekday; i += 1) {
    items.push({ label: "", value: "", isEmpty: true });
  }
  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = new Date(year, month, day);
    const value = formatLocalDate(date);
    items.push({ label: String(day), value, isEmpty: false });
  }
  return items;
};

const toDay = (value) => {
  if (!value) return null;
  const normalized = value.includes("T") ? value : `${value}T00:00:00`;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
};

const isBetween = (dateStr, startStr, endStr) => {
  const date = toDay(dateStr);
  const start = toDay(startStr);
  const end = toDay(endStr);
  if (!date || !start || !end) return false;
  return date >= start && date <= end;
};

const hasPlansForDay = (plans, dateStr) => {
  return plans.some((plan) => isBetween(dateStr, plan.start_date, plan.end_date));
};

const formatUser = (plan) => {
  const name = `${plan.first_name || ""} ${plan.last_name || ""}`.trim();
  return name || plan.email || "Användare";
};
