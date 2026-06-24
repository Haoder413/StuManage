"use client";

import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const DAY_NAMES = ["日", "一", "二", "三", "四", "五", "六"];
const MONTH_NAMES = ["1月", "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月"];
const HOURS = Array.from({ length: 14 }, (_, index) => index + 8);
const REPEAT_DAY_OPTIONS = [
  { value: 1, label: "周一" },
  { value: 2, label: "周二" },
  { value: 3, label: "周三" },
  { value: 4, label: "周四" },
  { value: 5, label: "周五" },
  { value: 6, label: "周六" },
  { value: 0, label: "周日" },
];
type LearningLinkOption = {
  id: string;
  studentId: string;
  studentName: string;
  subject: string;
  teacherName: string;
  label: string;
};

type AttendanceRecord = {
  id: string;
  studentId: string;
  status: string;
  date: string;
  lessonContent?: string | null;
  lessonFeedback?: string | null;
  contentTags?: string[] | null;
  feedbackTags?: string[] | null;
  weakPointTags?: string[] | null;
};

export type CalendarItem =
  | {
      id: string;
      kind: "teacher_schedule";
      scheduleId: string;
      studentId: string;
      studentName: string;
      learningLinkId: string;
      teacherName: string;
      subject: string;
      title: string;
      courseName: string | null;
      courseType: string;
      dayOfWeek: number | null;
      date: string | null;
      startTime: string | null;
      endTime: string | null;
      notes: string | null;
      attendance: AttendanceRecord[];
    }
  | {
      id: string;
      kind: "parent_item";
      studentId: string;
      studentName: string;
      learningLinkId: string | null;
      seriesId: string | null;
      subjectLabel: string;
      seriesEndDate: string | null;
      repeatDays: number[];
      title: string;
      date: string;
      startTime: string;
      endTime: string;
      notes: string | null;
      teacherName?: string;
      subject?: string;
    };

type CalendarDay = { day: number; currentMonth: boolean; date: Date };
type ViewMode = "month" | "week";

type FormState = {
  learningLinkId: string;
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  notes: string;
  subjectLabel: string;
  repeatDays: number[];
  seriesEndDate: string;
};

type SubjectOption = {
  id: string;
  name: string;
  source: "managed" | "schedule";
};

const emptyForm: FormState = {
  learningLinkId: "",
  title: "",
  date: "",
  startTime: "09:00",
  endTime: "10:00",
  notes: "",
  subjectLabel: "其他",
  repeatDays: [],
  seriesEndDate: "",
};

export function ParentTimeManagementClient({ title, learningLinks }: { title: string; learningLinks: LearningLinkOption[] }) {
  const today = useMemo(() => new Date(), []);
  const [currentMonth, setCurrentMonth] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState(today);
  const [viewMode, setViewMode] = useState<ViewMode>("month");
  const [items, setItems] = useState<CalendarItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showSubjectManager, setShowSubjectManager] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [subjectOptions, setSubjectOptions] = useState<SubjectOption[]>([]);
  const [editingSubjectName, setEditingSubjectName] = useState<string | null>(null);
  const [subjectDraft, setSubjectDraft] = useState("");
  const [form, setForm] = useState<FormState>({
    ...emptyForm,
    learningLinkId: learningLinks[0]?.id || "",
    date: formatDateInput(today),
  });

  useEffect(() => {
    let alive = true;
    setLoading(true);
    Promise.all([
      fetch("/api/parent/schedule-items").then((response) => response.json()),
      fetch("/api/parent/schedule-subjects").then((response) => response.json()),
    ])
      .then(([itemData, subjectData]: [{ items?: CalendarItem[] }, { subjects?: SubjectOption[] }]) => {
        if (!alive) return;
        setItems(Array.isArray(itemData.items) ? itemData.items : []);
        setSubjectOptions(normalizeSubjectOptions(subjectData.subjects));
      })
      .catch(() => {
        if (alive) {
          setItems([]);
          setSubjectOptions([{ id: "default:other", name: "其他", source: "managed" }]);
        }
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const calendarDays = useMemo(() => buildCalendarDays(currentMonth), [currentMonth]);
  const weekStart = useMemo(() => getWeekStart(selectedDate), [selectedDate]);
  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, index) => addDays(weekStart, index)),
    [weekStart]
  );
  const selectedItems = useMemo(() => getItemsForDate(items, selectedDate), [items, selectedDate]);
  const selectedSubjectExists = subjectOptions.some((subject) => subject.name === form.subjectLabel.trim());
  const viewTitle =
    viewMode === "month"
      ? `${year}年 ${MONTH_NAMES[month]}`
      : `${formatDateInput(weekDays[0])} - ${formatDateInput(weekDays[6])}`;

  function updateForm<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function toggleRepeatDay(day: number) {
    setForm((current) => ({
      ...current,
      repeatDays: current.repeatDays.includes(day)
        ? current.repeatDays.filter((item) => item !== day)
        : [...current.repeatDays, day].sort((a, b) => a - b),
    }));
  }

  function startAddSubject() {
    setEditingSubjectName(null);
    setSubjectDraft("");
  }

  function startEditSubject(subjectName: string) {
    setEditingSubjectName(subjectName);
    setSubjectDraft(subjectName);
  }

  async function saveSubject() {
    const name = normalizeSubjectLabel(subjectDraft);
    if (!name) return;
    const response = await fetch("/api/parent/schedule-subjects", {
      method: editingSubjectName ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editingSubjectName ? { oldName: editingSubjectName, name } : { name }),
    });
    if (!response.ok) return;
    const savedSubject: SubjectOption = await response.json();
    setSubjectOptions((current) => normalizeSubjectOptions([
      ...current.filter((subject) => subject.name !== editingSubjectName && subject.name !== savedSubject.name),
      savedSubject,
    ]));
    if (editingSubjectName) {
      setItems((current) => current.map((item) => (
        item.kind === "parent_item" && item.subjectLabel === editingSubjectName
          ? { ...item, subjectLabel: savedSubject.name }
          : item
      )));
      setForm((current) => ({
        ...current,
        subjectLabel: current.subjectLabel === editingSubjectName ? savedSubject.name : current.subjectLabel,
      }));
    } else if (!selectedSubjectExists) {
      updateForm("subjectLabel", savedSubject.name);
    }
    setEditingSubjectName(null);
    setSubjectDraft("");
  }

  async function deleteSubject(subjectName: string) {
    if (!confirm(`确定从可选科目中删除「${subjectName}」？已有安排会保留原科目。`)) return;
    const response = await fetch(`/api/parent/schedule-subjects?name=${encodeURIComponent(subjectName)}`, { method: "DELETE" });
    if (!response.ok) return;
    setSubjectOptions((current) => normalizeSubjectOptions(current.filter((subject) => subject.name !== subjectName)));
    if (form.subjectLabel === subjectName) {
      setForm((current) => ({ ...current, subjectLabel: subjectOptions.find((subject) => subject.name !== subjectName)?.name || "其他" }));
    }
    if (editingSubjectName === subjectName) startAddSubject();
  }

  function openAddForm(date = selectedDate) {
    setEditingId(null);
    setForm({
      ...emptyForm,
      learningLinkId: learningLinks[0]?.id || "",
      subjectLabel: subjectOptions[0]?.name || "其他",
      date: formatDateInput(date),
    });
    setShowForm(true);
  }

  function openEditForm(item: CalendarItem) {
    if (item.kind !== "parent_item") return;
    setEditingId(item.id);
    setForm({
      learningLinkId: item.learningLinkId || learningLinks.find((link) => link.studentId === item.studentId)?.id || "",
      title: item.title,
      date: item.date,
      startTime: item.startTime,
      endTime: item.endTime,
      notes: item.notes || "",
      subjectLabel: item.subjectLabel || "其他",
      repeatDays: item.repeatDays || [],
      seriesEndDate: item.seriesEndDate || "",
    });
    setShowForm(true);
  }

  async function savePersonalItem() {
    const selectedLink = learningLinks.find((link) => link.id === form.learningLinkId);
    if (!selectedLink || !form.title.trim() || !form.date || !selectedSubjectExists) return;

    const body = {
      ...(editingId ? { id: editingId } : {}),
      learningLinkId: selectedLink.id,
      studentId: selectedLink.studentId,
      title: form.title.trim(),
      date: form.date,
      startTime: form.startTime,
      endTime: form.endTime,
      notes: form.notes,
      subjectLabel: form.subjectLabel.trim() || "其他",
      repeatDays: form.repeatDays,
      seriesEndDate: form.seriesEndDate,
    };
    const response = await fetch("/api/parent/schedule-items", {
      method: editingId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!response.ok) return;
    const savedItems: CalendarItem[] = await response.json();
    setItems((current) => {
      if (!editingId) return [...current, ...savedItems];
      const editingItem = current.find((item) => item.kind === "parent_item" && item.id === editingId);
      return [
        ...current.filter((item) => {
          if (item.kind !== "parent_item") return true;
          if (!editingItem || editingItem.kind !== "parent_item") return item.id !== editingId;
          return editingItem.seriesId ? item.seriesId !== editingItem.seriesId : item.id !== editingId;
        }),
        ...savedItems,
      ];
    });
    setShowForm(false);
    setEditingId(null);
  }

  async function deletePersonalItem(item: CalendarItem) {
    if (item.kind !== "parent_item") return;
    const message = item.seriesId ? "确定删除这一整组重复安排？" : "确定删除这个个人安排？";
    if (!confirm(message)) return;
    const response = await fetch(`/api/parent/schedule-items?id=${encodeURIComponent(item.id)}`, { method: "DELETE" });
    if (response.ok) {
      setItems((current) => current.filter((currentItem) => {
        if (currentItem.kind !== "parent_item") return true;
        return item.seriesId ? currentItem.seriesId !== item.seriesId : currentItem.id !== item.id;
      }));
    }
  }

  function prev() {
    if (viewMode === "month") {
      setCurrentMonth(new Date(year, month - 1, 1));
      return;
    }
    const nextSelected = addDays(weekStart, -7);
    setSelectedDate(nextSelected);
    setCurrentMonth(new Date(nextSelected.getFullYear(), nextSelected.getMonth(), 1));
  }

  function next() {
    if (viewMode === "month") {
      setCurrentMonth(new Date(year, month + 1, 1));
      return;
    }
    const nextSelected = addDays(weekStart, 7);
    setSelectedDate(nextSelected);
    setCurrentMonth(new Date(nextSelected.getFullYear(), nextSelected.getMonth(), 1));
  }

  function chooseDate(date: Date) {
    setSelectedDate(date);
    setCurrentMonth(new Date(date.getFullYear(), date.getMonth(), 1));
  }

  function goToToday() {
    chooseDate(today);
  }

  if (learningLinks.length === 0) {
    return (
      <div>
        <PageHeader title={title} description="查看老师课程安排，并记录孩子的个人学习计划" />
        <div className="glass-card rounded-xl p-10 text-center text-sm text-gray-400">暂无可查看的学习关系</div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={title}
        description="查看老师安排的课程，并添加个人学习安排"
        action={<Button size="sm" onClick={() => openAddForm()}>+ 个人安排</Button>}
      />

      <div className="flex flex-col gap-6 xl:flex-row">
        <div className="glass-card flex-1 rounded-xl p-5">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <button onClick={goToToday} className="rounded-lg border border-gray-200/50 px-3 py-1.5 text-xs font-semibold text-gray-500 hover:bg-gray-100/50 hover:text-gray-800">
                今天
              </button>
              <div className="flex gap-0.5">
                <button onClick={prev} className="rounded-lg p-1.5 text-sm text-gray-400 hover:bg-gray-100/50">◀</button>
                <button onClick={next} className="rounded-lg p-1.5 text-sm text-gray-400 hover:bg-gray-100/50">▶</button>
              </div>
              <h2 className="text-base font-semibold text-gray-900">{viewTitle}</h2>
            </div>
            <div className="flex gap-0.5 rounded-lg bg-gray-100 p-0.5">
              <button onClick={() => setViewMode("month")} className={`rounded-md px-3 py-1 text-xs font-semibold transition-colors ${viewMode === "month" ? "bg-white text-gray-800 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>月</button>
              <button onClick={() => setViewMode("week")} className={`rounded-md px-3 py-1 text-xs font-semibold transition-colors ${viewMode === "week" ? "bg-white text-gray-800 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>周</button>
            </div>
          </div>

          {viewMode === "month" ? (
            <>
              <div className="mb-1 grid grid-cols-7">
                {DAY_NAMES.map((name) => (
                  <div key={name} className="py-1.5 text-center text-[11px] font-semibold tracking-wide text-gray-400">{name}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 border-l border-t border-gray-100">
                {calendarDays.map((day, index) => {
                  const dayItems = getItemsForDate(items, day.date);
                  const selected = isSameDay(day.date, selectedDate);
                  const todayDate = isToday(day.date);
                  return (
                    <button
                      key={`${day.date.toISOString()}-${index}`}
                      onClick={() => chooseDate(day.date)}
                      className={`relative min-h-[76px] border-b border-r border-gray-100 p-1.5 text-left transition-colors ${day.currentMonth ? "text-gray-700" : "text-gray-300"} ${selected ? "bg-blue-50/60" : "hover:bg-gray-50/50"}`}
                    >
                      <span className={`mb-1 inline-flex h-6 w-6 items-center justify-center rounded-full text-xs ${todayDate ? "bg-blue-500 font-bold text-white" : ""} ${selected && !todayDate ? "bg-gray-200 font-semibold" : "font-medium"}`}>
                        {day.day}
                      </span>
                      <div className="space-y-1">
                        {dayItems.slice(0, 2).map((item) => (
                          <CalendarItemPill key={item.id} item={item} />
                        ))}
                        {dayItems.length > 2 && <div className="px-1 text-[10px] font-semibold text-blue-500">+{dayItems.length - 2}</div>}
                      </div>
                    </button>
                  );
                })}
              </div>
            </>
          ) : (
            <div className="max-h-[520px] overflow-auto">
              <div className="sticky top-0 z-10 grid grid-cols-[50px_repeat(7,1fr)] bg-white/90 backdrop-blur">
                <div className="py-1 pr-2 text-right text-[10px] text-gray-300" />
                {weekDays.map((date) => {
                  const selected = isSameDay(date, selectedDate);
                  const todayDate = isToday(date);
                  return (
                    <button key={date.toISOString()} onClick={() => chooseDate(date)} className={`rounded-t-lg py-1.5 text-center ${selected ? "bg-blue-50/60" : ""}`}>
                      <div className="text-[10px] font-semibold text-gray-400">{DAY_NAMES[date.getDay()]}</div>
                      <div className={`mt-0.5 inline-flex h-7 w-7 items-center justify-center rounded-full text-sm ${todayDate ? "bg-blue-500 font-bold text-white" : ""} ${selected && !todayDate ? "bg-gray-200 font-semibold" : ""}`}>
                        {date.getDate()}
                      </div>
                    </button>
                  );
                })}
              </div>
              <div className="grid grid-cols-[50px_repeat(7,1fr)] gap-px bg-gray-50">
                {HOURS.map((hour) => (
                  <div key={hour} className="contents">
                    <div className="sticky left-0 bg-white py-3 pr-2 text-right text-[10px] text-gray-400">{hour}:00</div>
                    {weekDays.map((date) => {
                      const hourItems = getItemsForDate(items, date).filter((item) => item.startTime && Number(item.startTime.split(":")[0]) === hour);
                      return (
                        <button key={`${date.toISOString()}-${hour}`} onClick={() => chooseDate(date)} className={`min-h-[36px] border-b border-gray-100 px-1 py-0.5 text-left hover:bg-gray-50/50 ${isSameDay(date, selectedDate) ? "bg-blue-50/30" : ""}`}>
                          {hourItems.map((item) => (
                            <CalendarItemPill key={item.id} item={item} showTime />
                          ))}
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="glass-card w-full shrink-0 self-start rounded-xl p-5 xl:w-80">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex-1 text-center">
              <div className="text-3xl font-bold text-gray-900">{selectedDate.getDate()}</div>
              <div className="mt-1 text-xs tracking-wide text-gray-400">{selectedDate.getFullYear()}年{selectedDate.getMonth() + 1}月 · 周{DAY_NAMES[selectedDate.getDay()]}</div>
            </div>
            <Button size="sm" variant="outline" className="shrink-0" onClick={() => openAddForm()}>+</Button>
          </div>

          <div className="border-t border-gray-100 pt-4">
            {loading ? (
              <p className="py-8 text-center text-sm text-gray-400">加载中...</p>
            ) : selectedItems.length === 0 ? (
              <p className="py-8 text-center text-sm text-gray-400">暂无课程安排</p>
            ) : (
              <div className="space-y-2">
                {selectedItems.map((item) => (
                  <ScheduleDetail
                    key={item.id}
                    item={item}
                    selectedDate={selectedDate}
                    onEdit={() => openEditForm(item)}
                    onDelete={() => item.kind === "parent_item" && deletePersonalItem(item)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="flex max-h-[85vh] max-w-sm flex-col">
          <DialogHeader>
            <DialogTitle>{editingId ? "编辑个人安排" : "新增个人安排"}</DialogTitle>
            <DialogDescription className="sr-only">填写孩子的个人课程安排，仅当前家长账号可见。</DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pt-2 pr-1">
            <div>
              <Label className="text-xs text-gray-500">学习关系</Label>
              <Select value={form.learningLinkId} onValueChange={(value) => updateForm("learningLinkId", value)}>
                <SelectTrigger><SelectValue placeholder="选择学习关系" /></SelectTrigger>
                <SelectContent>
                  {learningLinks.map((link) => (
                    <SelectItem key={link.id} value={link.id}>{link.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-gray-500">标题</Label>
              <Input value={form.title} onChange={(event) => updateForm("title", event.target.value)} placeholder="例如：完成数学练习" />
            </div>
            <div>
              <div className="flex items-center justify-between">
                <Label className="text-xs text-gray-500">科目</Label>
                <button
                  type="button"
                  onClick={() => {
                    startAddSubject();
                    setShowSubjectManager(true);
                  }}
                  className="text-[11px] font-semibold text-blue-500 hover:text-blue-600"
                >
                  编辑科目
                </button>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {subjectOptions.map((subject) => {
                  const active = form.subjectLabel.trim() === subject.name;
                  return (
                    <button
                      key={subject.id}
                      type="button"
                      onClick={() => updateForm("subjectLabel", subject.name)}
                      className={`rounded-full border px-2 py-1 text-[11px] font-semibold transition-colors ${active ? "border-sky-200 bg-sky-50 text-sky-700" : "border-gray-200 bg-white text-gray-500 hover:bg-gray-50"}`}
                    >
                      {subject.name}
                    </button>
                  );
                })}
                {subjectOptions.length === 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      startAddSubject();
                      setShowSubjectManager(true);
                    }}
                    className="rounded-full border border-dashed border-gray-300 px-2 py-1 text-[11px] font-semibold text-gray-400"
                  >
                    + 添加科目
                  </button>
                )}
              </div>
            </div>
            <Dialog open={showSubjectManager} onOpenChange={setShowSubjectManager}>
              <DialogContent className="max-w-sm">
                <DialogHeader>
                  <DialogTitle>编辑科目</DialogTitle>
                  <DialogDescription className="sr-only">管理当前家长自己的个人安排科目。</DialogDescription>
                </DialogHeader>
                <div className="space-y-3 pt-2">
                  <div className="flex gap-2">
                    <Input
                      value={subjectDraft}
                      onChange={(event) => setSubjectDraft(event.target.value)}
                      placeholder="科目名称"
                      maxLength={20}
                    />
                    <Button size="sm" onClick={saveSubject}>{editingSubjectName ? "保存" : "新增"}</Button>
                  </div>
                  {editingSubjectName && (
                    <button type="button" onClick={startAddSubject} className="text-[11px] font-semibold text-gray-400 hover:text-gray-600">
                      取消编辑
                    </button>
                  )}
                  <div className="space-y-2">
                    {subjectOptions.map((subject) => {
                      const active = editingSubjectName === subject.name;
                      return (
                        <div key={subject.id} className={`flex items-center justify-between rounded-md border px-3 py-2 text-sm ${active ? "border-blue-200 bg-blue-50" : "border-gray-100"}`}>
                          <span className="font-medium text-gray-700">{subject.name}</span>
                          <div className="flex gap-2 text-xs">
                            <button type="button" onClick={() => startEditSubject(subject.name)} className="font-semibold text-blue-500 hover:text-blue-600">改名</button>
                            <button type="button" onClick={() => deleteSubject(subject.name)} className="font-semibold text-red-400 hover:text-red-500">删除</button>
                          </div>
                        </div>
                      );
                    })}
                    {subjectOptions.length === 0 && (
                      <p className="rounded-md bg-gray-50 px-3 py-3 text-center text-xs text-gray-400">暂无科目</p>
                    )}
                  </div>
                </div>
              </DialogContent>
            </Dialog>
            <div>
              <Label className="text-xs text-gray-500">开始日期</Label>
              <Input type="date" value={form.date} onChange={(event) => updateForm("date", event.target.value)} />
            </div>
            <div>
              <Label className="text-xs text-gray-500">每周重复</Label>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {REPEAT_DAY_OPTIONS.map((day) => {
                  const active = form.repeatDays.includes(day.value);
                  return (
                    <button
                      key={day.value}
                      type="button"
                      onClick={() => toggleRepeatDay(day.value)}
                      className={`rounded-full border px-2 py-1 text-[11px] font-semibold transition-colors ${active ? "border-sky-200 bg-sky-50 text-sky-700" : "border-gray-200 bg-white text-gray-500 hover:bg-gray-50"}`}
                    >
                      {day.label}
                    </button>
                  );
                })}
              </div>
            </div>
            {form.repeatDays.length > 0 && (
              <div>
                <Label className="text-xs text-gray-500">截止日期</Label>
                <Input type="date" value={form.seriesEndDate} onChange={(event) => updateForm("seriesEndDate", event.target.value)} />
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-gray-500">开始时间</Label>
                <Input type="time" value={form.startTime} onChange={(event) => updateForm("startTime", event.target.value)} />
              </div>
              <div>
                <Label className="text-xs text-gray-500">结束时间</Label>
                <Input type="time" value={form.endTime} onChange={(event) => updateForm("endTime", event.target.value)} />
              </div>
            </div>
            <div>
              <Label className="text-xs text-gray-500">备注</Label>
              <Textarea value={form.notes} onChange={(event) => updateForm("notes", event.target.value)} placeholder="可选" />
            </div>
          </div>
          <div className="flex shrink-0 justify-end gap-2 border-t border-gray-100 pt-3">
            <Button variant="outline" size="sm" onClick={() => setShowForm(false)}>取消</Button>
            <Button size="sm" onClick={savePersonalItem} disabled={!form.learningLinkId || !form.title.trim() || !form.date || !selectedSubjectExists || (form.repeatDays.length > 0 && !form.seriesEndDate)}>保存</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ScheduleDetail({
  item,
  selectedDate,
  onEdit,
  onDelete,
}: {
  item: CalendarItem;
  selectedDate: Date;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const attendance = item.kind === "teacher_schedule"
    ? item.attendance.find((record) => isSameDay(parseCalendarDate(record.date), selectedDate))
    : null;
  const futureWithoutAttendance = item.kind === "teacher_schedule" && !attendance && startOfDay(selectedDate) >= startOfDay(new Date());
  const status = attendance ? attendanceStatusLabel(attendance.status) : futureWithoutAttendance ? "待上课" : "暂无考勤";
  const lessonContent = attendance?.lessonContent || "待老师课后填写";
  const feedback = attendance?.lessonFeedback || "待老师课后填写";
  const subjectLabel = item.kind === "parent_item" ? normalizeSubjectLabel(item.subjectLabel) : "";

  return (
    <div className="rounded-lg border border-gray-100 p-3 transition-colors hover:border-gray-200">
      <div className="mb-1 flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            {item.kind === "parent_item" && (
              <span className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded border text-[11px] font-bold ${getSubjectClass(subjectLabel)}`}>
                {getSubjectInitial(subjectLabel)}
              </span>
            )}
            <p className="text-sm font-semibold text-gray-900">{item.title || (item.kind === "teacher_schedule" ? "老师安排" : "个人安排")}</p>
          </div>
          <p className="mt-0.5 text-[11px] text-gray-400">
            {item.kind === "teacher_schedule" ? "老师安排" : "个人安排"} · {item.studentName}
            {item.kind === "parent_item" ? ` · ${subjectLabel}` : ""}
            {item.subject ? ` · ${item.subject}` : ""}
          </p>
        </div>
        {item.kind === "parent_item" && (
          <div className="flex gap-1">
            <button onClick={onEdit} className="text-[10px] text-gray-400 hover:text-blue-500">✎</button>
            <button onClick={onDelete} className="text-[10px] text-gray-400 hover:text-red-500">✕</button>
          </div>
        )}
      </div>
      <p className="text-[11px] text-gray-400">
        {item.startTime || "待定"}{item.endTime ? ` - ${item.endTime}` : ""}
        {item.kind === "teacher_schedule" && <span className="ml-1.5">{item.courseType === "fixed" ? "🔄 固定" : "📌 临时"}</span>}
      </p>
      {item.kind === "teacher_schedule" && (
        <div className="mt-2 space-y-2 rounded-md bg-blue-50/60 p-2 text-[11px] text-blue-700">
          <div className="space-y-0.5">
            <p>{item.teacherName} · {status}</p>
            <p><span className="font-semibold">上课内容：</span>{lessonContent}</p>
            <p><span className="font-semibold">上课反馈：</span>{feedback}</p>
          </div>
          <TeacherTagList label="内容标签" tags={attendance?.contentTags} emptyText="暂无标签" />
          <TeacherTagList label="反馈标签" tags={attendance?.feedbackTags} emptyText="暂无标签" />
          <TeacherTagList label="薄弱点" tags={attendance?.weakPointTags} emptyText="暂无关联薄弱点" />
        </div>
      )}
      {item.kind === "parent_item" && item.seriesId && (
        <p className="mt-2 rounded-md bg-slate-50 px-2 py-1 text-[11px] text-gray-500">
          {formatRepeatRule(item.repeatDays, item.seriesEndDate)}
        </p>
      )}
      {item.notes && <p className="mt-2 text-[11px] text-gray-500">{item.notes}</p>}
    </div>
  );
}

function CalendarItemPill({ item, showTime = false }: { item: CalendarItem; showTime?: boolean }) {
  if (item.kind === "teacher_schedule") {
    return (
      <div className="truncate rounded bg-blue-100 px-1 py-0.5 text-[10px] font-medium leading-tight text-blue-700">
        老师安排 · {item.title}
        {showTime && item.startTime && <span className="ml-0.5 text-blue-400">{item.startTime}</span>}
      </div>
    );
  }

  const subjectLabel = normalizeSubjectLabel(item.subjectLabel);
  return (
    <div className={`flex items-center gap-1 truncate rounded border px-1 py-0.5 text-[10px] font-medium leading-tight ${getSubjectClass(subjectLabel)}`}>
      <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded bg-white/70 text-[9px] font-bold">{getSubjectInitial(subjectLabel)}</span>
      <span className="truncate">{subjectLabel} · {item.title}</span>
      {showTime && item.startTime && <span className="shrink-0 opacity-75">{item.startTime}</span>}
    </div>
  );
}

function TeacherTagList({ label, tags, emptyText }: { label: string; tags?: string[] | null; emptyText: string }) {
  const visibleTags = Array.isArray(tags) ? tags.filter((tag) => tag.trim()) : [];

  return (
    <div>
      <p className="mb-1 font-semibold">{label}</p>
      {visibleTags.length === 0 ? (
        <p className="text-blue-500/70">{emptyText}</p>
      ) : (
        <div className="flex flex-wrap gap-1">
          {visibleTags.map((tag) => (
            <span key={tag} className="rounded-full border border-blue-200/70 bg-white/70 px-1.5 py-0.5 text-[10px] text-blue-700">
              {tag}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function buildCalendarDays(currentMonth: Date) {
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const startDayOfWeek = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();
  const days: CalendarDay[] = [];

  for (let index = startDayOfWeek - 1; index >= 0; index--) {
    const day = daysInPrevMonth - index;
    days.push({ day, currentMonth: false, date: new Date(year, month - 1, day) });
  }
  for (let day = 1; day <= daysInMonth; day++) {
    days.push({ day, currentMonth: true, date: new Date(year, month, day) });
  }
  for (let day = 1; days.length < 42; day++) {
    days.push({ day, currentMonth: false, date: new Date(year, month + 1, day) });
  }

  return days;
}

function getItemsForDate(items: CalendarItem[], date: Date) {
  const dayOfWeek = date.getDay();
  return items
    .filter((item) => {
      if (item.kind === "teacher_schedule") {
        if (item.courseType === "fixed" && item.dayOfWeek === dayOfWeek) return true;
        if (item.date) return isSameDay(parseCalendarDate(item.date), date);
        return false;
      }
      return isSameDay(parseCalendarDate(item.date), date);
    })
    .sort((a, b) => (a.startTime || "99:99").localeCompare(b.startTime || "99:99"));
}

function parseCalendarDate(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) {
    return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  }
  return new Date(value);
}

function formatDateInput(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isSameDay(first: Date, second: Date) {
  return first.getFullYear() === second.getFullYear() && first.getMonth() === second.getMonth() && first.getDate() === second.getDate();
}

function isToday(date: Date) {
  return isSameDay(date, new Date());
}

function startOfDay(date: Date) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function addDays(date: Date, amount: number) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + amount);
  return copy;
}

function getWeekStart(date: Date) {
  const copy = new Date(date);
  const day = copy.getDay();
  copy.setDate(copy.getDate() - (day === 0 ? 6 : day - 1));
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function attendanceStatusLabel(status: string) {
  if (status === "present") return "出勤";
  if (status === "makeup") return "补课";
  if (status === "absent") return "请假";
  return status || "暂无考勤";
}

const SUBJECT_CARD_CLASSES = [
  "border-sky-200 bg-sky-50 text-sky-700",
  "border-violet-200 bg-violet-50 text-violet-700",
  "border-amber-200 bg-amber-50 text-amber-700",
  "border-emerald-200 bg-emerald-50 text-emerald-700",
  "border-rose-200 bg-rose-50 text-rose-700",
  "border-lime-200 bg-lime-50 text-lime-700",
  "border-slate-200 bg-slate-50 text-slate-700",
];

function normalizeSubjectLabel(value: string | null | undefined) {
  return value?.trim().slice(0, 20) || "其他";
}

function getSubjectInitial(subjectLabel: string) {
  return normalizeSubjectLabel(subjectLabel).slice(0, 1);
}

function getSubjectClass(subjectLabel: string) {
  const normalized = normalizeSubjectLabel(subjectLabel);
  const hash = Array.from(normalized).reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return SUBJECT_CARD_CLASSES[hash % SUBJECT_CARD_CLASSES.length];
}

function normalizeSubjectOptions(subjects: SubjectOption[] | undefined) {
  if (!Array.isArray(subjects)) return [];
  const byName = new Map<string, SubjectOption>();
  for (const subject of subjects) {
    const name = normalizeSubjectLabel(subject.name);
    if (!name || byName.has(name)) continue;
    byName.set(name, {
      id: subject.id || `subject:${name}`,
      name,
      source: subject.source === "schedule" ? "schedule" : "managed",
    });
  }
  return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name, "zh-Hans-CN"));
}

function formatRepeatRule(repeatDays: number[], seriesEndDate: string | null) {
  const labels = repeatDays
    .map((day) => REPEAT_DAY_OPTIONS.find((option) => option.value === day)?.label)
    .filter(Boolean);
  if (labels.length === 0) return "";
  return `每${labels.join("、")}，至 ${seriesEndDate || "未设置截止日期"}`;
}
