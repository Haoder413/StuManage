"use client";

import { ResourceCenter } from "@/components/resource-center";
import type { CourseOption } from "@/types/resource-library";

export function ParentResourceLibrary({ courses }: { courses: CourseOption[] }) {
  return <ResourceCenter role="parent" courses={courses} />;
}
