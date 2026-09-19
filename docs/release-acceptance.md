# 部署验收与回退

本文件记录重写分支上线条件。只有目标提交的 CI、Cloudflare 预览实测和生产迁移全部通过后，才合并到自动部署的 `main`。不要把构建成功或 `/api/status` 的 `configured` 当作数据库读写验收。

## 2026-09-19 核验记录

- 当前生产提交：`f58cdca58909fb7ddaa40518420db74009c6c419`。
- 当前生产部署/后续回退目标：`e1738efb-59d9-4f46-a18d-4760ff0eb010`，部署地址 <https://e1738efb.cfpages-7s6.pages.dev>。生产分支为 `main`，自动部署已启用。
- 最初核验的重写预览：提交 `486c153e5222b545af5b0b8dd52a0d47eacb07e0`，部署 `cd480f3e-7677-420a-9b22-96a01f5a2e22`。该旧部署使用生产 D1/R2，缺少预览密钥：`/api/status` 为 `configured:false`，管理接口返回 503。不得向此旧部署写入测试数据。
- 生产只读 HTTP 检查：`/api/status` 为 `configured:true`，公开文章接口 200，未登录管理接口 401。
- 生产 D1 的 `sqlite_master` 实测仅有 `images`、`posts` 两张业务表，**没有 `tool_drafts` 和 `d1_migrations`**。以前 README 中“0003 已执行”的文字与实测不符；以本记录和再次实时查询为准。
- 本地构建及 29 项单元测试通过；11 项 Playwright/API 测试通过，包括实际 PNG 上传、R2 字节读取、归档/恢复、私有草稿、发布/撤下、并发版本冲突、跨站拒绝和窄屏布局。

## 预览资源隔离

`wrangler.jsonc` 顶层保留生产绑定，`env.preview` 显式覆盖全部 D1/R2 绑定。示例配置也要求独立资源。Cloudflare 使用仓库配置，必须重新部署后再检查实际绑定。

- 生产 D1：`personal-site-db` / `2abf91e2-f66e-4829-9fa1-b0065bf38a27`。
- 生产 R2：`personal-site-images`。
- 独立预览 D1：`personal-site-preview-db` / `1fec44f7-5554-4fbf-8762-40d1285cde8b`。
- 独立预览 R2：`personal-site-preview-images`，保持私有，通过 Pages 图片路由读取。
- 2026-09-19 已创建上述独立预览资源，通过预览 D1 控制台执行三份迁移 SQL 并查询确认 `images`、`posts`、`tool_drafts` 和三个业务索引存在；未建立 Wrangler 迁移账本。
- 预览单独设置加密的 `ADMIN_TOKEN`（至少 32 字符），不复用生产值，不提交到代码、PR、截图或日志，不使用本地公开测试密钥。

## 迁移与发布顺序

1. 记录这次待验收提交 SHA、唯一部署 URL、生产回退部署 ID。分支别名会移动，验收结果必须绑定具体提交。
2. 验证预览 D1/R2 资源与生产不同，设置预览密钥并重新部署。只对独立预览运行写入测试。
3. 新预览库按顺序执行 `migrations/0001_initial.sql`、`0002_posts.sql`、`0003_tool_drafts.sql`。通过控制台执行 SQL 不会自动创建 Wrangler 迁移账本；“表已存在”和“迁移记录已注册”要分别记录。
4. 登录验证：错误密钥被拒绝；正确密钥进入后台；刷新重新登录；不登录不能读取后台、图片库及工具云草稿。
5. 图片验证：上传浏览器可解码 PNG，公开链接读回原始字节、HEAD/ETag 正常；归档隐藏条目但保留链接，恢复后刷新仍存在。
6. 文章验证：新建私有草稿，公开 API/文章路由不可读；发布后可读；保存新的私有修改不改变公开快照；撤下后返回 404。测试文章最终留作未发布草稿。
7. 工具云草稿：流程图和画布保存后从另一浏览器会话连接读取；旧 revision 写入返回 409，不能覆盖新内容。
8. 预览通过后，生产执行迁移前保存 D1 导出和新的 Time Travel bookmark。只读核对 `sqlite_master`/索引，确认现有建表定义与迁移兼容，再补 `0003` 或用 Wrangler 注册全部幂等迁移。不得通过删除旧表重建来注册历史迁移。
9. 确认生产 `tool_drafts` 存在、旧文章/图片数据仍完整，目标提交的 CI 全绿后合并。等待生产部署完成，再核对部署 SHA、首页、公开文章/图片及未登录 401，最后验证站主登录与云保存。

已登录 Wrangler 时可使用以下命令；含 `--remote` 的命令会访问真实云资源，先核对环境：

```sh
# 预览：必须使用 env.preview
npx wrangler d1 migrations list DB --env preview --remote
npx wrangler d1 migrations apply DB --env preview --remote

# 生产：顶层 DB 为生产库。先备份，再进行单独的生产迁移
npx wrangler d1 export DB --remote --output artifacts/production-before-release.sql
npx wrangler d1 time-travel info DB
npx wrangler d1 migrations list DB --remote
npx wrangler d1 migrations apply DB --remote
```

导出包含私有数据，放在被忽略的 `artifacts/`，复制到站主控制的安全备份位置；不要上传为 CI artifact。远程未登录时使用控制台核查，不把本地迁移结果写成远程已完成。

## 回退

应用回退：Pages → cfpages → 部署 → 对指定的成功生产部署选择“回滚到此部署”。本次基线为 `e1738efb-59d9-4f46-a18d-4760ff0eb010`。预览部署不能成为生产回退目标。随后在 Git 中 revert 对应上线提交并正常合入，防止后续自动部署再次发布问题版本。

`0003` 仅新增工具草稿表，旧应用不使用它。应用回退时保留该表和数据，不执行 DROP TABLE，不删除 R2 对象。Pages 回退本身不恢复 D1 或 R2 内容。

只有确认数据库内容损坏时才考虑 D1 Time Travel：先暂停写入、备份当前库，再选择已记录的时间点恢复。恢复会覆盖那个时间点以后的数据，不能作为普通应用回退步骤。记录恢复操作返回的前一书签，以便撤销恢复。R2 需要单独的对象备份，D1 导出/Time Travel 不包含图片字节。

2026-09-19 约 21:07（Asia/Shanghai）只读取得的生产 bookmark：`00000093-00000000-000050eb-085f6beb1a54848ffa5b8420725b8605`。此书签受账号恢复窗口限制，真正上线前必须重新取得，不是长期备份。本轮未执行恢复演练或生产回滚。

参考：[Pages 环境覆盖](https://developers.cloudflare.com/pages/functions/wrangler-configuration/)、[Pages 回退](https://developers.cloudflare.com/pages/configuration/rollbacks/)、[D1 Time Travel](https://developers.cloudflare.com/d1/reference/time-travel/)。
