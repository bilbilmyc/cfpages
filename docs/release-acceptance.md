# 部署验收与回退

本文件记录重写分支上线条件。只有目标提交的 CI、Cloudflare 预览实测和生产迁移全部通过后，才合并到自动部署的 `main`。不要把构建成功或 `/api/status` 的 `configured` 当作数据库读写验收。

## 2026-09-19 核验记录

- 上线前生产提交：`f58cdca58909fb7ddaa40518420db74009c6c419`。
- 上线前生产部署/后续回退目标：`e1738efb-59d9-4f46-a18d-4760ff0eb010`，部署地址 <https://e1738efb.cfpages-7s6.pages.dev>。生产分支为 `main`，自动部署已启用。
- 最初核验的重写预览：提交 `486c153e5222b545af5b0b8dd52a0d47eacb07e0`，部署 `cd480f3e-7677-420a-9b22-96a01f5a2e22`。该旧部署使用生产 D1/R2，缺少预览密钥：`/api/status` 为 `configured:false`，管理接口返回 503。不得向此旧部署写入测试数据。
- 生产只读 HTTP 检查：`/api/status` 为 `configured:true`，公开文章接口 200，未登录管理接口 401。
- 初次检查生产 D1 的 `sqlite_master` 仅有 `images`、`posts` 两张业务表，缺少 `tool_drafts` 和 `d1_migrations`。以前 README 中“0003 已执行”的文字与初查不符。
- 本地构建及 29 项单元测试通过；11 项 Playwright/API 测试通过，包括实际 PNG 上传、R2 字节读取、归档/恢复、私有草稿、发布/撤下、并发版本冲突、跨站拒绝和窄屏布局。
- 提交 `85d096fc834f896423dc2d764a910963f02731c0` 的 [GitHub Actions 35444986551](https://github.com/bilbilmyc/cfpages/actions/runs/35444986551) 通过，Linux 下同样完成 29 项单元测试和 11 项浏览器/API 测试。
- 加载独立预览密钥后的部署为 `5a33d028-ca3c-4cf8-b300-1c4f3e89e9dd`，地址 <https://5a33d028.cfpages-7s6.pages.dev>，提交为 `85d096f`。Cloudflare 控制台确认其预览 D1/R2 指向下面的独立资源。
- 该真实预览的 API 验收已通过：正确/错误凭据、跨站拒绝、图片上传/字节读取/HEAD/ETag/归档/恢复、私有文章与公开快照、发布/更新/撤下、SSR 与 sitemap、流程图并发冲突，以及画布形状保存/新请求读取/旧 revision 拒绝。测试仅写入独立预览资源，文章最终撤下，图片最终归档。
- Chrome 中实际确认预览登录成功，保存并发布“云端浏览器验收 2026-09-19”，从未登录会话读取公开文章；再次保存私有修改后，公开正文仍为原内容。样本 slug 为 `note-d34cc954-88c2-4706-bb2f-301fbe08475e`。
- 浏览器测试文章随后已撤下，公开 API 返回 404，后台保留草稿。云端图片通过 API 上传后在浏览器图片管理中可见，归档后条目消失，撤销归档后原链接恢复，测试结束再次归档。Chrome 扩展未启用本地文件 URL 访问，自动文件选择被拒绝；云端上传由 API 验证，实际上传控件由本地及 CI Playwright 验证，不将其记作云端浏览器文件选择通过。
- 生产迁移前只读查询确认 `images=0`、`posts=0`，业务 schema 与 `0001`/`0002` 一致。已保存空库业务 schema 备份至本机忽略目录 `artifacts/production-before-release.sql`，并在内存 SQLite 中恢复两张表及三个索引验证成功。SHA-256：`b20a68ac672ab57d3cfe1f27530c3fe3fc9d46232e2822bd3e853c11c4cdbc79`。这是经核查的空业务库结构备份，不是包含 Cloudflare 内部表的完整 D1 导出。
- 预览接口及文章浏览器验收通过后，生产控制台已执行与 `0003_tool_drafts.sql` 相同的幂等建表 SQL；再次查询确认 `images=0`、`posts=0`、`tool_drafts=0`。没有修改既有表或生产 R2 对象。生产与预览均通过控制台执行 SQL，Wrangler 迁移账本仍未注册，后续可在核验 schema 后使用幂等 migrations apply 注册。

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
8. 预览通过后，生产执行迁移前保存 D1 导出和新的 Time Travel bookmark；若已逐表确认业务数据为空，可保存并验证现有业务 schema 备份。只读核对 `sqlite_master`/索引，确认现有建表定义与迁移兼容，再补 `0003` 或用 Wrangler 注册全部幂等迁移。不得通过删除旧表重建来注册历史迁移。
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

2026-09-19 约 21:18（Asia/Shanghai）迁移前只读取得的生产 bookmark：`00000096-00000000-000050eb-880387c99a597f5659033da41b3f9eb8`。此书签受账号恢复窗口限制，后续上线前必须重新取得，不是长期备份。本轮只在本地验证空业务库 schema 恢复，未执行生产 Time Travel 或部署回滚。

参考：[Pages 环境覆盖](https://developers.cloudflare.com/pages/functions/wrangler-configuration/)、[Pages 回退](https://developers.cloudflare.com/pages/configuration/rollbacks/)、[D1 Time Travel](https://developers.cloudflare.com/d1/reference/time-travel/)。
