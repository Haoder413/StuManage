import { SiteDisclaimer } from "@/components/site-disclaimer";
import { IcpFooter } from "@/components/icp-footer";
import { listPublicMaterials, PublicMaterial } from "@/lib/public-materials";

export const metadata = {
  title: "资料中心 - 个人学习分享博客",
};

export default async function PublicHomePage() {
  const materials = await listPublicMaterials();

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <SiteDisclaimer />

        <section className="rounded-xl border bg-white p-6 shadow-sm">
          <div className="mb-5">
            <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">资料中心</h1>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {materials.length === 0 ? (
              <p className="col-span-full py-8 text-center text-sm text-slate-400">
                暂无公开资料
              </p>
            ) : materials.map((material) => (
              <PublicMaterialCard key={material.name} material={material} />
            ))}
          </div>
        </section>

        <IcpFooter />
      </div>
    </main>
  );
}

function PublicMaterialCard({ material }: { material: PublicMaterial }) {
  const canPreview = material.extension !== ".doc" && material.extension !== ".docx";

  return (
    <article className="overflow-hidden rounded-lg border bg-white shadow-sm transition-all hover:shadow-md">
      <PublicMaterialThumbnail material={material} />

      <div className="space-y-4 p-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-semibold text-slate-900">{material.title}</h2>
            <span className="rounded-full bg-sky-50 px-2 py-0.5 text-xs font-semibold text-sky-700">
              {materialTypeLabel(material.type)}
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-500">{material.name}</p>
          <p className="mt-1 text-xs text-slate-400">
            {formatExtension(material.extension)} · {formatSize(material.size)}
          </p>
        </div>

        <div className="flex gap-2">
          {canPreview ? (
            <a
              className="inline-flex rounded-md border px-3 py-1.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              href={material.previewUrl}
              target="_blank"
            >
              预览
            </a>
          ) : (
            <span className="inline-flex rounded-md border px-3 py-1.5 text-sm font-semibold text-slate-300">
              预览
            </span>
          )}
          <a
            className="inline-flex rounded-md bg-sky-600 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-sky-700"
            href={material.downloadUrl}
          >
            下载
          </a>
        </div>
      </div>
    </article>
  );
}

function PublicMaterialThumbnail({ material }: { material: PublicMaterial }) {
  if (material.type === "animation") {
    return (
      <div className="aspect-[16/9] overflow-hidden border-b bg-slate-100">
        <iframe
          className="h-full w-full scale-[0.72] border-0 bg-white"
          sandbox="allow-scripts"
          src={material.previewUrl}
          title={`${material.title} 缩略图`}
        />
      </div>
    );
  }

  if ([".png", ".jpg", ".jpeg", ".webp"].includes(material.extension)) {
    return (
      <div className="aspect-[16/9] overflow-hidden border-b bg-slate-100">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="h-full w-full object-cover" src={material.previewUrl} alt={material.title} />
      </div>
    );
  }

  return (
    <div className="aspect-[16/9] border-b bg-gradient-to-br from-sky-50 to-slate-100 p-4">
      <div className="flex h-full items-center justify-center rounded-md border border-white/70 bg-white/70">
        <div className="text-center">
          <p className="text-2xl font-bold text-slate-700">{formatExtension(material.extension)}</p>
          <p className="mt-1 text-xs text-slate-400">{materialTypeLabel(material.type)}</p>
        </div>
      </div>
    </div>
  );
}

function formatSize(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

function formatExtension(extension: string) {
  return extension.replace(".", "").toUpperCase();
}

function materialTypeLabel(type: PublicMaterial["type"]) {
  if (type === "animation") return "动画";
  if (type === "paper") return "习题";
  return "资料";
}
