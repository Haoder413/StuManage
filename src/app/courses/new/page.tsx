"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";

export default function NewCoursePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [type, setType] = useState("fixed");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const form = new FormData(e.currentTarget);
    const data = {
      name: form.get("name") as string,
      description: form.get("description") as string,
      type,
    };

    try {
      const res = await fetch("/api/courses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (res.ok) router.push("/courses");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <PageHeader title="新增课程" description="创建一个新的课程" />
      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-4 max-w-md">
            <div>
              <Label htmlFor="name">课程名称</Label>
              <Input id="name" name="name" required placeholder="如：初一数学培优班" />
            </div>
            <div>
              <Label htmlFor="description">描述</Label>
              <Input id="description" name="description" placeholder="课程简要说明" />
            </div>
            <div>
              <Label>类型</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="fixed">固定课程</SelectItem>
                  <SelectItem value="custom">定制课程</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-3">
              <Button type="submit" disabled={loading}>保存</Button>
              <Button type="button" variant="outline" onClick={() => router.back()}>取消</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
