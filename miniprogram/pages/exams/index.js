const { request } = require("../../utils/api");

function formatDate(value) {
  if (!value) return "";
  const date = new Date(value);
  return `${date.getMonth() + 1}月${date.getDate()}日`;
}

function buildChartPoints(exams) {
  return (exams || [])
    .filter((exam) => typeof exam.percent === "number")
    .slice()
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .map((exam) => ({
      id: exam.id,
      label: formatDate(exam.date),
      value: exam.percent,
      name: exam.name
    }));
}

Page({
  data: {
    loading: true,
    loadError: "",
    students: []
  },

  onShow() {
    this.load();
  },

  load() {
    this.setData({ loading: true, loadError: "" });
    request("/parent/exams")
      .then((data) => {
        const students = (data.students || []).map((student) => ({
          ...student,
          averageText: student.average === null ? "-" : `${student.average}%`,
          chartPoints: buildChartPoints(student.exams),
          exams: (student.exams || []).map((exam) => ({ ...exam, dateText: formatDate(exam.date) }))
        }));
        this.setData({ students }, () => this.drawCharts());
      })
      .catch((error) => this.setData({ loadError: error.message || "成绩加载失败", students: [] }))
      .finally(() => this.setData({ loading: false }));
  },

  drawCharts() {
    this.data.students.forEach((student, index) => {
      this.drawStudentChart(index, student.chartPoints || []);
    });
  },

  drawStudentChart(index, chartPoints) {
    const query = wx.createSelectorQuery().in(this);
    query
      .select(`#exam-chart-${index}`)
      .fields({ node: true, size: true })
      .exec((res) => {
        const canvasInfo = res && res[0];
        if (!canvasInfo || !canvasInfo.node) return;

        const canvas = canvasInfo.node;
        const ctx = canvas.getContext("2d");
        const pixelRatio = wx.getSystemInfoSync().pixelRatio || 1;
        const width = canvasInfo.width || 320;
        const height = canvasInfo.height || 160;
        canvas.width = width * pixelRatio;
        canvas.height = height * pixelRatio;
        ctx.scale(pixelRatio, pixelRatio);
        ctx.clearRect(0, 0, width, height);

        if (chartPoints.length === 0) {
          ctx.fillStyle = "#94a3b8";
          ctx.font = "13px sans-serif";
          ctx.textAlign = "center";
          ctx.fillText("暂无趋势数据", width / 2, height / 2);
          return;
        }

        const padding = { left: 34, right: 18, top: 18, bottom: 28 };
        const chartWidth = width - padding.left - padding.right;
        const chartHeight = height - padding.top - padding.bottom;
        const minScore = Math.max(0, Math.min(...chartPoints.map((point) => point.value), 60) - 5);
        const maxScore = Math.min(100, Math.max(...chartPoints.map((point) => point.value), 100));
        const range = Math.max(1, maxScore - minScore);
        const toX = (pointIndex) => padding.left + (chartPoints.length === 1 ? chartWidth / 2 : (chartWidth * pointIndex) / (chartPoints.length - 1));
        const toY = (value) => padding.top + chartHeight - ((value - minScore) / range) * chartHeight;

        ctx.strokeStyle = "#e2e8f0";
        ctx.lineWidth = 1;
        [0, 0.5, 1].forEach((ratio) => {
          const y = padding.top + chartHeight * ratio;
          ctx.beginPath();
          ctx.moveTo(padding.left, y);
          ctx.lineTo(width - padding.right, y);
          ctx.stroke();
        });

        ctx.fillStyle = "#94a3b8";
        ctx.font = "10px sans-serif";
        ctx.textAlign = "right";
        ctx.fillText(`${maxScore}%`, padding.left - 6, padding.top + 4);
        ctx.fillText(`${minScore}%`, padding.left - 6, padding.top + chartHeight);

        ctx.strokeStyle = "#0284c7";
        ctx.lineWidth = 3;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.beginPath();
        chartPoints.forEach((point, pointIndex) => {
          const x = toX(pointIndex);
          const y = toY(point.value);
          if (pointIndex === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
        ctx.stroke();

        chartPoints.forEach((point, pointIndex) => {
          const x = toX(pointIndex);
          const y = toY(point.value);
          ctx.beginPath();
          ctx.fillStyle = "#ffffff";
          ctx.arc(x, y, 5, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = "#0284c7";
          ctx.lineWidth = 2;
          ctx.stroke();

          ctx.fillStyle = "#0f172a";
          ctx.font = "11px sans-serif";
          ctx.textAlign = "center";
          ctx.fillText(`${point.value}%`, x, Math.max(12, y - 10));
        });

        const firstPoint = chartPoints[0];
        const lastPoint = chartPoints[chartPoints.length - 1];
        ctx.fillStyle = "#64748b";
        ctx.font = "10px sans-serif";
        ctx.textAlign = "left";
        ctx.fillText(firstPoint.label, padding.left, height - 8);
        ctx.textAlign = "right";
        ctx.fillText(lastPoint.label, width - padding.right, height - 8);
      });
  }
});
