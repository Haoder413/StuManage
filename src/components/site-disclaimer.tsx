export function SiteDisclaimer({ compact = false }: { compact?: boolean }) {
  return (
    <section className={compact ? "rounded-lg border bg-slate-50 p-4 text-xs leading-6 text-slate-600" : "rounded-xl border bg-white p-6 leading-7 text-slate-700 shadow-sm"}>
      <h2 className={compact ? "mb-2 text-sm font-bold text-slate-900" : "mb-4 text-xl font-bold text-slate-900"}>免责声明</h2>
      <p>
        本网站为个人学习分享博客，本站只面向老师提供服务，仅可查看站长发布内容，全站对外公开展示的知识点动画、自编习题、学习笔记均由网站备案持有人（管理员账号）独立创作发布；注册用户仅可在个人中心存储私有学习备忘录，用户无法上传内容，用户内的数据仅本人账号可查看，无法发布、分享，网站无公开栏目，无用户公开发布、评论互动功能。
      </p>
    </section>
  );
}
