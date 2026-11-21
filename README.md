<h1 align="center">Hacker News On This Day</h1>
<p align="center">Hacker News 历史上的今天：按 UTC 日期回溯过去 15 年每年得分最高的 5 篇帖子。</p>
<p align="center"><a href="docs/README.en.md">English</a></p>

## 这是什么

`Hacker News On This Day` 是一个面向 Hacker News 历史档案的双语（中/英）Web 应用。前端基于 Vite 与 React，后端由 Node HTTP API 通过 DuckDB 查询本地挂载的 [open-index/hacker-news](https://huggingface.co/datasets/open-index/hacker-news) 月度 Parquet 归档。

项目展示的是快照时点的 `score` 降序（同分按 `id` 升序）前 5 条非删除、非 dead 且有标题的帖子，**并非**历史首页实时排名；用户原始帖子标题保持原文不翻译。归档数据不随 Git 仓库或容器镜像分发，需单独准备并挂载；公开生产站点尚未部署。

## 功能

- **年份时间轴与趋势图**：支持年份选择器（scrubber）、时间线视图、趋势图、亮/暗主题切换与 `prefers-reduced-motion` 无障碍减弱动画。
- **双语界面**：默认跟随浏览器中/英文偏好，支持手动切换并持久化语言选择。
- **严格数据语义**：仅在闰年展示 2 月 29 日；缺失年份在界面中明确提示；整个归档不可用时返回错误而非模拟数据。
- **API 端点**：`GET /api/day?month=11&day=12` 返回各年排行；`GET /api/live` 返回进程存活状态、包版本与可选 `APP_REVISION`。

## 使用

将月度 Parquet 文件放入 `data/YYYY/YYYY-MM.parquet`（或通过 `DATA_DIR` 指定目录）后即可在本地开发模式或容器模式启动。

本地开发：

```sh
bun install --frozen-lockfile
bun run dev              # 启动前端开发服务器（127.0.0.1:7065）
```

Docker 容器构建与运行（镜像构建不依赖 `data/`，运行时以只读方式挂载）：

```sh
docker build -t hackernews-on-this-day .
docker run --rm -p 127.0.0.1:7065:7065 \
  -v "$PWD/data:/data:ro" hackernews-on-this-day
```

## 开发

开发环境需要 Node.js 24+ 与 Bun（质量门禁使用 `.mise.toml` 指定的 Node `26.13.0` 与 Bun `1.4.4`）。受限网络环境下可设置 `BUN_CONFIG_REGISTRY=https://mirrors.tencent.com/npm/` 或 Docker `--build-arg NPM_REGISTRY=https://mirrors.tencent.com/npm/`。

```sh
bun run hooks:install    # 安装 .githooks 本地 Git hooks
bun run check            # 类型检查（tsc --noEmit）与 Biome lint
bun run workflow:lint    # 校验 GitHub Actions workflow 与不可变 SHA
bun run build            # 构建前端与服务端产物（dist/）
bun run start            # 启动生产 Node 服务（node dist/server/index.js）
```

## 测试

本地测试使用临时目录中生成的合成 Parquet 数据，不读取开发归档。浏览器测试需预先安装 Playwright Chromium（`bunx playwright install chromium`）或通过 `CHROME_PATH` 指定本地 Chrome。

```sh
bun run test                 # 构建并运行全部 Vitest 测试
bun run test:coverage        # 核心 4 个文件的单元测试覆盖率（要求 >= 95%）
bun run test:deployment      # 部署与发布校验脚本测试
bun run test:integration     # 构建并在随机端口运行隔离集成测试
bun run test:browser         # 构建并在 :27065 运行 Playwright 浏览器 E2E
bun run test:container       # Docker 镜像构建与只读挂载冒烟测试
```

## 技术栈

- **前端**：React 19、TypeScript、Vite（MVVM 分层：`src/components/`、`src/viewmodels/`、`src/api/`）
- **服务端与查询**：Node.js HTTP API（`server/`）、DuckDB（`@duckdb/node-api`）
- **质量与测试**：Biome、Vitest（`@vitest/coverage-v8`）、Playwright、Docker

## 文档

- [数据目录说明](data/README.md)
- [项目契约](AGENTS.md)
- [更新日志](CHANGELOG.md)
- [复盘记录](Retrospective.md)

## 许可证

应用代码采用 [MIT](LICENSE) 许可证；Hacker News 归档数据集单独遵循 ODC-By 等原始许可协议，详见 [data/README.md](data/README.md)。
