# GitHub Pages 发布

站点默认地址：[https://joneyxiao.github.io/ask-board/](https://joneyxiao.github.io/ask-board/)。这是项目站，前端需要把 `basePath` 和 `assetPrefix` 设为 `/ask-board`。构建时，官方 `actions/configure-pages` 也会按站点路径注入 `basePath`，并关闭静态导出不支持的服务端图片优化。

只部署 `next build` 生成的静态目录 `out/`，不运行 Next 服务端。

## 何时构建、何时上线

- 推到 `dev`、`feat/*`，或向 `dev` 开 PR：工作流只做 **build 检查**（安装依赖、静态导出、确认有 `out/`），**不会**发布到 Pages。
- **正式部署只在验收通过并合并到 `main` 之后**，由 `main` 的 push 触发 `actions/deploy-pages`。不要在验收前把生产部署对准并合入 `main`。

工作流文件：`.github/workflows/pages.yml`。使用官方 Actions：`actions/configure-pages`、`actions/upload-pages-artifact`、`actions/deploy-pages`。

前端尚未落到分支上时（没有 `package.json`），build 检查会跳过，避免空跑失败。前端就绪后，仓库里需要有 `package.json`，以及 `package-lock.json` 或 `yarn.lock`；`next.config` 必须设置 `output: 'export'`，构建产物为 `out/`。

## 仓库变量

在仓库 **Settings → Secrets and variables → Actions → Variables** 中配置（不要放进 Secrets，也不要写进 workflow 文件）：

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

构建只允许注入这两个值。

**禁止：**

- 把 Supabase service role key 写入 GitHub Secrets、Variables 或任何 workflow / 文档。
- 把主持 PIN 写入 CI（Secrets、Variables 或工作流）。

## 仓库设置

本仓库的 GitHub Pages 源应设为 **GitHub Actions**：

1. 打开 [Settings → Pages](https://github.com/JoneyXiao/ask-board/settings/pages)。
2. Build and deployment → Source 选择 **GitHub Actions**。

如果首次部署时环境 `github-pages` 有保护规则，需要允许从 `main` 部署。

## 分支约定

发布相关改动从 `dev` 拉 `feat/pages-deploy`，PR 回 `dev`。本地验收通过前，不要合并到 `main`，也不要向 `main` 开生产部署 PR。
