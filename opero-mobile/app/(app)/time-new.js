import { useEffect, useMemo, useState } from "react";
import {
  ScrollView,
  View,
  Text,
  TextInput,
  Pressable,
  Modal,
  FlatList,
  StyleSheet,
  Switch,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  createTimeEntry,
  updateTimeEntry,
  addTimeEntryMaterial,
  updateTimeEntryMaterial,
  deleteTimeEntryMaterial,
  listMyTimeEntries,
  listTimeEntries,
} from "../../src/api/timeEntries";
import { listProjects } from "../../src/api/projects";
import { listJobRoles, listSubprojects, listMaterialTypes } from "../../src/api/meta";
import { emit } from "../../src/lib/bus";
import { spacing, radius, cardShadow, useTheme } from "../../src/ui/theme";

const allowanceOptions = [
  { label: "Ingen", value: "none" },
  { label: "Halv", value: "half" },
  { label: "Hel", value: "full" },
];

const formatLocalDate = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const parseLocalDate = (value) => {
  if (!value) return null;
  const normalized = value.includes("T") ? value : `${value}T00:00:00`;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
};

export default function TimeNew() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { colors } = useTheme();
  const editId = params?.id ? String(params.id) : null;
  const returnTo = params?.returnTo ? String(params.returnTo) : null;
  const isEdit = Boolean(editId);
  const [date, setDate] = useState(formatLocalDate(new Date()));
  const [start, setStart] = useState("07:00");
  const [end, setEnd] = useState("16:00");
  const [breakMin, setBreakMin] = useState("30");
  const [breakLocked, setBreakLocked] = useState(false);
  const [comment, setComment] = useState("");

  const [projects, setProjects] = useState([]);
  const [projectId, setProjectId] = useState("");
  const [subprojects, setSubprojects] = useState([]);
  const [subprojectId, setSubprojectId] = useState("");
  const [jobRoles, setJobRoles] = useState([]);
  const [jobRoleId, setJobRoleId] = useState("");

  const [allowanceType, setAllowanceType] = useState("none");
  const [travelTime, setTravelTime] = useState("");
  const [saveTravelComp, setSaveTravelComp] = useState(false);
  const [overtimeWeekday, setOvertimeWeekday] = useState("");
  const [overtimeWeekend, setOvertimeWeekend] = useState("");
  const [compTimeSaved, setCompTimeSaved] = useState("");
  const [compTimeTaken, setCompTimeTaken] = useState("");
  const [overtimeEnabled, setOvertimeEnabled] = useState(false);
  const [compEnabled, setCompEnabled] = useState(false);

  const [materialTypes, setMaterialTypes] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [originalMaterials, setOriginalMaterials] = useState([]);

  const [projectPickerOpen, setProjectPickerOpen] = useState(false);
  const [subprojectPickerOpen, setSubprojectPickerOpen] = useState(false);
  const [jobRolePickerOpen, setJobRolePickerOpen] = useState(false);
  const [allowancePickerOpen, setAllowancePickerOpen] = useState(false);
  const [materialPickerOpen, setMaterialPickerOpen] = useState(false);
  const [materialPickerIndex, setMaterialPickerIndex] = useState(null);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [timePickerOpen, setTimePickerOpen] = useState(false);
  const [timePickerTarget, setTimePickerTarget] = useState("start");
  const [viewMonth, setViewMonth] = useState(new Date().getMonth());
  const [viewYear, setViewYear] = useState(new Date().getFullYear());

  const [busy, setBusy] = useState(false);
  const [loadingEntry, setLoadingEntry] = useState(false);
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);

  useEffect(() => {
    const load = async () => {
      try {
        const [projData, roleData, materialData] = await Promise.all([
          listProjects(),
          listJobRoles(),
          listMaterialTypes(),
        ]);
        setProjects(Array.isArray(projData) ? projData : []);
        setJobRoles(Array.isArray(roleData) ? roleData : []);
        setMaterialTypes(Array.isArray(materialData) ? materialData : []);
      } catch {
        setProjects([]);
        setJobRoles([]);
        setMaterialTypes([]);
      }
    };
    load();
  }, []);

  useEffect(() => {
    const load = async () => {
      if (!projectId) {
        setSubprojects([]);
        setSubprojectId("");
        return;
      }
      try {
        const data = await listSubprojects(projectId);
        setSubprojects(Array.isArray(data) ? data : []);
      } catch {
        setSubprojects([]);
      }
    };
    load();
  }, [projectId]);

  useEffect(() => {
    if (!isEdit) return;
    const loadEntry = async () => {
      setLoadingEntry(true);
      setError(null);
      try {
        const data = await listTimeEntries({ include_materials: true, limit: 500 });
        const arr = Array.isArray(data) ? data : data?.items || [];
        const entry = arr.find((row) => String(row.id) === String(editId));
        if (!entry) {
          setError("Kunde inte hitta tidrapporten.");
          return;
        }
        const entryDate = entry.datum || entry.date || entry.work_date;
        if (entryDate) {
          setDate(entryDate);
          const entryObj = parseLocalDate(entryDate);
          if (entryObj) {
            setViewYear(entryObj.getFullYear());
            setViewMonth(entryObj.getMonth());
          }
        }
        setStart(entry.starttid || entry.start_time || entry.start || "07:00");
        setEnd(entry.sluttid || entry.end_time || entry.end || "16:00");
        setBreakMin(String(entry.break_minutes || 0));
        setComment(entry.comment || "");
        setProjectId(entry.project_id ? String(entry.project_id) : "");
        setSubprojectId(entry.subproject_id ? String(entry.subproject_id) : "");
        setJobRoleId(entry.job_role_id ? String(entry.job_role_id) : "");
        setAllowanceType(entry.traktamente_type || entry.allowance_type || "none");
        setTravelTime(String(entry.restid || entry.travel_time_hours || ""));
        setSaveTravelComp(Boolean(entry.save_travel_compensation));
        const overtimeWeekdayValue = String(entry.overtime_weekday_hours || "");
        const overtimeWeekendValue = String(entry.overtime_weekend_hours || "");
        const compSavedValue = String(entry.comp_time_saved_hours || "");
        const compTakenValue = String(entry.comp_time_taken_hours || "");
        setOvertimeWeekday(overtimeWeekdayValue);
        setOvertimeWeekend(overtimeWeekendValue);
        setCompTimeSaved(compSavedValue);
        setCompTimeTaken(compTakenValue);
        setOvertimeEnabled(
          Number(overtimeWeekdayValue || 0) > 0 || Number(overtimeWeekendValue || 0) > 0
        );
        setCompEnabled(
          Number(compSavedValue || 0) > 0 ||
            Number(compTakenValue || 0) > 0 ||
            Boolean(entry.save_comp_time)
        );
        const mats = Array.isArray(entry.materials) ? entry.materials : [];
        setMaterials(
          mats.map((m) => ({
            id: m.id ? String(m.id) : null,
            material_type_id: String(m.material_type_id || ""),
            quantity: String(m.quantity || ""),
            place: m.place || "",
          }))
        );
        setOriginalMaterials(
          mats.map((m) => ({
            id: m.id ? String(m.id) : null,
            material_type_id: String(m.material_type_id || ""),
            quantity: String(m.quantity || ""),
            place: m.place || "",
          }))
        );
      } catch (e) {
        setError(e.message || "Kunde inte hämta tidrapporten.");
      } finally {
        setLoadingEntry(false);
      }
    };
    loadEntry();
  }, [editId, isEdit]);

  useEffect(() => {
    const auto = getAutoBreak(date, start, end);
    if (auto.locked) {
      setBreakMin(String(auto.minutes));
      setBreakLocked(true);
    } else {
      setBreakLocked(false);
    }
  }, [date, start, end]);

  const selectedProject = projects.find((p) => String(p.id) === String(projectId));
  const selectedSubproject = subprojects.find((p) => String(p.id) === String(subprojectId));
  const selectedJobRole = jobRoles.find((r) => String(r.id) === String(jobRoleId));
  const selectedAllowance = allowanceOptions.find((o) => o.value === allowanceType);

  const timeOptions = useMemo(() => {
    const times = [];
    for (let h = 0; h < 24; h += 1) {
      for (let m = 0; m < 60; m += 15) {
        times.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
      }
    }
    return times;
  }, []);

  const openTimePicker = (target) => {
    setTimePickerTarget(target);
    setTimePickerOpen(true);
  };

  const pickTime = (value) => {
    if (timePickerTarget === "start") setStart(value);
    else setEnd(value);
    setTimePickerOpen(false);
  };

  const addMaterialRow = () => {
    setMaterials((prev) => [...prev, { id: null, material_type_id: "", quantity: "", place: "" }]);
  };

  const updateMaterial = (index, key, value) => {
    setMaterials((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [key]: value };
      return next;
    });
  };

  const removeMaterial = (index) => {
    setMaterials((prev) => prev.filter((_, i) => i !== index));
  };

  const openMaterialPicker = (index) => {
    setMaterialPickerIndex(index);
    setMaterialPickerOpen(true);
  };

  const calculateHours = () => {
    if (!start || !end) return null;
    const [sH, sM] = start.split(":").map(Number);
    const [eH, eM] = end.split(":").map(Number);
    if ([sH, sM, eH, eM].some((v) => Number.isNaN(v))) return null;
    const startDate = new Date();
    startDate.setHours(sH, sM, 0, 0);
    const endDate = new Date();
    endDate.setHours(eH, eM, 0, 0);
    if (endDate <= startDate) endDate.setDate(endDate.getDate() + 1);
    const totalMinutes = Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60));
    const effectiveBreak = Math.max(0, Math.min(Number(breakMin || 0), totalMinutes));
    const workMinutes = Math.max(0, totalMinutes - effectiveBreak);
    return workMinutes > 0 ? workMinutes / 60 : 0;
  };

  const syncMaterials = async (reportId) => {
    const originalById = new Map();
    originalMaterials.forEach((m) => {
      if (m.id) originalById.set(String(m.id), m);
    });

    const currentIds = new Set();
    for (const mat of materials) {
      if (mat.id) {
        currentIds.add(String(mat.id));
        const original = originalById.get(String(mat.id));
        if (!original) continue;
        const changed =
          String(original.material_type_id) !== String(mat.material_type_id) ||
          Number(original.quantity || 0) !== Number(mat.quantity || 0) ||
          String(original.place || "") !== String(mat.place || "");
        if (changed) {
          await updateTimeEntryMaterial(reportId, mat.id, {
            material_type_id: mat.material_type_id,
            quantity: Number(mat.quantity || 0),
            place: mat.place || null,
          });
        }
      } else if (mat.material_type_id && mat.quantity) {
        await addTimeEntryMaterial(reportId, {
          material_type_id: mat.material_type_id,
          quantity: Number(mat.quantity || 0),
          place: mat.place || null,
        });
      }
    }

    for (const original of originalMaterials) {
      if (!original.id) continue;
      if (!currentIds.has(String(original.id))) {
        await deleteTimeEntryMaterial(reportId, original.id);
      }
    }
  };

  const onSave = async () => {
    setBusy(true);
    setError(null);
    setInfo(null);
    if (!comment || comment.trim().length < 20) {
      setBusy(false);
      setError("Kommentar måste vara minst 20 tecken.");
      return;
    }
    try {
      const overtimeWeekdayValue = overtimeEnabled ? Number(overtimeWeekday || 0) : 0;
      const overtimeWeekendValue = overtimeEnabled ? Number(overtimeWeekend || 0) : 0;
      const compSavedValue = compEnabled ? Number(compTimeSaved || 0) : 0;
      const compTakenValue = compEnabled ? Number(compTimeTaken || 0) : 0;

      const payload = {
        date,
        start_time: start,
        end_time: end,
        break_minutes: Number(breakMin || 0),
        description: comment,
        project_id: projectId || null,
        subproject_id: subprojectId || null,
        job_role_id: jobRoleId || null,
        allowance_type: allowanceType === "none" ? null : allowanceType,
        allowance_amount: 0,
        travel_time_hours: Number(travelTime || 0),
        save_travel_compensation: saveTravelComp ? 1 : 0,
        overtime_weekday_hours: overtimeWeekdayValue,
        overtime_weekend_hours: overtimeWeekendValue,
        save_comp_time: compEnabled && compSavedValue > 0 ? 1 : 0,
        comp_time_saved_hours: compSavedValue,
        comp_time_taken_hours: compTakenValue,
      };

      if (isEdit && editId) {
        const hours = calculateHours();
        await updateTimeEntry(editId, { ...payload, hours });
        await syncMaterials(editId);
        emit("timeEntries:changed");
        router.replace(returnTo || "/(app)/time");
      } else {
        const created = await createTimeEntry(payload);
        const reportId = created?.id || created?.report_id;

        if (reportId && materials.length > 0) {
          for (const item of materials) {
            if (!item.material_type_id || !item.quantity) continue;
            await addTimeEntryMaterial(reportId, {
              material_type_id: item.material_type_id,
              quantity: Number(item.quantity || 0),
              place: item.place || null,
            });
          }
        }

        emit("timeEntries:changed");
        router.replace("/(app)/time");
      }
    } catch (e) {
      setError(e.message || "Kunde inte spara tid");
    } finally {
      setBusy(false);
    }
  };

  const copyLastReport = async () => {
    setError(null);
    setInfo(null);
    try {
      const data = await listMyTimeEntries({ limit: 1, include_materials: true });
      const arr = Array.isArray(data) ? data : data?.items || [];
      if (!arr.length) {
        setInfo("Ingen tidigare tidrapport hittades.");
        return;
      }
      const last = arr[0];
      setProjectId(last.project_id ? String(last.project_id) : "");
      setSubprojectId(last.subproject_id ? String(last.subproject_id) : "");
      setJobRoleId(last.job_role_id ? String(last.job_role_id) : "");
      setAllowanceType(last.allowance_type || last.traktamente_type || "none");
      setTravelTime(String(last.restid || last.travel_time_hours || ""));
      const overtimeWeekdayValue = String(last.overtime_weekday_hours || "");
      const overtimeWeekendValue = String(last.overtime_weekend_hours || "");
      const compSavedValue = String(last.comp_time_saved_hours || "");
      setOvertimeWeekday(overtimeWeekdayValue);
      setOvertimeWeekend(overtimeWeekendValue);
      setCompTimeSaved(compSavedValue);
      setCompTimeTaken("");
      setOvertimeEnabled(
        Number(overtimeWeekdayValue || 0) > 0 || Number(overtimeWeekendValue || 0) > 0
      );
      setCompEnabled(
        Number(compSavedValue || 0) > 0 || Boolean(last.save_comp_time)
      );
      const mats = Array.isArray(last.materials) ? last.materials : [];
      setMaterials(
        mats.map((m) => ({
          material_type_id: String(m.material_type_id || ""),
          quantity: String(m.quantity || ""),
          place: m.place || "",
        }))
      );
      setInfo("Föregående rapport kopierad (utan datum/tid/kommentar).");
    } catch (e) {
      setError(e.message || "Kunde inte kopiera tidigare rapport.");
    }
  };

  const calendarDays = useMemo(() => buildCalendarDays(viewYear, viewMonth), [viewYear, viewMonth]);

  const shiftMonth = (delta) => {
    const next = new Date(viewYear, viewMonth + delta, 1);
    setViewYear(next.getFullYear());
    setViewMonth(next.getMonth());
  };

  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
      <View style={styles.headerRow}>
        <Text style={styles.title}>{isEdit ? "Redigera tidrapport" : "Ny tidrapport"}</Text>
        {!isEdit ? (
          <Pressable style={styles.copyButton} onPress={copyLastReport}>
            <Text style={styles.copyButtonText}>Kopiera från föregående</Text>
          </Pressable>
        ) : null}
      </View>

      <View style={[styles.card, cardShadow]}>
        <Text style={styles.sectionTitle}>Grund</Text>
        <Text style={styles.label}>Datum</Text>
        <Pressable style={styles.select} onPress={() => setCalendarOpen(true)}>
          <Text style={styles.selectText}>{date}</Text>
        </Pressable>

        <View style={styles.row}>
          <View style={styles.field}>
            <Text style={styles.label}>Start</Text>
            <Pressable style={styles.select} onPress={() => openTimePicker("start")}>
              <Text style={styles.selectText}>{start}</Text>
            </Pressable>
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>Slut</Text>
            <Pressable style={styles.select} onPress={() => openTimePicker("end")}>
              <Text style={styles.selectText}>{end}</Text>
            </Pressable>
          </View>
        </View>

        <Text style={styles.label}>Rast (min)</Text>
        <TextInput
          value={breakMin}
          onChangeText={setBreakMin}
          keyboardType="number-pad"
          style={styles.input}
          editable={!breakLocked}
        />
        {breakLocked ? (
          <Text style={styles.muted}>Rast sätts automatiskt för detta pass.</Text>
        ) : null}
      </View>

      <View style={[styles.card, cardShadow]}>
        <Text style={styles.sectionTitle}>Projekt & roll</Text>
        <Text style={styles.label}>Projekt</Text>
        <Pressable style={styles.select} onPress={() => setProjectPickerOpen(true)}>
          <Text style={selectedProject ? styles.selectText : styles.selectPlaceholder}>
            {selectedProject ? selectedProject.name : "Välj projekt"}
          </Text>
        </Pressable>

        <Text style={styles.label}>Underprojekt</Text>
        <Pressable
          style={styles.select}
          onPress={() => setSubprojectPickerOpen(true)}
          disabled={!projectId}
        >
          <Text style={selectedSubproject ? styles.selectText : styles.selectPlaceholder}>
            {selectedSubproject ? selectedSubproject.name : projectId ? "Välj underprojekt" : "Välj projekt först"}
          </Text>
        </Pressable>

        <Text style={styles.label}>Yrkesroll</Text>
        <Pressable style={styles.select} onPress={() => setJobRolePickerOpen(true)}>
          <Text style={selectedJobRole ? styles.selectText : styles.selectPlaceholder}>
            {selectedJobRole ? selectedJobRole.name : "Välj yrkesroll"}
          </Text>
        </Pressable>
      </View>

      <View style={[styles.card, cardShadow]}>
        <Text style={styles.sectionTitle}>Traktamente & restid</Text>
        <Text style={styles.label}>Traktamente</Text>
        <Pressable style={styles.select} onPress={() => setAllowancePickerOpen(true)}>
          <Text style={styles.selectText}>{selectedAllowance?.label || "Ingen"}</Text>
        </Pressable>
        <Text style={styles.label}>Restid (h)</Text>
        <TextInput
          value={travelTime}
          onChangeText={setTravelTime}
          keyboardType="decimal-pad"
          style={styles.input}
        />
        <View style={styles.switchRow}>
          <Text style={styles.label}>Spara restid som komp</Text>
          <Switch value={saveTravelComp} onValueChange={setSaveTravelComp} />
        </View>
      </View>

      <View style={[styles.card, cardShadow]}>
        <Text style={styles.sectionTitle}>Övertid & komptid</Text>
        <View style={styles.switchRow}>
          <Text style={styles.label}>Aktivera övertid</Text>
          <Switch
            value={overtimeEnabled}
            onValueChange={(value) => {
              setOvertimeEnabled(value);
              if (!value) {
                setOvertimeWeekday("");
                setOvertimeWeekend("");
              }
            }}
          />
        </View>
        {overtimeEnabled ? (
          <>
            <Text style={styles.label}>ÖT vardag (h)</Text>
            <TextInput
              value={overtimeWeekday}
              onChangeText={setOvertimeWeekday}
              keyboardType="decimal-pad"
              style={styles.input}
            />
            <Text style={styles.label}>ÖT helg (h)</Text>
            <TextInput
              value={overtimeWeekend}
              onChangeText={setOvertimeWeekend}
              keyboardType="decimal-pad"
              style={styles.input}
            />
          </>
        ) : null}

        <View style={[styles.switchRow, { marginTop: spacing.sm }]}>
          <Text style={styles.label}>Aktivera komptid</Text>
          <Switch
            value={compEnabled}
            onValueChange={(value) => {
              setCompEnabled(value);
              if (!value) {
                setCompTimeSaved("");
                setCompTimeTaken("");
              }
            }}
          />
        </View>
        {compEnabled ? (
          <>
            <Text style={styles.label}>Komptimmar spara (h)</Text>
            <TextInput
              value={compTimeSaved}
              onChangeText={setCompTimeSaved}
              keyboardType="decimal-pad"
              style={styles.input}
            />
          </>
        ) : null}
      </View>

      <View style={[styles.card, cardShadow]}>
        <Text style={styles.sectionTitle}>Tillägg</Text>
        {materials.length === 0 ? <Text style={styles.muted}>Inga tillägg ännu.</Text> : null}
        {materials.map((item, index) => {
          const selectedMaterial = materialTypes.find(
            (mt) => String(mt.id) === String(item.material_type_id)
          );
          return (
            <View key={`mat-${index}`} style={styles.materialRow}>
              <Pressable style={styles.select} onPress={() => openMaterialPicker(index)}>
                <Text style={selectedMaterial ? styles.selectText : styles.selectPlaceholder}>
                  {selectedMaterial ? selectedMaterial.name : "Välj tillägg"}
                </Text>
              </Pressable>
              <TextInput
                value={String(item.quantity || "")}
                onChangeText={(value) => updateMaterial(index, "quantity", value)}
                keyboardType="decimal-pad"
                style={styles.input}
                placeholder="Antal"
              />
              <TextInput
                value={item.place || ""}
                onChangeText={(value) => updateMaterial(index, "place", value)}
                style={styles.input}
                placeholder="Plats/Notering"
              />
              <Pressable style={styles.removeButton} onPress={() => removeMaterial(index)}>
                <Text style={styles.removeText}>Ta bort</Text>
              </Pressable>
            </View>
          );
        })}
        <Pressable style={styles.outlineButton} onPress={addMaterialRow}>
          <Text style={styles.outlineText}>Lägg till tillägg</Text>
        </Pressable>
      </View>

      <View style={[styles.card, cardShadow]}>
        <Text style={styles.sectionTitle}>Kommentar</Text>
        <TextInput
          value={comment}
          onChangeText={setComment}
          style={[styles.input, styles.textarea]}
          multiline
        />
      </View>

      {loadingEntry ? <Text style={styles.muted}>Laddar tidrapport…</Text> : null}
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      {info ? <Text style={styles.infoText}>{info}</Text> : null}

      <Pressable disabled={busy} onPress={onSave} style={styles.primaryButton}>
        <Text style={styles.primaryButtonText}>
          {busy ? "Sparar…" : isEdit ? "Uppdatera" : "Spara"}
        </Text>
      </Pressable>

      <Modal visible={projectPickerOpen} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, cardShadow]}>
            <Text style={styles.modalTitle}>Välj projekt</Text>
            <FlatList
              data={projects}
              keyExtractor={(item) => String(item.id)}
              ItemSeparatorComponent={() => <View style={{ height: spacing.xs }} />}
              renderItem={({ item }) => (
                <Pressable
                  style={styles.modalItem}
                  onPress={() => {
                    setProjectId(String(item.id));
                    setSubprojectId("");
                    setProjectPickerOpen(false);
                  }}
                >
                  <Text style={styles.modalItemText}>{item.name}</Text>
                </Pressable>
              )}
              ListEmptyComponent={<Text style={styles.muted}>Inga projekt hittades.</Text>}
            />
            <Pressable style={styles.modalClose} onPress={() => setProjectPickerOpen(false)}>
              <Text style={styles.modalCloseText}>Stäng</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal visible={calendarOpen} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, cardShadow]}>
            <View style={styles.calendarHeader}>
              <Pressable onPress={() => shiftMonth(-1)}>
                <Text style={styles.calendarNav}>‹</Text>
              </Pressable>
              <Text style={styles.modalTitle}>{formatMonthYear(viewYear, viewMonth)}</Text>
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
                    item.value === date && styles.calendarDayActive,
                  ]}
                  disabled={item.isEmpty}
                  onPress={() => {
                    setDate(item.value);
                    setCalendarOpen(false);
                  }}
                >
                  <Text style={item.value === date ? styles.calendarDayTextActive : styles.calendarDayText}>
                    {item.label}
                  </Text>
                </Pressable>
              )}
            />
            <Pressable style={styles.modalClose} onPress={() => setCalendarOpen(false)}>
              <Text style={styles.modalCloseText}>Stäng</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal visible={timePickerOpen} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, cardShadow]}>
            <Text style={styles.modalTitle}>Välj tid</Text>
            <FlatList
              data={timeOptions}
              keyExtractor={(item) => item}
              ItemSeparatorComponent={() => <View style={{ height: spacing.xs }} />}
              renderItem={({ item }) => (
                <Pressable style={styles.modalItem} onPress={() => pickTime(item)}>
                  <Text style={styles.modalItemText}>{item}</Text>
                </Pressable>
              )}
            />
            <Pressable style={styles.modalClose} onPress={() => setTimePickerOpen(false)}>
              <Text style={styles.modalCloseText}>Stäng</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal visible={subprojectPickerOpen} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, cardShadow]}>
            <Text style={styles.modalTitle}>Välj underprojekt</Text>
            <FlatList
              data={subprojects}
              keyExtractor={(item) => String(item.id)}
              ItemSeparatorComponent={() => <View style={{ height: spacing.xs }} />}
              renderItem={({ item }) => (
                <Pressable
                  style={styles.modalItem}
                  onPress={() => {
                    setSubprojectId(String(item.id));
                    setSubprojectPickerOpen(false);
                  }}
                >
                  <Text style={styles.modalItemText}>{item.name}</Text>
                </Pressable>
              )}
              ListEmptyComponent={<Text style={styles.muted}>Inga underprojekt.</Text>}
            />
            <Pressable style={styles.modalClose} onPress={() => setSubprojectPickerOpen(false)}>
              <Text style={styles.modalCloseText}>Stäng</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal visible={jobRolePickerOpen} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, cardShadow]}>
            <Text style={styles.modalTitle}>Välj yrkesroll</Text>
            <FlatList
              data={jobRoles}
              keyExtractor={(item) => String(item.id)}
              ItemSeparatorComponent={() => <View style={{ height: spacing.xs }} />}
              renderItem={({ item }) => (
                <Pressable
                  style={styles.modalItem}
                  onPress={() => {
                    setJobRoleId(String(item.id));
                    setJobRolePickerOpen(false);
                  }}
                >
                  <Text style={styles.modalItemText}>{item.name}</Text>
                </Pressable>
              )}
              ListEmptyComponent={<Text style={styles.muted}>Inga yrkesroller.</Text>}
            />
            <Pressable style={styles.modalClose} onPress={() => setJobRolePickerOpen(false)}>
              <Text style={styles.modalCloseText}>Stäng</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal visible={allowancePickerOpen} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, cardShadow]}>
            <Text style={styles.modalTitle}>Välj traktamente</Text>
            {allowanceOptions.map((opt) => (
              <Pressable
                key={opt.value}
                style={styles.modalItem}
                onPress={() => {
                  setAllowanceType(opt.value);
                  setAllowancePickerOpen(false);
                }}
              >
                <Text style={styles.modalItemText}>{opt.label}</Text>
              </Pressable>
            ))}
            <Pressable style={styles.modalClose} onPress={() => setAllowancePickerOpen(false)}>
              <Text style={styles.modalCloseText}>Stäng</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal visible={materialPickerOpen} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, cardShadow]}>
            <Text style={styles.modalTitle}>Välj tillägg</Text>
            <FlatList
              data={materialTypes}
              keyExtractor={(item) => String(item.id)}
              ItemSeparatorComponent={() => <View style={{ height: spacing.xs }} />}
              renderItem={({ item }) => (
                <Pressable
                  style={styles.modalItem}
                  onPress={() => {
                    if (materialPickerIndex != null) {
                      updateMaterial(materialPickerIndex, "material_type_id", String(item.id));
                    }
                    setMaterialPickerIndex(null);
                    setMaterialPickerOpen(false);
                  }}
                >
                  <Text style={styles.modalItemText}>{item.name}</Text>
                </Pressable>
              )}
              ListEmptyComponent={<Text style={styles.muted}>Inga tillägg.</Text>}
            />
            <Pressable style={styles.modalClose} onPress={() => setMaterialPickerOpen(false)}>
              <Text style={styles.modalCloseText}>Stäng</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
      </ScrollView>
  );
}

const createStyles = (colors) => StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    padding: spacing.md,
    backgroundColor: colors.background,
    gap: spacing.md,
    paddingBottom: spacing.xl,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: spacing.sm,
  },
  title: {
    fontSize: 22,
    fontWeight: "800",
    color: colors.text,
  },
  copyButton: {
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  copyButtonText: {
    color: colors.primary,
    fontWeight: "700",
  },
  sectionTitle: {
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
  label: {
    fontWeight: "700",
    color: colors.text,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: 10,
    backgroundColor: colors.surface,
    color: colors.text,
  },
  textarea: {
    minHeight: 80,
    textAlignVertical: "top",
  },
  row: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  field: {
    flex: 1,
    gap: spacing.xs,
  },
  select: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: 12,
    backgroundColor: colors.surface,
  },
  selectText: {
    color: colors.text,
    fontWeight: "600",
  },
  selectPlaceholder: {
    color: colors.muted,
  },
  switchRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  materialRow: {
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  outlineButton: {
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 10,
    borderRadius: radius.md,
    alignItems: "center",
  },
  outlineText: {
    fontWeight: "700",
    color: colors.text,
  },
  removeButton: {
    alignItems: "flex-end",
  },
  removeText: {
    color: colors.danger,
    fontWeight: "700",
  },
  errorText: {
    color: colors.danger,
  },
  infoText: {
    color: colors.primary,
  },
  primaryButton: {
    paddingVertical: 14,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: "center",
  },
  primaryButtonText: {
    color: "#fff",
    fontWeight: "800",
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.lg,
  },
  modalCard: {
    width: "100%",
    maxHeight: "70%",
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.sm,
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
  calendarDayText: {
    color: colors.text,
    fontWeight: "600",
  },
  calendarDayTextActive: {
    color: "#fff",
    fontWeight: "700",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: colors.text,
  },
  modalItem: {
    padding: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalItemText: {
    fontWeight: "600",
    color: colors.text,
  },
  modalClose: {
    alignItems: "center",
    paddingVertical: 10,
  },
  modalCloseText: {
    color: colors.primary,
    fontWeight: "700",
  },
  muted: {
    color: colors.muted,
  },
});

const formatMonthYear = (year, month) => {
  const months = ["Jan", "Feb", "Mar", "Apr", "Maj", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dec"];
  return `${months[month]} ${year}`;
};

const buildCalendarDays = (year, month) => {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startWeekday = (firstDay.getDay() + 6) % 7; // Monday=0
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

const getAutoBreak = (dateStr, startTime, endTime) => {
  if (!dateStr) return { locked: false, minutes: 0 };
  const date = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(date.getTime())) return { locked: false, minutes: 0 };
  const day = date.getDay(); // 0=Sun, 6=Sat
  const isWeekend = day === 0 || day === 6;
  if (isWeekend) return { locked: true, minutes: 0 };
  if (startTime === "07:00" && endTime === "16:00") return { locked: true, minutes: 60 };
  return { locked: false, minutes: 0 };
};
