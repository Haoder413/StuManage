const { request } = require("../../utils/api");

const DAY_NAMES = ["日", "一", "二", "三", "四", "五", "六"];
const REPEAT_DAYS = [
  { value: 1, label: "周一" },
  { value: 2, label: "周二" },
  { value: 3, label: "周三" },
  { value: 4, label: "周四" },
  { value: 5, label: "周五" },
  { value: 6, label: "周六" },
  { value: 0, label: "周日" }
];

function pad(value) {
  return String(value).padStart(2, "0");
}

function formatDateInput(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function parseDate(value) {
  if (!value) return new Date();
  const parts = value.split("-").map(Number);
  return new Date(parts[0], parts[1] - 1, parts[2]);
}

function sameDay(first, second) {
  return first.getFullYear() === second.getFullYear() && first.getMonth() === second.getMonth() && first.getDate() === second.getDate();
}

function addDays(date, amount) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + amount);
  return copy;
}

function normalizeSubject(value) {
  return (value || "").trim().slice(0, 20) || "其他";
}

function buildCalendarDays(currentMonth, items, selectedDate) {
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const startDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();
  const days = [];

  for (let index = startDay - 1; index >= 0; index -= 1) {
    const date = new Date(year, month - 1, daysInPrevMonth - index);
    days.push(buildDay(date, false, items, selectedDate));
  }
  for (let day = 1; day <= daysInMonth; day += 1) {
    days.push(buildDay(new Date(year, month, day), true, items, selectedDate));
  }
  for (let day = 1; days.length < 42; day += 1) {
    days.push(buildDay(new Date(year, month + 1, day), false, items, selectedDate));
  }
  return days;
}

function buildDay(date, currentMonth, items, selectedDate) {
  const dayItems = getItemsForDate(items, date);
  return {
    date: formatDateInput(date),
    day: date.getDate(),
    currentMonth,
    selected: sameDay(date, selectedDate),
    today: sameDay(date, new Date()),
    className: `day-cell ${currentMonth ? "" : "muted-day"} ${sameDay(date, selectedDate) ? "selected-day" : ""}`,
    items: dayItems.slice(0, 2),
    moreCount: Math.max(0, dayItems.length - 2)
  };
}

function getItemsForDate(items, date) {
  const dayOfWeek = date.getDay();
  return (items || [])
    .filter((item) => {
      if (item.kind === "teacher_schedule") {
        if (item.courseType === "fixed" && item.dayOfWeek === dayOfWeek) return true;
        return item.date ? sameDay(parseDate(item.date), date) : false;
      }
      return sameDay(parseDate(item.date), date);
    })
    .sort((a, b) => (a.startTime || "99:99").localeCompare(b.startTime || "99:99"))
    .map((item) => ({
      ...item,
      chipClass: item.kind === "teacher_schedule" ? "schedule-chip teacher-chip" : "schedule-chip parent-chip",
      displayTitle: item.kind === "teacher_schedule" ? `老师 · ${item.title}` : `${item.subjectLabel} · ${item.title}`
    }));
}

function emptyForm(date, links, subjects) {
  const link = links[0] || {};
  return {
    id: "",
    learningLinkId: link.id || "",
    studentId: link.studentId || "",
    title: "",
    subjectLabel: subjects[0]?.name || "其他",
    date: formatDateInput(date),
    startTime: "09:00",
    endTime: "10:00",
    notes: "",
    repeatDays: [],
    seriesEndDate: ""
  };
}

Page({
  data: {
    loading: true,
    currentMonth: "",
    selectedDate: "",
    monthTitle: "",
    dayNames: DAY_NAMES,
    repeatDayOptions: REPEAT_DAYS,
    calendarDays: [],
    selectedItems: [],
    links: [],
    items: [],
    subjects: [],
    showForm: false,
    editingItem: null,
    form: {},
    showSubjectEditor: false,
    editingSubjectName: "",
    subjectDraft: ""
  },

  onShow() {
    const today = new Date();
    this.setData({
      currentMonth: formatDateInput(new Date(today.getFullYear(), today.getMonth(), 1)),
      selectedDate: formatDateInput(today)
    });
    this.loadCalendar();
  },

  loadCalendar() {
    this.setData({ loading: true });
    Promise.all([
      request("/parent/calendar"),
      request("/parent/calendar-subjects")
    ])
      .then(([calendarData, subjectData]) => {
        const links = calendarData.links || [];
        const subjects = (subjectData.subjects || []).length ? subjectData.subjects : [{ id: "default-other", name: "其他" }];
        this.setData({
          links,
          items: calendarData.items || [],
          subjects
        });
        this.refreshCalendar();
      })
      .finally(() => this.setData({ loading: false }));
  },

  refreshCalendar() {
    const currentMonth = parseDate(this.data.currentMonth);
    const selectedDate = parseDate(this.data.selectedDate);
    this.setData({
      monthTitle: `${currentMonth.getFullYear()}年${currentMonth.getMonth() + 1}月`,
      calendarDays: buildCalendarDays(currentMonth, this.data.items, selectedDate),
      selectedItems: getItemsForDate(this.data.items, selectedDate)
    });
  },

  prevMonth() {
    const date = parseDate(this.data.currentMonth);
    const next = new Date(date.getFullYear(), date.getMonth() - 1, 1);
    this.setData({ currentMonth: formatDateInput(next) }, () => this.refreshCalendar());
  },

  nextMonth() {
    const date = parseDate(this.data.currentMonth);
    const next = new Date(date.getFullYear(), date.getMonth() + 1, 1);
    this.setData({ currentMonth: formatDateInput(next) }, () => this.refreshCalendar());
  },

  chooseDate(event) {
    const date = event.currentTarget.dataset.date;
    this.setData({ selectedDate: date }, () => this.refreshCalendar());
  },

  openAddForm() {
    const date = parseDate(this.data.selectedDate);
    this.setData({
      showForm: true,
      editingItem: null,
      form: emptyForm(date, this.data.links, this.data.subjects)
    });
  },

  openEditForm(event) {
    const id = event.currentTarget.dataset.id;
    const item = this.data.items.find((entry) => entry.id === id);
    if (!item || item.kind !== "parent_item") return;
    this.setData({
      showForm: true,
      editingItem: item,
      form: {
        id: item.id,
        learningLinkId: item.learningLinkId || "",
        studentId: item.studentId,
        title: item.title,
        subjectLabel: item.subjectLabel || "其他",
        date: item.date,
        startTime: item.startTime,
        endTime: item.endTime,
        notes: item.notes || "",
        repeatDays: item.repeatDays || [],
        seriesEndDate: item.seriesEndDate || ""
      }
    });
  },

  closeForm() {
    this.setData({ showForm: false, editingItem: null });
  },

  updateForm(event) {
    const field = event.currentTarget.dataset.field;
    this.setData({ [`form.${field}`]: event.detail.value });
  },

  chooseLink(event) {
    const link = this.data.links[Number(event.detail.value)] || {};
    this.setData({
      "form.learningLinkId": link.id || "",
      "form.studentId": link.studentId || ""
    });
  },

  chooseSubject(event) {
    const subject = this.data.subjects[Number(event.detail.value)] || {};
    this.setData({ "form.subjectLabel": subject.name || "其他" });
  },

  toggleRepeatDay(event) {
    const value = Number(event.currentTarget.dataset.value);
    const repeatDays = this.data.form.repeatDays || [];
    const next = repeatDays.includes(value)
      ? repeatDays.filter((day) => day !== value)
      : repeatDays.concat(value).sort((a, b) => a - b);
    this.setData({ "form.repeatDays": next });
  },

  saveItem() {
    const form = this.data.form;
    if (!form.learningLinkId || !form.studentId || !form.title || !form.date) {
      wx.showToast({ title: "请填写完整安排", icon: "none" });
      return;
    }
    if ((form.repeatDays || []).length > 0 && !form.seriesEndDate) {
      wx.showToast({ title: "请选择截止日期", icon: "none" });
      return;
    }
    request("/parent/calendar", {
      method: form.id ? "PATCH" : "POST",
      data: {
        id: form.id,
        learningLinkId: form.learningLinkId,
        studentId: form.studentId,
        title: form.title,
        subjectLabel: normalizeSubject(form.subjectLabel),
        date: form.date,
        startTime: form.startTime,
        endTime: form.endTime,
        notes: form.notes,
        repeatDays: form.repeatDays || [],
        seriesEndDate: form.seriesEndDate
      }
    }).then((savedItems) => {
      const editingItem = this.data.editingItem;
      const items = this.data.items.filter((item) => {
        if (!editingItem || item.kind !== "parent_item") return true;
        return editingItem.seriesId ? item.seriesId !== editingItem.seriesId : item.id !== editingItem.id;
      });
      this.setData({ items: items.concat(savedItems || []), showForm: false, editingItem: null }, () => this.refreshCalendar());
    });
  },

  deleteItem(event) {
    const id = event.currentTarget.dataset.id;
    const item = this.data.items.find((entry) => entry.id === id);
    if (!item || item.kind !== "parent_item") return;
    wx.showModal({
      title: "删除安排",
      content: item.seriesId ? "确定删除这一整组重复安排？" : "确定删除这个安排？",
      success: (res) => {
        if (!res.confirm) return;
        request(`/parent/calendar?id=${encodeURIComponent(item.id)}`, { method: "DELETE" }).then(() => {
          const items = this.data.items.filter((entry) => {
            if (entry.kind !== "parent_item") return true;
            return item.seriesId ? entry.seriesId !== item.seriesId : entry.id !== item.id;
          });
          this.setData({ items }, () => this.refreshCalendar());
        });
      }
    });
  },

  openSubjectEditor() {
    this.setData({ showSubjectEditor: true, editingSubjectName: "", subjectDraft: "" });
  },

  editSubject(event) {
    const name = event.currentTarget.dataset.name;
    this.setData({ editingSubjectName: name, subjectDraft: name });
  },

  updateSubjectDraft(event) {
    this.setData({ subjectDraft: event.detail.value });
  },

  saveSubject() {
    const name = normalizeSubject(this.data.subjectDraft);
    const oldName = this.data.editingSubjectName;
    request("/parent/calendar-subjects", {
      method: oldName ? "PATCH" : "POST",
      data: oldName ? { oldName, name } : { name }
    }).then((subject) => {
      const subjects = this.data.subjects.filter((item) => item.name !== oldName && item.name !== subject.name).concat(subject);
      const items = oldName
        ? this.data.items.map((item) => (item.kind === "parent_item" && item.subjectLabel === oldName ? { ...item, subjectLabel: subject.name } : item))
        : this.data.items;
      this.setData({
        subjects,
        items,
        editingSubjectName: "",
        subjectDraft: "",
        "form.subjectLabel": subject.name
      }, () => this.refreshCalendar());
    });
  },

  deleteSubject(event) {
    const name = event.currentTarget.dataset.name;
    wx.showModal({
      title: "删除科目",
      content: `确定从可选科目中删除「${name}」？已有安排会保留。`,
      success: (res) => {
        if (!res.confirm) return;
        request(`/parent/calendar-subjects?name=${encodeURIComponent(name)}`, { method: "DELETE" }).then(() => {
          const subjects = this.data.subjects.filter((item) => item.name !== name);
          this.setData({ subjects, editingSubjectName: "", subjectDraft: "" });
        });
      }
    });
  },

  closeSubjectEditor() {
    this.setData({ showSubjectEditor: false, editingSubjectName: "", subjectDraft: "" });
  }
});
