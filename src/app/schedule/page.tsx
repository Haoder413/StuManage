"use client";

import { useState, useEffect, useMemo } from "react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";

const DAY_NAMES = ["日", "一", "二", "三", "四", "五", "六"];
const MONTH_NAMES = ["1月", "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月"];
const HOURS = Array.from({ length: 14 }, (_, i) => i + 8);

function isSameDay(d1: Date, d2: Date) {
  return d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate();
}
function isToday(d: Date) { return isSameDay(d, new Date()); }
function getWeekStart(date: Date) {
  const d = new Date(date); const day = d.getDay();
  d.setDate(d.getDate() - (day === 0 ? 6 : day - 1)); d.setHours(0, 0, 0, 0);
  return d;
}
function formatTime(date: Date) {
  return date.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false });
}
function formatDateInput(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

interface Schedule {
  id: string; studentId: string | null; courseId: string | null; type: string;
  dayOfWeek: number | null; startTime: string | null; endTime: string | null;
  date: string | null; startDate: string | null; endDate: string | null; notes: string | null;
  student: { id: string; name: string; grade: string | null } | null;
  course: {
    id: string;
    name: string;
    type: string;
    studentCourses: { student: { id: string; name: string; grade: string | null } }[];
  } | null;
  attendance: {
    id: string; studentId: string; status: string; date: string;
    lessonContent: string | null; lessonFeedback: string | null;
    contentTags: string | null; feedbackTags: string | null; weakPointTags: string | null;
    lessonVideo: LessonVideo | null;
  }[];
}
interface LessonVideo {
  id: string;
  title: string | null;
  fileName: string;
  mimeType: string;
  size: number;
  createdAt: string;
}
interface Student { id: string; name: string; grade: string | null; }
interface LessonTag { id: string; name: string; type: "content" | "feedback"; }
interface WeakPointTag { id: string; name: string; category: string | null; }
interface WeakPoint { id: string; description: string; }
interface PendingAttendance {
  scheduleId: string;
  studentId: string;
  studentName: string;
  status: "present" | "makeup";
}
interface CalendarDay { day: number; currentMonth: boolean; date: Date; }

function parseTags(value: string | null | undefined) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((tag) => typeof tag === "string") : [];
  } catch {
    return [];
  }
}

function startOfLocalDay(date: Date) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function isScheduleInDateRange(schedule: Schedule, date: Date) {
  const target = startOfLocalDay(date);
  if (schedule.startDate && target < startOfLocalDay(new Date(schedule.startDate))) return false;
  if (schedule.endDate && target > startOfLocalDay(new Date(schedule.endDate))) return false;
  return true;
}

function mergeWeakPointTags(tags: WeakPointTag[], weakPoints: WeakPoint[]) {
  const names = new Set(tags.map((tag) => tag.name));
  const merged = [...tags];
  weakPoints.forEach((point) => {
    const name = point.description.trim();
    if (!name || names.has(name)) return;
    names.add(name);
    merged.push({ id: `weak-point-${point.id}`, name, category: "已有薄弱点" });
  });
  return merged;
}

function displayName(schedule: Schedule) {
  return schedule.course?.type === "fixed"
    ? schedule.course.name
    : schedule.student?.name || "未知学生";
}

function formatFileSize(size: number) {
  if (!Number.isFinite(size) || size <= 0) return "0 MB";
  const mb = size / 1024 / 1024;
  if (mb >= 1) return `${mb.toFixed(1)} MB`;
  return `${Math.max(1, Math.round(size / 1024))} KB`;
}

function TagChips({
  type,
  tags,
  selected,
  onToggle,
  onCreate,
  onRename,
  onDelete,
}: {
  type: "content" | "feedback";
  tags: LessonTag[];
  selected: string[];
  onToggle: (name: string) => void;
  onCreate: (name: string, type: "content" | "feedback") => void;
  onRename: (tag: LessonTag) => void;
  onDelete: (tag: LessonTag) => void;
}) {
  const [keyword, setKeyword] = useState("");
  const typeTags = tags.filter((tag) => tag.type === type);
  const filteredTags = keyword.trim()
    ? typeTags.filter((tag) => tag.name.includes(keyword.trim()))
    : typeTags;

  function createTag() {
    const name = prompt("新增标签名称")?.trim();
    if (!name) return;
    onCreate(name, type);
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Button type="button" size="sm" variant="outline" className="shrink-0" onClick={createTag}>新增标签</Button>
        <Input
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder="搜索标签"
          className="h-9 text-xs"
        />
      </div>
      <div className="flex flex-wrap gap-1.5">
        {filteredTags.map((tag) => {
          const active = selected.includes(tag.name);
          return (
            <span key={tag.id} className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[11px] ${active ? "border-blue-200 bg-blue-50 text-blue-700" : "border-gray-200 text-gray-500"}`}>
              <button type="button" onClick={() => onToggle(tag.name)}>{tag.name}</button>
              <button type="button" className="text-gray-300 hover:text-blue-500" onClick={() => onRename(tag)}>✎</button>
              <button type="button" className="text-gray-300 hover:text-red-500" onClick={() => onDelete(tag)}>×</button>
            </span>
          );
        })}
      </div>
    </div>
  );
}

function WeakPointTagChips({
  tags,
  selected,
  onToggle,
  onCreate,
  onRename,
  onDelete,
}: {
  tags: WeakPointTag[];
  selected: string[];
  onToggle: (name: string) => void;
  onCreate: (name: string) => void;
  onRename: (tag: WeakPointTag) => void;
  onDelete: (tag: WeakPointTag) => void;
}) {
  const [keyword, setKeyword] = useState("");
  const filteredTags = keyword.trim()
    ? tags.filter((tag) => tag.name.includes(keyword.trim()))
    : tags;

  function createTag() {
    const name = prompt("新增薄弱点标签名称")?.trim();
    if (!name) return;
    onCreate(name);
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Button type="button" size="sm" variant="outline" className="shrink-0" onClick={createTag}>新增标签</Button>
        <Input
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder="搜索标签"
          className="h-9 text-xs"
        />
      </div>
      <div className="flex flex-wrap gap-1.5">
        {filteredTags.map((tag) => {
          const active = selected.includes(tag.name);
          const generatedFromWeakPoint = tag.id.startsWith("weak-point-");
          return (
            <span key={tag.id} className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[11px] ${active ? "border-blue-200 bg-blue-50 text-blue-700" : "border-gray-200 text-gray-500"}`}>
              <button type="button" onClick={() => onToggle(tag.name)}>
                {tag.name}{tag.category && <span className="ml-1 text-gray-300">{tag.category}</span>}
              </button>
              {!generatedFromWeakPoint && (
                <>
                  <button type="button" className="text-gray-300 hover:text-blue-500" onClick={() => onRename(tag)}>✎</button>
                  <button type="button" className="text-gray-300 hover:text-red-500" onClick={() => onDelete(tag)}>×</button>
                </>
              )}
            </span>
          );
        })}
      </div>
    </div>
  );
}

export default function SchedulePage() {
  const today = new Date();
  const [currentMonth, setCurrentMonth] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [lessonTags, setLessonTags] = useState<LessonTag[]>([]);
  const [weakPointTags, setWeakPointTags] = useState<WeakPointTag[]>([]);
  const [reviewWeakPointTags, setReviewWeakPointTags] = useState<WeakPointTag[]>([]);
  const [selectedDate, setSelectedDate] = useState(today);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"month" | "week">("month");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form fields
  const [formStudentId, setFormStudentId] = useState("");
  const [formType, setFormType] = useState("fixed");
  const [formDay, setFormDay] = useState("1");
  const [formDate, setFormDate] = useState(formatDateInput(today));
  const [formStart, setFormStart] = useState("09:00");
  const [formEnd, setFormEnd] = useState("10:00");
  const [formNotes, setFormNotes] = useState("");
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [pendingAttendance, setPendingAttendance] = useState<PendingAttendance | null>(null);
  const [courseAttendanceStudentId, setCourseAttendanceStudentId] = useState<string | null>(null);
  const [selectedWeakPointTags, setSelectedWeakPointTags] = useState<string[]>([]);
  const [selectedContentTags, setSelectedContentTags] = useState<string[]>([]);
  const [selectedFeedbackTags, setSelectedFeedbackTags] = useState<string[]>([]);
  const [reviewLessonVideo, setReviewLessonVideo] = useState<LessonVideo | null>(null);
  const [reviewAttendanceId, setReviewAttendanceId] = useState<string | null>(null);
  const [reviewVideoFile, setReviewVideoFile] = useState<File | null>(null);
  const [reviewVideoError, setReviewVideoError] = useState("");
  const [savingReview, setSavingReview] = useState(false);
  const [editingAttendanceKey, setEditingAttendanceKey] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/schedules").then(r => r.json()),
      fetch("/api/students").then(r => r.json()),
      fetch("/api/lesson-tags").then(r => r.json()),
      fetch("/api/weak-point-tags").then(r => r.json()),
    ]).then(([scheds, studs, tags, weakTags]) => {
      setSchedules(scheds); setStudents(studs); setLoading(false);
      setLessonTags(tags);
      setWeakPointTags(weakTags);
      setReviewWeakPointTags(weakTags);
    });
  }, []);

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const startDayOfWeek = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();

  const calendarDays: CalendarDay[] = useMemo(() => {
    const d: CalendarDay[] = [];
    for (let i = startDayOfWeek - 1; i >= 0; i--) d.push({ day: daysInPrevMonth - i, currentMonth: false, date: new Date(year, month - 1, daysInPrevMonth - i) });
    for (let i = 1; i <= daysInMonth; i++) d.push({ day: i, currentMonth: true, date: new Date(year, month, i) });
    const rem = 42 - d.length;
    for (let i = 1; i <= rem; i++) d.push({ day: i, currentMonth: false, date: new Date(year, month + 1, i) });
    return d;
  }, [currentMonth, year, month, daysInMonth, daysInPrevMonth, startDayOfWeek]);

  const weekStart = useMemo(() => getWeekStart(selectedDate), [selectedDate]);
  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => { const d = new Date(weekStart); d.setDate(d.getDate() + i); return d; }), [weekStart]);

  function getSchedulesForDate(date: Date) {
    const dow = date.getDay();
    return schedules.filter(s => {
      if (s.type === "fixed" && s.dayOfWeek === dow) return isScheduleInDateRange(s, date);
      if (s.type === "flexible" && s.date) return isSameDay(new Date(s.date), date);
      return false;
    });
  }
  function getSchedulesForDayAtHour(date: Date, hour: number) {
    return getSchedulesForDate(date).filter(s => s.startTime && parseInt(s.startTime.split(":")[0]) === hour);
  }

  function prev() {
    if (viewMode === "month") setCurrentMonth(new Date(year, month - 1, 1));
    else { const d = new Date(weekStart); d.setDate(d.getDate() - 7); setSelectedDate(d); setCurrentMonth(new Date(d.getFullYear(), d.getMonth(), 1)); }
  }
  function next() {
    if (viewMode === "month") setCurrentMonth(new Date(year, month + 1, 1));
    else { const d = new Date(weekStart); d.setDate(d.getDate() + 7); setSelectedDate(d); setCurrentMonth(new Date(d.getFullYear(), d.getMonth(), 1)); }
  }
  function goToToday() { setCurrentMonth(new Date(today.getFullYear(), today.getMonth(), 1)); setSelectedDate(today); }

  function openAddForm() {
    setEditingId(null); setFormStudentId(students[0]?.id || "");
    setFormType("fixed"); setFormDay("1");
    setFormDate(formatDateInput(selectedDate));
    setFormStart("09:00"); setFormEnd("10:00"); setFormNotes("");
    setShowForm(true);
  }
  function openEditForm(s: Schedule) {
    setEditingId(s.id); setFormStudentId(s.studentId || "");
    setFormType(s.type); setFormDay(String(s.dayOfWeek ?? 1));
    setFormDate(s.date ? formatDateInput(new Date(s.date)) : formatDateInput(selectedDate));
    setFormStart(s.startTime || "09:00"); setFormEnd(s.endTime || "10:00");
    setFormNotes(s.notes || ""); setShowForm(true);
  }

  async function handleSave() {
    const body = editingId
      ? { id: editingId, studentId: formStudentId, type: formType, dayOfWeek: formType === "fixed" ? parseInt(formDay) : null, startTime: formStart, endTime: formEnd, date: formType === "flexible" ? formDate : null, notes: formNotes }
      : { studentId: formStudentId, type: formType, dayOfWeek: formType === "fixed" ? parseInt(formDay) : null, startTime: formStart, endTime: formEnd, date: formType === "flexible" ? formDate : null, notes: formNotes };

    const res = await fetch("/api/schedules", {
      method: editingId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      const updated = await res.json();
      setSchedules(prev => editingId ? prev.map(s => s.id === editingId ? updated : s) : [...prev, updated]);
      setShowForm(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("确定删除这个排课？")) return;
    const res = await fetch(`/api/schedules?id=${id}`, { method: "DELETE" });
    if (res.ok) setSchedules(prev => prev.filter(s => s.id !== id));
  }

  async function handleAttendance(
    scheduleId: string,
    studentId: string,
    date: Date,
    status: string,
    review?: { lessonContent: string; lessonFeedback: string; contentTags: string[]; feedbackTags: string[]; weakPointTags: string[] }
  ) {
    const res = await fetch("/api/attendance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scheduleId, studentId, date: date.toISOString(), status, notes: null, ...review }),
    });
    if (res.ok) {
      const att = await res.json();
      setSchedules(prev => prev.map(s => {
        if (s.id !== scheduleId) return s;
        const otherAttendance = s.attendance.filter(a =>
          a.id !== att.id && !(a.studentId === att.studentId && isSameDay(new Date(a.date), date))
        );
        return { ...s, attendance: [...otherAttendance, att] };
      }));
      setEditingAttendanceKey(null);
      return att;
    }
    return null;
  }

  async function loadStudentWeakPointTags(studentId: string) {
    try {
      const res = await fetch(`/api/weak-points?studentId=${studentId}`);
      if (!res.ok) return;
      const studentWeakPoints: WeakPoint[] = await res.json();
      setReviewWeakPointTags(mergeWeakPointTags(weakPointTags, studentWeakPoints));
    } catch {}
  }

  async function openAttendanceReview(
    schedule: Schedule,
    status: "present" | "makeup",
    existing?: Schedule["attendance"][number],
    student?: { id: string; name: string }
  ) {
    const targetStudentId = student?.id || schedule.studentId || "";
    const targetStudentName = student?.name || schedule.student?.name || "未知学生";
    setCourseAttendanceStudentId(schedule.courseId ? targetStudentId : null);
    setPendingAttendance({
      scheduleId: schedule.id,
      studentId: targetStudentId,
      studentName: targetStudentName,
      status,
    });
    setSelectedWeakPointTags(parseTags(existing?.weakPointTags));
    setSelectedContentTags(parseTags(existing?.contentTags));
    setSelectedFeedbackTags(parseTags(existing?.feedbackTags));
    setReviewLessonVideo(existing?.lessonVideo || null);
    setReviewAttendanceId(existing?.id || null);
    setReviewVideoFile(null);
    setReviewVideoError("");
    setReviewWeakPointTags(weakPointTags);
    setShowReviewForm(true);
    await loadStudentWeakPointTags(targetStudentId);
  }

  async function submitAttendanceReview() {
    if (!pendingAttendance) return;
    setSavingReview(true);
    setReviewVideoError("");
    const savedAttendance = await handleAttendance(
      pendingAttendance.scheduleId,
      pendingAttendance.studentId,
      selectedDate,
      pendingAttendance.status,
      {
        lessonContent: "",
        lessonFeedback: "",
        contentTags: selectedContentTags,
        feedbackTags: selectedFeedbackTags,
        weakPointTags: selectedWeakPointTags,
      }
    );
    if (!savedAttendance) {
      setSavingReview(false);
      setReviewVideoError("考勤保存失败，请稍后重试");
      return;
    }
    if (reviewVideoFile) {
      const formData = new FormData();
      formData.append("file", reviewVideoFile);
      formData.append("title", reviewVideoFile.name);
      const videoResponse = await fetch(`/api/attendance/${savedAttendance.id}/video`, {
        method: "POST",
        body: formData,
      });
      if (!videoResponse.ok) {
        setSavingReview(false);
        setReviewVideoError(videoResponse.status === 413
          ? "视频上传失败：服务器上传上限不足，请先调整 Nginx 上传大小后重试"
          : "视频上传失败，请确认格式和大小后重试");
        return;
      }
      const lessonVideo = await videoResponse.json();
      setSchedules(prev => prev.map(s => {
        if (s.id !== pendingAttendance.scheduleId) return s;
        return {
          ...s,
          attendance: s.attendance.map(a => a.id === savedAttendance.id ? { ...a, lessonVideo } : a),
        };
      }));
    }
    const weakPointDescriptions = Array.from(new Set(selectedWeakPointTags.map(item => item.trim()).filter(Boolean)));
    if (weakPointDescriptions.length > 0) {
      await Promise.all(weakPointDescriptions.map(description =>
        fetch("/api/weak-points", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ studentId: pendingAttendance.studentId, description }),
        })
      ));
    }
    setShowReviewForm(false);
    setPendingAttendance(null);
    setCourseAttendanceStudentId(null);
    setReviewLessonVideo(null);
    setReviewAttendanceId(null);
    setReviewVideoFile(null);
    setSavingReview(false);
  }

  async function deleteReviewLessonVideo() {
    if (!reviewLessonVideo || !reviewAttendanceId || !pendingAttendance) return;
    if (!confirm("确定删除这节课的课堂视频？")) return;
    const response = await fetch(`/api/attendance/${reviewAttendanceId}/video`, { method: "DELETE" });
    if (!response.ok) return;
    setReviewLessonVideo(null);
    setReviewVideoFile(null);
    setSchedules(prev => prev.map(s => s.id === pendingAttendance.scheduleId ? {
      ...s,
      attendance: s.attendance.map(a => a.lessonVideo?.id === reviewLessonVideo.id ? { ...a, lessonVideo: null } : a),
    } : s));
  }

  function attendanceKey(scheduleId: string, studentId: string) {
    return `${scheduleId}:${studentId}`;
  }

  function attendanceLabel(status: string) {
    if (status === "present") return "✅ 已记录：出勤";
    if (status === "absent") return "❌ 已记录：请假";
    if (status === "makeup") return "🔄 已记录：补课";
    return "已记录";
  }

  function renderAttendanceControls(
    schedule: Schedule,
    student: { id: string; name: string; grade: string | null },
    existing?: Schedule["attendance"][number],
    compact = false
  ) {
    const key = attendanceKey(schedule.id, student.id);
    const editing = editingAttendanceKey === key || !existing;
    const statuses: Array<"present" | "absent" | "makeup"> = ["present", "absent", "makeup"];
    const labels: Record<(typeof statuses)[number], string> = compact
      ? { present: "出勤", absent: "请假", makeup: "补课" }
      : { present: "✅ 出勤", absent: "❌ 请假", makeup: "🔄 补课" };

    if (!editing && existing) {
      return (
        <div className={`mt-1 flex items-center ${compact ? "justify-between" : ""} gap-1.5`}>
          <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-500">
            {attendanceLabel(existing.status)}
          </span>
          <button
            type="button"
            className="rounded px-1.5 py-0.5 text-[10px] font-medium text-blue-500 hover:bg-blue-50"
            onClick={() => setEditingAttendanceKey(key)}
          >
            修改
          </button>
        </div>
      );
    }

    return (
      <div className="mt-1 flex flex-wrap gap-1.5">
        {statuses.map((status) => {
          const active = existing?.status === status;
          return (
            <button
              key={status}
              type="button"
              onClick={() => status === "absent"
                ? handleAttendance(schedule.id, student.id, selectedDate, status)
                : openAttendanceReview(schedule, status, existing, student)}
              className={`rounded px-1.5 py-0.5 text-[10px] font-medium transition-colors ${active ? "bg-blue-100 text-blue-600" : "text-gray-400 hover:bg-gray-50 hover:text-gray-600"}`}
            >
              {labels[status]}
            </button>
          );
        })}
        {existing && (
          <button
            type="button"
            className="rounded px-1.5 py-0.5 text-[10px] font-medium text-gray-400 hover:bg-gray-50 hover:text-gray-600"
            onClick={() => setEditingAttendanceKey(null)}
          >
            取消
          </button>
        )}
      </div>
    );
  }

  function toggleTag(name: string, kind: "content" | "feedback") {
    const setter = kind === "content" ? setSelectedContentTags : setSelectedFeedbackTags;
    setter(prev => prev.includes(name) ? prev.filter(tag => tag !== name) : [...prev, name]);
  }

  function toggleWeakPointTag(name: string) {
    setSelectedWeakPointTags(prev => prev.includes(name) ? prev.filter(tag => tag !== name) : [...prev, name]);
  }

  async function createLessonTag(name: string, type: "content" | "feedback") {
    if (lessonTags.some(tag => tag.type === type && tag.name === name)) {
      toggleTag(name, type);
      return;
    }
    const res = await fetch("/api/lesson-tags", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, type }),
    });
    if (res.ok) {
      const tag = await res.json();
      setLessonTags(prev => [...prev, tag]);
      toggleTag(tag.name, type);
    }
  }

  async function renameLessonTag(tag: LessonTag) {
    const name = prompt("修改标签名称", tag.name)?.trim();
    if (!name || name === tag.name) return;
    const res = await fetch("/api/lesson-tags", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: tag.id, name, type: tag.type }),
    });
    if (res.ok) {
      const updated = await res.json();
      setLessonTags(prev => prev.map(item => item.id === updated.id ? updated : item));
      const replaceSelected = (items: string[]) => items.map(item => item === tag.name ? updated.name : item);
      if (tag.type === "content") setSelectedContentTags(replaceSelected);
      else setSelectedFeedbackTags(replaceSelected);
    }
  }

  async function deleteLessonTag(tag: LessonTag) {
    if (!confirm(`删除标签「${tag.name}」？历史记录中的文字标签会保留。`)) return;
    const res = await fetch(`/api/lesson-tags?id=${tag.id}`, { method: "DELETE" });
    if (res.ok) {
      setLessonTags(prev => prev.filter(item => item.id !== tag.id));
      if (tag.type === "content") setSelectedContentTags(prev => prev.filter(item => item !== tag.name));
      else setSelectedFeedbackTags(prev => prev.filter(item => item !== tag.name));
    }
  }

  async function createWeakPointTag(name: string) {
    if (weakPointTags.some(tag => tag.name === name)) {
      toggleWeakPointTag(name);
      return;
    }
    const res = await fetch("/api/weak-point-tags", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, category: null }),
    });
    if (res.ok) {
      const tag = await res.json();
      setWeakPointTags(prev => [...prev, tag]);
      setReviewWeakPointTags(prev => [...prev, tag]);
      setSelectedWeakPointTags(prev => [...prev, tag.name]);
    }
  }

  async function renameWeakPointTag(tag: WeakPointTag) {
    const name = prompt("修改标签名称", tag.name)?.trim();
    if (!name || name === tag.name) return;
    const res = await fetch("/api/weak-point-tags", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: tag.id, name, category: tag.category }),
    });
    if (res.ok) {
      const updated = await res.json();
      setWeakPointTags(prev => prev.map(item => item.id === updated.id ? updated : item));
      setReviewWeakPointTags(prev => prev.map(item => item.id === updated.id ? updated : item));
      setSelectedWeakPointTags(prev => prev.map(item => item === tag.name ? updated.name : item));
    }
  }

  async function deleteWeakPointTag(tag: WeakPointTag) {
    if (!confirm(`删除标签「${tag.name}」？已创建的薄弱点记录不会被删除。`)) return;
    const res = await fetch(`/api/weak-point-tags?id=${tag.id}`, { method: "DELETE" });
    if (res.ok) {
      setWeakPointTags(prev => prev.filter(item => item.id !== tag.id));
      setReviewWeakPointTags(prev => prev.filter(item => item.id !== tag.id));
      setSelectedWeakPointTags(prev => prev.filter(item => item !== tag.name));
    }
  }

  const selectedSchedules = getSchedulesForDate(selectedDate);
  const viewTitle = viewMode === "month" ? `${year}年 ${MONTH_NAMES[month]}` : `${weekDays[0].getDate()}日 - ${weekDays[6].getDate()}日 ${MONTH_NAMES[weekDays[0].getMonth()]}`;
  const dayNames = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];

  return (
    <div>
      <PageHeader title="排课考勤" description="管理课程安排和出勤记录"
        action={<Button size="sm" onClick={openAddForm}>+ 新增排课</Button>}
      />

      <div className="flex gap-6">
        {/* Calendar */}
        <div className="glass-card flex-1 rounded-xl p-5">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <button onClick={goToToday} className="text-xs font-semibold text-gray-500 hover:text-gray-800 px-3 py-1.5 rounded-lg hover:bg-gray-100/50 border border-gray-200/50">今天</button>
              <div className="flex gap-0.5">
                <button onClick={prev} className="p-1.5 rounded-lg hover:bg-gray-100/50 text-gray-400 text-sm">◀</button>
                <button onClick={next} className="p-1.5 rounded-lg hover:bg-gray-100/50 text-gray-400 text-sm">▶</button>
              </div>
              <h2 className="text-base font-semibold text-gray-900">{viewTitle}</h2>
            </div>
            <div className="flex bg-gray-100 rounded-lg p-0.5 gap-0.5">
              <button onClick={() => setViewMode("month")} className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${viewMode === "month" ? "bg-white text-gray-800 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>月</button>
              <button onClick={() => setViewMode("week")} className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${viewMode === "week" ? "bg-white text-gray-800 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>周</button>
            </div>
          </div>

          {viewMode === "month" ? (
            <>
              <div className="grid grid-cols-7 mb-1">
                {DAY_NAMES.map((name, i) => <div key={i} className="text-center text-[11px] font-semibold text-gray-400 py-1.5 tracking-wide">{name}</div>)}
              </div>
              <div className="grid grid-cols-7 border-t border-l border-gray-100">
                {calendarDays.map((day, i) => {
                  const ds = getSchedulesForDate(day.date); const sel = isSameDay(day.date, selectedDate); const tf = isToday(day.date);
                  return (
                    <button key={i} onClick={() => setSelectedDate(day.date)}
                      className={`relative min-h-[68px] p-1.5 border-b border-r border-gray-100 text-left transition-colors ${!day.currentMonth ? 'text-gray-300' : 'text-gray-700'} ${sel ? 'bg-blue-50/60' : 'hover:bg-gray-50/50'}`}>
                      <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs mb-0.5 ${tf ? 'bg-blue-500 text-white font-bold' : ''} ${sel && !tf ? 'bg-gray-200 font-semibold' : 'font-medium'}`}>{day.day}</span>
                      {ds.length > 0 && <div className="flex flex-wrap gap-0.5 px-0.5">{ds.slice(0, 3).map((_, idx) => <div key={idx} className="w-1 h-1 rounded-full bg-blue-400" />)}{ds.length > 3 && <span className="text-[9px] text-blue-500 font-semibold ml-0.5">+{ds.length - 3}</span>}</div>}
                    </button>
                  );
                })}
              </div>
            </>
          ) : (
            <div className="overflow-auto max-h-[520px]">
              <div className="grid grid-cols-[50px_repeat(7,1fr)] sticky top-0 z-10 bg-white/90 backdrop-blur">
                <div className="text-[10px] text-gray-300 text-right pr-2 py-1" />
                {weekDays.map((d, i) => { const sel = isSameDay(d, selectedDate); const tf = isToday(d);
                  return <button key={i} onClick={() => setSelectedDate(d)} className={`text-center py-1.5 rounded-t-lg ${sel ? 'bg-blue-50/60' : ''}`}>
                    <div className="text-[10px] font-semibold text-gray-400">{DAY_NAMES[i]}</div>
                    <div className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-sm mt-0.5 ${tf ? 'bg-blue-500 text-white font-bold' : ''} ${sel && !tf ? 'bg-gray-200 font-semibold' : ''}`}>{d.getDate()}</div>
                  </button>;
                })}
              </div>
              <div className="grid grid-cols-[50px_repeat(7,1fr)] gap-px bg-gray-50">
                {HOURS.map(hour => (
                  <div key={hour} className="contents">
                    <div className="text-[10px] text-gray-400 text-right pr-2 py-3 sticky left-0 bg-white">{hour}:00</div>
                    {weekDays.map((d, di) => {
                      const ds = getSchedulesForDayAtHour(d, hour); const sel = isSameDay(d, selectedDate);
                      return <button key={di} onClick={() => setSelectedDate(d)} className={`min-h-[36px] border-b border-gray-100 px-1 py-0.5 text-left hover:bg-gray-50/50 ${sel ? 'bg-blue-50/30' : ''}`}>
                        {ds.map((s, si) => <div key={si} className="bg-blue-100 text-blue-700 text-[10px] font-medium rounded px-1 py-0.5 mb-0.5 truncate leading-tight">{displayName(s)}{s.startTime && <span className="text-blue-400 ml-0.5">{s.startTime}</span>}</div>)}
                      </button>;
                    })}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Detail panel */}
        <div className="glass-card w-80 rounded-xl p-5 shrink-0 self-start">
          <div className="flex items-center justify-between mb-3">
            <div className="text-center flex-1">
              <div className="text-3xl font-bold text-gray-900">{selectedDate.getDate()}</div>
              <div className="text-xs text-gray-400 mt-1 tracking-wide">{year}年{selectedDate.getMonth() + 1}月 · {dayNames[selectedDate.getDay()]}</div>
            </div>
            <Button size="sm" variant="outline" className="shrink-0" onClick={openAddForm}>+</Button>
          </div>

          <div className="border-t border-gray-100 pt-4">
            {loading ? <p className="text-sm text-gray-400 text-center py-8">加载中...</p>
            : selectedSchedules.length === 0 ? <p className="text-sm text-gray-400 text-center py-8">暂无课程安排</p>
            : <div className="space-y-2">
                {selectedSchedules.map((s, idx) => {
                  const todayAtt = s.studentId ? s.attendance.find(a => a.studentId === s.studentId && isSameDay(new Date(a.date), selectedDate)) : undefined;
                  const isCourseSchedule = s.course?.type === "fixed";
                  return (
                    <div key={idx} className="border border-gray-100 rounded-lg p-3 hover:border-gray-200 transition-colors">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-sm font-semibold text-gray-900">{displayName(s)}</p>
                        <div className="flex gap-1">
                          {!isCourseSchedule && <button onClick={() => openEditForm(s)} className="text-[10px] text-gray-400 hover:text-blue-500">✎</button>}
                          <button onClick={() => handleDelete(s.id)} className="text-[10px] text-gray-400 hover:text-red-500">✕</button>
                        </div>
                      </div>
                      <p className="text-[11px] text-gray-400">
                        {s.startTime || "待定"}{s.endTime ? ` - ${s.endTime}` : ""}
                        <span className="ml-1.5">{s.type === "fixed" ? "🔄 固定" : "📌 临时"}</span>
                      </p>
                      {s.notes && <p className="text-[10px] text-gray-400 mt-0.5">{s.notes}</p>}
                      {isCourseSchedule ? (
                        <div className="mt-2 space-y-2 border-t border-gray-50 pt-2">
                          {s.course?.studentCourses.length === 0 ? (
                            <p className="text-[10px] text-gray-400">暂无选课学生</p>
                          ) : s.course?.studentCourses.map(({ student }) => {
                            const studentAtt = s.attendance.find(a => a.studentId === student.id && isSameDay(new Date(a.date), selectedDate));
                            return (
                              <div key={student.id} className="rounded-md bg-gray-50/60 px-2 py-1.5">
                                <div className="flex items-center justify-between gap-2">
                                  <span className="text-xs font-medium text-gray-700">{student.name}</span>
                                  <span className="text-[10px] text-gray-400">{student.grade || "未设置"}</span>
                                </div>
                                {renderAttendanceControls(s, student, studentAtt, true)}
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="mt-2 border-t border-gray-50 pt-2">
                          {s.student && renderAttendanceControls(s, s.student, todayAtt)}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            }
          </div>
        </div>
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{editingId ? "编辑排课" : "新增排课"}</DialogTitle></DialogHeader>
          <div className="space-y-3 pt-2">
            <div>
              <Label className="text-xs text-gray-500">学生</Label>
              <Select value={formStudentId} onValueChange={setFormStudentId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {students.map(s => <SelectItem key={s.id} value={s.id}>{s.name} ({s.grade || "未设置"})</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-gray-500">类型</Label>
              <Select value={formType} onValueChange={setFormType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="fixed">固定排课（每周）</SelectItem>
                  <SelectItem value="flexible">灵活排课（单次）</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {formType === "fixed" ? (
              <div>
                <Label className="text-xs text-gray-500">星期</Label>
                <Select value={formDay} onValueChange={setFormDay}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[["1","周一"],["2","周二"],["3","周三"],["4","周四"],["5","周五"],["6","周六"],["0","周日"]].map(([v, l]) =>
                      <SelectItem key={v} value={v}>{l}</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div>
                <Label className="text-xs text-gray-500">日期</Label>
                <Input type="date" value={formDate} onChange={e => setFormDate(e.target.value)} />
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-gray-500">开始时间</Label>
                <Input type="time" value={formStart} onChange={e => setFormStart(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs text-gray-500">结束时间</Label>
                <Input type="time" value={formEnd} onChange={e => setFormEnd(e.target.value)} />
              </div>
            </div>
            <div>
              <Label className="text-xs text-gray-500">备注</Label>
              <Input placeholder="可选" value={formNotes} onChange={e => setFormNotes(e.target.value)} />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => setShowForm(false)}>取消</Button>
              <Button size="sm" onClick={handleSave} disabled={!formStudentId}>保存</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Lesson Review Dialog */}
      <Dialog open={showReviewForm} onOpenChange={setShowReviewForm}>
        <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {pendingAttendance?.studentName || "学生"} · {pendingAttendance?.status === "makeup" ? "补课反馈" : "上课反馈"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <Label className="text-xs text-gray-500">上课内容</Label>
              <div className="mt-1">
                <TagChips
                  type="content"
                  tags={lessonTags}
                  selected={selectedContentTags}
                  onToggle={(name) => toggleTag(name, "content")}
                  onCreate={createLessonTag}
                  onRename={renameLessonTag}
                  onDelete={deleteLessonTag}
                />
              </div>
            </div>
            <div>
              <Label className="text-xs text-gray-500">上课反馈</Label>
              <div className="mt-1">
                <TagChips
                  type="feedback"
                  tags={lessonTags}
                  selected={selectedFeedbackTags}
                  onToggle={(name) => toggleTag(name, "feedback")}
                  onCreate={createLessonTag}
                  onRename={renameLessonTag}
                  onDelete={deleteLessonTag}
                />
              </div>
            </div>
            <div>
              <Label className="text-xs text-gray-500">薄弱点</Label>
              <div className="mt-1">
                <WeakPointTagChips
                  tags={reviewWeakPointTags}
                  selected={selectedWeakPointTags}
                  onToggle={(name) => toggleWeakPointTag(name)}
                  onCreate={createWeakPointTag}
                  onRename={renameWeakPointTag}
                  onDelete={deleteWeakPointTag}
                />
              </div>
            </div>
            <div className="rounded-lg border border-gray-100 p-3">
              <Label className="text-xs text-gray-500">课堂视频</Label>
              {reviewLessonVideo && (
                <div className="mt-2 rounded-md bg-gray-50 px-3 py-2 text-xs text-gray-600">
                  <div className="flex items-center justify-between gap-3">
                    <span className="min-w-0 truncate">{reviewLessonVideo.title || reviewLessonVideo.fileName}</span>
                    <button type="button" className="shrink-0 font-semibold text-red-400 hover:text-red-500" onClick={deleteReviewLessonVideo}>
                      删除
                    </button>
                  </div>
                  <p className="mt-1 text-[11px] text-gray-400">{formatFileSize(reviewLessonVideo.size)}</p>
                </div>
              )}
              <Input
                type="file"
                accept="video/mp4,video/webm,video/quicktime,video/x-m4v"
                className="mt-2"
                onChange={(event) => {
                  setReviewVideoFile(event.target.files?.[0] || null);
                  setReviewVideoError("");
                }}
              />
              <p className="mt-1 text-[11px] text-gray-400">
                支持 mp4、webm、mov、m4v。选择新文件后，保存时会上传{reviewLessonVideo ? "并替换当前视频" : ""}。
              </p>
              {reviewVideoFile && <p className="mt-1 text-[11px] text-blue-500">已选择：{reviewVideoFile.name}</p>}
              {reviewVideoError && <p className="mt-1 text-[11px] text-red-500">{reviewVideoError}</p>}
            </div>
            <div className="sticky bottom-0 flex justify-end gap-2 border-t border-gray-100 bg-background pt-3">
              <Button variant="outline" size="sm" onClick={() => setShowReviewForm(false)}>取消</Button>
              <Button size="sm" onClick={submitAttendanceReview} disabled={savingReview}>
                {savingReview ? "保存中..." : "保存考勤与反馈"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
