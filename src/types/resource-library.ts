export type CourseOption = { id: string; name: string; workspaceId: string };
export type WorkspaceOption = { id: string; name: string };

export type ResourceGroupFileItem = {
  id: string;
  originalName: string;
  extension: string;
  mimeType: string;
  size: number;
  role: "student" | "answer" | "supplement";
  createdAt: string;
  canPreview: boolean;
  canDownload: boolean;
};

export type ResourceGroupItem = {
  id: string;
  title: string;
  description: string | null;
  grade: string | null;
  year: number | null;
  subject: string | null;
  resourceKind: "paper" | "animation" | "material";
  totalSize: number;
  infoNeedsReview: boolean;
  workspaceId: string;
  createdAt: string;
  updatedAt: string;
  createdByName: string;
  canManage: boolean;
  tags: Array<{ id: string; name: string }>;
  courses: Array<{ id: string; name: string }>;
  files: ResourceGroupFileItem[];
};

export type ResourceGroupPage = {
  items: ResourceGroupItem[];
  total: number;
  page: number;
  pageSize: number;
  hasNextPage: boolean;
};
