# Soren 的个人空间

面向 `199819.xyz` 的中文个人内容站和工具箱，使用 React、TypeScript、Vite、Cloudflare Pages Functions、R2 和 D1。

## 已实现

- 首页、文章与分类关键词搜索、Markdown 阅读、关于与隐私说明。
- 写作后台：直接输入文字、排版按钮、预览、插图、保存云端草稿、发布、更新与撤下、Markdown 导出、浏览器恢复副本。
- 首页与介绍页构建时预渲染；D1 公开文章提供完整 HTML、标题、描述、canonical、Open Graph 和动态分页 sitemap。
- 流程图：拖拽、连线、节点文字编辑、删除、缩放、JSON 导入导出、浏览器本地草稿。
- 自由画布：画笔、矩形、椭圆、颜色和线宽、撤销重做、PNG 导出、本地草稿。
- 开发工具：JSON 格式化/压缩、UTF-8 Base64、URL 参数编码、时间戳和 SHA-256。
- 站主图床：管理员鉴权、R2 上传与公开图片链接、D1 元数据、分页、复制直链/Markdown、归档和恢复。

文章由站主在 `/admin` 写作后台管理，保存在 D1，发布后立即更新，无需修改代码或重新部署。流程图和画布草稿仍保存在当前浏览器，不包含云端同步或多人协作。

## 怎么写文章

1. 打开站点左下角的“写作后台”，输入你保管的 `ADMIN_TOKEN`（与图片空间相同）。
2. 点击“新建文章”，填写标题、分类和正文。直接打字即可，空一行开始新段落。
3. 上方按钮可添加小标题、加粗、列表、引用、代码和图片；“查看预览”显示排版效果。
4. 点击“保存草稿”存到云端，仅管理员可见。准备好后点击“发布文章”，首页和文章列表会立即展示。
5. 从左侧选中已有文章可继续编辑。“保存草稿”保持旧的公开版本，点击“更新公开文章”才替换公开内容。“撤下文章”停止公开，但保留草稿。

登录密钥仅在内存中，刷新需重新登录；请保存在自己的密码管理器中，不要发到聊天里。浏览器会保留未保存文字的恢复副本，重新打开相应文章可恢复；这不替代云端保存。共享电脑上不要留下私人草稿。多个窗口同时编辑时，后台拒绝旧版本覆盖，先导出当前文字再重新打开即可处理冲突。

正文支持 Markdown，可通过“导出 Markdown”备份。插图保存至 R2，图片上传后链接就是公开的，即使文章仍是草稿也如此。

## 本地运行

要求 Node.js 22.12+。

```sh
npm ci
npm run dev
```

Vite 开发模式适合编辑前端，不提供图床和文章接口。测试完整 Pages/R2/D1 环境：

```sh
# 复制 .dev.vars.example 为 .dev.vars，然后设置本地 ADMIN_TOKEN（至少 32 字符）
npm run db:local
npm run dev:cloud
```

Wrangler 默认本地模拟 R2/D1，数据保存在 `.wrangler/state`，这些命令不会写入云端数据库。`.dev.vars` 已忽略，不要提交真实凭据。受限 Windows 环境如遇 Wrangler 日志目录权限错误，可在当前 PowerShell 设置 `$env:XDG_CONFIG_HOME="$PWD/.wrangler/config"` 后重试。

## 修改内容

- `src/config.ts`：站点名称、作者、域名与项目地址。也支持 `.env.example` 中的公开构建变量。
- 日常文章：直接使用 `/admin` 写作后台，不需要编辑仓库。
- `tokens.css`：全站设计变量。`src/styles.css`：布局和组件样式。
- `scripts/prerender.mjs`、`functions/journal/[slug].ts`、`functions/sitemap.xml.ts`：canonical / sitemap 使用 `199819.xyz`；更换域名时同步修改。

## 已创建的 Cloudflare 资源

- Pages：`cfpages`，公开预览地址 https://cfpages-7s6.pages.dev ，连接本仓库 `main` 分支自动构建。
- 自定义域 `199819.xyz` 已关联，Cloudflare 显示活动、SSL 已启用；该域名仍受原有 Cloudflare Access 应用保护，访问策略需由站主确认。
- D1：`personal-site-db`，ID `2abf91e2-f66e-4829-9fa1-b0065bf38a27`，绑定名 `DB`。
- R2：`personal-site-images`，Standard 存储类，绑定名 `IMAGES`。
- D1 已在控制台执行 `migrations/0001_initial.sql`，创建 `images` 表和分页索引。
- D1 已执行 `migrations/0002_posts.sql`，创建文章表与索引；草稿和公开快照分开保存，使用版本号防止覆盖。
- `wrangler.jsonc` 保存资源 ID 和绑定；这些是配置标识符，不是凭据。

## Pages 部署

在 Cloudflare 的 **Workers 和 Pages → 创建应用程序 → Pages → 导入 Git 仓库**，选择 `bilbilmyc/cfpages`。

1. 项目名称：`cfpages`；生产分支：`main`。
2. 框架预设：None；构建命令：`npm run build`；输出目录：`dist`；根目录保持仓库根目录。
3. 使用 Node.js 22.12+（可设置 `NODE_VERSION=22`）。提交的 Wrangler 配置会声明 D1/R2 绑定，确认部署后的绑定指向上述资源。
4. 在 **Settings → Variables and Secrets** 添加加密密钥 `ADMIN_TOKEN`，使用至少 32 字符的随机值。密钥由站主保管；不要放进 `VITE_*` 变量、代码或聊天消息中。
5. 重新部署。访问 `/api/status`，`configured: true` 表示必需绑定和密钥已存在；再登录图片空间验证实际数据库读写。
6. 在 Pages 项目的 **Custom domains** 添加 `199819.xyz`，按页面提示确认 DNS 记录并等待证书生效。需要先在 Pages 添加域名，不能只手工改 CNAME。

预览环境应使用独立资源和密钥；没有配置密钥时管理接口自动关闭。不要把生产密钥放到不可信 PR 的预览部署中。

后续表结构变更使用新增的迁移文件，审核后执行 `npx wrangler d1 migrations apply DB --remote`。第一次建表已使用幂等 SQL，在迁移记录建立前再次运行不会清空数据。

## 图床设计

管理员凭据通过 `Authorization: Bearer` 发送，只存于页面内存，刷新清除。后台使用摘要比较；未配置密钥时拒绝管理请求。查询使用绑定参数，上传按流检查大小，并按文件签名识别 PNG/JPEG/GIF/WebP。拒绝 SVG/HTML，限制单张 8 MiB。凭据比较、大小和格式检查都发生在数据写入之前。

R2 本身未开启公共存储桶。站点通过 `/images/<随机ID>.<扩展名>` 提供图片，带类型、nosniff、ETag 和一天浏览器缓存。图片访问会消耗 Functions 请求额度。如果以后访问量变大，可给专用 R2 存储桶绑定公共子域，并设置 `IMAGE_PUBLIC_BASE=https://你的图片子域`；这会使该桶内容通过子域公开。

**归档只隐藏列表条目，不删除 R2 对象、不撤销公开链接，也不会释放存储额度。**界面支持撤销最近一次归档；历史归档可通过 D1 将对应 `deleted_at` 设为 NULL 恢复。要永久撤下图片，应删除对应 R2 对象和元数据并处理缓存；此操作应由站主明确执行。

该版本适合单站主使用。新增多人登录、开放上传或高流量服务前，需要补充账号体系、流量限制和资源配额管理。

## 验证

```sh
npm run check
```

包含 TypeScript、生产构建、内容预渲染与鉴权/图片验证/工具转换测试。

本地图床集成测试只允许访问 `127.0.0.1:8788`，不接触生产资源：

```sh
# 已执行 npm run db:local 后，在一个终端运行
npx wrangler pages dev dist --port 8788 --binding ADMIN_TOKEN=test-only-secret-with-at-least-32-characters
# 另一个终端运行
npm run test:api
npm run test:posts
```

该凭据仅用于本地测试，禁止用于生产。集成测试覆盖上传、读图、HEAD、ETag、鉴权、跨域拒绝、分页参数、归档和恢复，测试图片保留在本地模拟器中并被归档。

## Cloudflare 官方规则摘要

核对日期：2026-09-06。免费额度和服务规则可能调整，以官方页面为准。

- Pages Free：500 次构建/月、单次构建最长 20 分钟、20,000 个文件、单个静态文件最大 25 MiB。Functions 计入 Workers 请求额度。[Pages limits](https://developers.cloudflare.com/pages/platform/limits/)
- `public/_routes.json` 将 `/api/*`、`/images/*`、`/journal/*` 和 `/sitemap.xml` 交给 Functions，其余页面及静态文件直接由 Pages 提供。动态文章和图片访问计入 Functions 请求额度。[Functions routing](https://developers.cloudflare.com/pages/functions/routing/)
- R2 Standard：每月免费 10 GB-month 存储、100 万次 A 类操作、1,000 万次 B 类操作，互联网出口流量免费。超额存储和操作会计费，Infrequent Access 不适用免费层。[R2 pricing](https://developers.cloudflare.com/r2/pricing/)
- D1 Workers Free：每日读 500 万行、写 10 万行、账号总存储 5 GB。按扫描行数计量，因此列表使用索引和分页。[D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/)
- Pages 支持绑定现有 R2 与 D1；生产和预览环境可以独立配置，绑定修改后需要重新部署。[Bindings](https://developers.cloudflare.com/pages/functions/bindings/)
- 已托管在 Cloudflare 的域名，可以从 Pages Custom domains 关联并配置 DNS。[Custom domains](https://developers.cloudflare.com/pages/configuration/custom-domains/)
