"use client";

import { Button } from "@/components/ui/button";

export function StudentReportPrintButton() {
  return <Button onClick={() => window.print()}>导出 PDF</Button>;
}
