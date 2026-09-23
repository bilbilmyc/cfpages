# Docker Hub 镜像源

这个仓库只提供公开 Docker Hub 镜像的拉取代理。现有 Cloudflare Pages 项目 `cfpages` 构建一个 `_worker.js`，由它接管 `199819.xyz` 的全部请求。旧的网站、后台、文章、图片和文件 API 已从代码中移除；根路径返回 404，镜像协议入口是 `https://199819.xyz/v2/`。

镜像源实现 Docker Registry HTTP API V2 的只读拉取路径：`GET`/`HEAD /v2/`、manifest 和 SHA-256 blob。Worker 在服务端跟随镜像层的 CDN 跳转，并流式返回数据。完整且不超过约 512 MB 的 blob 会缓存在当前 Cloudflare 数据中心。首次拉取、缓存未命中和更大的层仍依赖 Docker Hub。它不提供 push、私有镜像、完整镜像仓库或离线存储。

## 本地验证

需要 Node.js 22.12+。

```sh
npm ci
npm run check
npm run dev
```

另开终端检查 `http://127.0.0.1:8788/v2/`：

```sh
curl -i http://127.0.0.1:8788/v2/
```

预期为 `200`，带有 `Docker-Distribution-API-Version: registry/2.0`。测试覆盖只读限制、manifest 头、blob CDN 跳转、Range 和缓存。真实镜像拉取仍须在上线后用 Docker 验证。

## 上线

此仓库沿用现有 Pages 项目和 `199819.xyz` 域名，无需创建第二个 Worker 或新域名。`wrangler.jsonc` 已移除 D1/R2 绑定。完成 Cloudflare CLI 登录后，在仓库根目录运行：

```sh
npx wrangler login
npm run deploy
```

部署脚本显式指定 `main` 生产分支，因为当前工作分支不是 `main`。如果 Pages 项目通过 Git 自动部署，合并到生产分支也会替换当前站点。旧的远程 D1/R2 数据不会被代码部署删除；等镜像源通过线上验收后，再单独备份和清理这些资源。

### Docker Hub 上游配额

默认使用匿名 Docker Hub token。2026-09-23 的首次生产验收中，`199819.xyz/v2/` 已正常响应，但实际拉取 BusyBox manifest 时，Docker Hub 对 Cloudflare 共享出口返回 `TOOMANYREQUESTS`。因此要做可用的公开镜像源，需要给 Pages 的**生产环境**配置专用 Docker Hub 账号的用户名和只读 Personal Access Token：

```sh
npx wrangler pages secret put DOCKERHUB_USERNAME --project-name cfpages
npx wrangler pages secret put DOCKERHUB_TOKEN --project-name cfpages
npm run deploy
```

两次命令都会在本机交互式读取值；不要把 token 发到聊天、放进 URL 或提交到仓库。`DOCKERHUB_USERNAME` 必须是 Docker ID，不是邮箱。建议使用不拥有任何私有仓库访问权的专用账号。代码在使用账号 token 前，先检查匿名 token 是否授予该仓库的拉取权限；若 token 格式无法识别，再用 Docker Hub 的公开仓库元数据接口检查。检查失败时拒绝拉取，以免凭据把私有镜像开放给所有人。[Docker Hub 仓库查询接口](https://docs.docker.com/reference/api/hub/latest/operations/GetRepository/)

如果线上响应头显示 `X-Mirror-Upstream-Stage: token` 且返回 429，可先在本机使用相同 Docker ID 和 PAT 执行 `docker login --username <Docker ID>`。Docker Hub 认证接口可能因账号名/PAT 不匹配或共享出口 IP 上的多次失败登录而暂时阻止认证。不要通过重复提交登录请求来碰运气。

Docker Hub Personal 账号的认证配额仍有限，Pro/Team/Business 账号才有更高的公开拉取能力，并受公平使用规则约束。[Docker Hub 拉取限制](https://docs.docker.com/docker-hub/usage/pulls/) 公网开放也会消耗 Pages Functions/Workers 请求配额。建议在 Cloudflare 为该域名配置请求速率规则并监控用量。Cloudflare Cache API 按数据中心缓存，不能当作持久化仓库。[Cloudflare 缓存说明](https://developers.cloudflare.com/workers/runtime-apis/cache/) · [Workers 限制](https://developers.cloudflare.com/workers/platform/limits/)

## Docker 客户端

在 Docker Desktop 的 **Settings → Docker Engine** 中，合并以下字段到现有 JSON，然后点击 **Apply & restart**：

```json
{
  "registry-mirrors": ["https://199819.xyz"]
}
```

Linux 则合并进 `/etc/docker/daemon.json` 并重启 Docker 服务。检查：

```sh
docker info
docker pull busybox:latest
```

`docker info` 应列出 `https://199819.xyz/`。Docker 可能在镜像源故障时回退，因此还应查看 Cloudflare 请求日志，确认 `/v2/library/busybox/...` 实际到达 Pages Function。重复拉取时，blob 响应的 `X-Mirror-Cache` 可显示 `MISS` 或 `HIT`。Docker 官方的[镜像源配置说明](https://docs.docker.com/docker-hub/image-library/mirror/)可作参考。
