import { ParentTimeManagementClient } from "@/components/parent-time-management-client";
import { requireParent } from "@/lib/auth";
import { getParentLearningLinks, learningLinkLabel } from "@/lib/learning-links";

export default async function ParentLessonsPage() {
  const user = await requireParent();
  const learningLinks = await getParentLearningLinks(user);
  const pageTitle = "时间管理";

  return (
    <ParentTimeManagementClient
      title={pageTitle}
      learningLinks={learningLinks.map((link) => ({
        id: link.id,
        studentId: link.studentId,
        studentName: link.student.name,
        subject: link.subject,
        teacherName: link.teacher.name,
        label: learningLinkLabel(link),
      }))}
    />
  );
}
