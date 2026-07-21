import Link from "next/link";
import { requireParent } from "@/lib/auth";
import { getParentStudents, parseTags } from "@/lib/parent-data";

type ArchiveLesson = {
  id: string;
  date: Date;
  status: string;
  studentName: string;
  courseName: string;
  teacherName: string;
  subject: string;
  lessonContent: string | null;
  lessonFeedback: string | null;
  contentTags: string[];
  feedbackTags: string[];
  weakPointTags: string[];
  createdAt: Date;
  lessonVideo: {
    id: string;
    title: string | null;
    fileName: string;
    size: number;
  } | null;
  lessonAttachments: {
    id: string;
    title: string | null;
    fileName: string;
    mimeType: string;
    size: number;
  }[];
  classHomeworks: {
    id: string;
    title: string | null;
    fileName: string;
    mimeType: string;
    size: number;
  }[];
  studentAnswers: {
    id: string;
    title: string | null;
    fileName: string;
    mimeType: string;
    size: number;
  }[];
};

export default async function ParentLearningArchivePage() {
  const user = await requireParent();
  const parentStudents = await getParentStudents(user);
  const lessons = dedupeArchiveLessons(
    parentStudents.flatMap(({ student }) =>
      student.attendance.map((attendance): ArchiveLesson => ({
        id: attendance.id,
        date: attendance.date,
        status: attendance.status,
        studentName: student.name,
        courseName: attendance.schedule.course?.name || attendance.learningLink?.course?.name || "课堂",
        teacherName: attendance.learningLink?.teacher?.name || "老师",
        subject: attendance.learningLink?.subject || attendance.learningLink?.teacher?.teachingSubject || "课程",
        lessonContent: attendance.lessonContent,
        lessonFeedback: attendance.lessonFeedback,
        contentTags: parseTags(attendance.contentTags),
        feedbackTags: parseTags(attendance.feedbackTags),
        weakPointTags: parseTags(attendance.weakPointTags),
        createdAt: attendance.createdAt,
        lessonVideo: attendance.lessonVideo
          ? {
              id: attendance.lessonVideo.id,
              title: attendance.lessonVideo.title,
              fileName: attendance.lessonVideo.fileName,
              size: attendance.lessonVideo.size,
            }
          : null,
        lessonAttachments: attendance.lessonAttachments.map((attachment) => ({
          id: attachment.id,
          title: attachment.title,
          fileName: attachment.fileName,
          mimeType: attachment.mimeType,
          size: attachment.size,
        })),
        classHomeworks: (attendance.attendanceClassHomeworks || []).map((homework) => ({
          id: homework.id,
          title: homework.title,
          fileName: homework.fileName,
          mimeType: homework.mimeType,
          size: homework.size,
        })),
        studentAnswers: (attendance.attendanceStudentAnswers || []).map((answer) => ({
          id: answer.id,
          title: answer.title,
          fileName: answer.fileName,
          mimeType: answer.mimeType,
          size: answer.size,
        })),
      }))
    )
  )
    .sort((a, b) => b.date.getTime() - a.date.getTime());

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">学习档案</h1>
        <p className="mt-1 text-sm text-slate-500">按时间回看历史课堂、课堂回放、上课内容和反馈标签</p>
      </div>

      {lessons.length === 0 ? (
        <div className="glass-card rounded-xl p-10 text-center text-sm text-gray-400">暂无历史课堂记录</div>
      ) : (
        <div className="space-y-4">
          {lessons.map((lesson) => (
            <article key={lesson.id} className="glass-card rounded-xl p-4 md:p-5">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <p className="text-xs font-semibold text-sky-600">{lesson.date.toLocaleDateString("zh-CN")} · {statusLabel(lesson.status)}</p>
                  <h2 className="mt-1 text-lg font-bold text-slate-900">{lesson.courseName}</h2>
                  <p className="mt-1 text-sm text-slate-500">{lesson.studentName} · {lesson.teacherName} · {lesson.subject}</p>
                </div>
                <Link
                  href="/parent/resources"
                  className="inline-flex shrink-0 items-center justify-center rounded-md border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-500 hover:bg-slate-50"
                >
                  查看资料中心
                </Link>
              </div>

              <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(280px,0.9fr)]">
                <div className="space-y-3">
                  <InfoBlock title="上课内容" value={lesson.lessonContent || "暂无上课内容"} />
                  <InfoBlock title="上课反馈" value={lesson.lessonFeedback || "暂无上课反馈"} />
                  <TagBlock title="内容标签" tags={lesson.contentTags} />
                  <TagBlock title="反馈标签" tags={lesson.feedbackTags} />
                  <TagBlock title="薄弱点" tags={lesson.weakPointTags} />
                </div>

                <div className="space-y-3">
                <div className="rounded-lg border border-slate-100 bg-slate-50/70 p-3">
                  <p className="mb-2 text-sm font-bold text-slate-800">课堂回放</p>
                  {lesson.lessonVideo ? (
                    <div className="space-y-2">
                      <video
                        className="aspect-video w-full rounded-md bg-black"
                        controls
                        preload="none"
                        src={`/api/lesson-videos/${lesson.lessonVideo.id}/file`}
                      />
                      <p className="truncate text-xs text-slate-500">
                        {lesson.lessonVideo.title || lesson.lessonVideo.fileName} · {formatFileSize(lesson.lessonVideo.size)}
                      </p>
                    </div>
                  ) : (
                    <div className="flex aspect-video items-center justify-center rounded-md bg-white text-sm text-slate-400">
                      暂无课堂回放
                    </div>
                  )}
                </div>
                <div className="rounded-lg border border-slate-100 bg-slate-50/70 p-3">
                  <p className="mb-2 text-sm font-bold text-slate-800">课堂资料</p>
                  {lesson.lessonAttachments.length > 0 ? (
                    <div className="space-y-2">
                      {lesson.lessonAttachments.map((attachment) => (
                        <div key={attachment.id} className="rounded-md bg-white px-3 py-2 text-xs text-slate-600">
                          <p className="truncate font-semibold text-slate-700">{attachment.title || attachment.fileName}</p>
                          <p className="mt-1 text-slate-400">{formatFileSize(attachment.size)}</p>
                          <div className="mt-2 flex gap-2">
                            <a
                              href={`/api/lesson-attachments/${attachment.id}/file?mode=preview`}
                              target="_blank"
                              rel="noreferrer"
                              className="font-semibold text-sky-600 hover:text-sky-700"
                            >
                              预览
                            </a>
                            <a
                              href={`/api/lesson-attachments/${attachment.id}/file?mode=download`}
                              className="font-semibold text-slate-500 hover:text-slate-700"
                            >
                              下载
                            </a>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex min-h-24 items-center justify-center rounded-md bg-white text-sm text-slate-400">
                      暂无课堂资料
                    </div>
                  )}
                </div>
                <div className="rounded-lg border border-slate-100 bg-slate-50/70 p-3">
                  <p className="mb-2 text-sm font-bold text-slate-800">本堂作业</p>
                  {lesson.classHomeworks.length > 0 ? (
                    <div className="space-y-2">
                      {lesson.classHomeworks.map((homework) => (
                        <div key={homework.id} className="rounded-md bg-white px-3 py-2 text-xs text-slate-600">
                          <p className="truncate font-semibold text-slate-700">{homework.title || homework.fileName}</p>
                          <p className="mt-1 text-slate-400">{formatFileSize(homework.size)}</p>
                          <div className="mt-2 flex gap-2">
                            <a
                              href={`/api/attendance-class-homework/${homework.id}/file?mode=preview`}
                              target="_blank"
                              rel="noreferrer"
                              className="font-semibold text-sky-600 hover:text-sky-700"
                            >
                              预览
                            </a>
                            <a
                              href={`/api/attendance-class-homework/${homework.id}/file?mode=download`}
                              className="font-semibold text-slate-500 hover:text-slate-700"
                            >
                              下载
                            </a>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex min-h-24 items-center justify-center rounded-md bg-white text-sm text-slate-400">
                      暂无本堂作业
                    </div>
                  )}
                </div>
                <div className="rounded-lg border border-slate-100 bg-slate-50/70 p-3">
                  <p className="mb-2 text-sm font-bold text-slate-800">学生答案</p>
                  {lesson.studentAnswers.length > 0 ? (
                    <div className="space-y-2">
                      {lesson.studentAnswers.map((answer) => (
                        <div key={answer.id} className="rounded-md bg-white px-3 py-2 text-xs text-slate-600">
                          <p className="truncate font-semibold text-slate-700">{answer.title || answer.fileName}</p>
                          <p className="mt-1 text-slate-400">{formatFileSize(answer.size)}</p>
                          <div className="mt-2 flex gap-2">
                            <a
                              href={`/api/attendance-student-answer/${answer.id}/file?mode=preview`}
                              target="_blank"
                              rel="noreferrer"
                              className="font-semibold text-sky-600 hover:text-sky-700"
                            >
                              预览
                            </a>
                            <a
                              href={`/api/attendance-student-answer/${answer.id}/file?mode=download`}
                              className="font-semibold text-slate-500 hover:text-slate-700"
                            >
                              下载
                            </a>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex min-h-24 items-center justify-center rounded-md bg-white text-sm text-slate-400">
                      暂无学生答案
                    </div>
                  )}
                </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

function InfoBlock({ title, value }: { title: string; value: string }) {
  return (
    <section className="rounded-lg bg-white/70 p-3">
      <p className="text-xs font-bold text-slate-500">{title}</p>
      <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-700">{value}</p>
    </section>
  );
}

function TagBlock({ title, tags }: { title: string; tags: string[] }) {
  return (
    <section>
      <p className="text-xs font-bold text-slate-500">{title}</p>
      {tags.length === 0 ? (
        <p className="mt-1 text-xs text-slate-400">暂无标签</p>
      ) : (
        <div className="mt-1 flex flex-wrap gap-1.5">
          {tags.map((tag) => (
            <span key={tag} className="rounded-full border border-sky-100 bg-sky-50 px-2 py-1 text-xs font-semibold text-sky-700">
              {tag}
            </span>
          ))}
        </div>
      )}
    </section>
  );
}

function statusLabel(status: string) {
  if (status === "present") return "出勤";
  if (status === "makeup") return "补课";
  if (status === "absent") return "请假";
  return status;
}

function formatFileSize(size: number) {
  if (size >= 1024 * 1024) return `${(size / 1024 / 1024).toFixed(1)}MB`;
  if (size >= 1024) return `${Math.round(size / 1024)}KB`;
  return `${size}B`;
}

function dedupeArchiveLessons(lessons: ArchiveLesson[]) {
  const byLesson = new Map<string, ArchiveLesson>();

  for (const lesson of lessons) {
    const key = archiveLessonKey(lesson);
    const current = byLesson.get(key);
    if (!current || archiveLessonScore(lesson) > archiveLessonScore(current)) {
      byLesson.set(key, lesson);
    }
  }

  return [...byLesson.values()];
}

function archiveLessonKey(lesson: ArchiveLesson) {
  return [
    formatArchiveDateKey(lesson.date),
    lesson.studentName,
    lesson.courseName,
    lesson.teacherName,
    lesson.subject,
    lesson.status,
  ].join(":");
}

function archiveLessonScore(lesson: ArchiveLesson) {
  return (
    (lesson.lessonVideo ? 100 : 0) +
    (lesson.lessonAttachments.length ? 50 : 0) +
    (lesson.classHomeworks.length ? 40 : 0) +
    (lesson.studentAnswers.length ? 40 : 0) +
    (lesson.lessonContent ? 10 : 0) +
    (lesson.lessonFeedback ? 10 : 0) +
    lesson.contentTags.length +
    lesson.feedbackTags.length +
    lesson.weakPointTags.length +
    lesson.createdAt.getTime() / 100000000000000
  );
}

function formatArchiveDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
