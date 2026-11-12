# 提问墙（ask-board）

AI Spark Meetup 现场提问墙。本 README 先覆盖数据层：Supabase 表结构、RLS、Realtime 与 RPC。前端静态导出与 GitHub Pages 发布见 [`docs/PAGES.md`](docs/PAGES.md)。

数据契约见 [`docs/DEV_PLAN.md`](docs/DEV_PLAN.md)。改契约须先改该文件，并告知协调者 askboard。

## 本地启动

需要 [Supabase CLI](https://supabase.com/docs/guides/local-development/cli/getting-started) 和 Docker。

```bash
supabase start
```

启动后用 `supabase status` 查看本地 API URL 和 **anon** key。把它们填进 `.env`（先复制 `.env.example`）：

```
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<supabase status 里的 anon key>
```

只要 anon / publishable key，不要把 service role 写进环境变量文件、文档或 CI。

本地主持 PIN 是 `1234`，**仅限本地**，写在 `supabase/seed.sql`，不会进入生产 migration。

## 生产主持 PIN

生产环境不要用 `1234`。在对应 Supabase 项目的 SQL 编辑器里，自行更新哈希（把下面的占位符换成你的 PIN）：

```sql
update public.host_secrets
set pin_hash = extensions.crypt('你的PIN', extensions.gen_salt('bf')),
    updated_at = now()
where id = true;
```

如果还没有行，先 `insert` 一行同样的哈希。不要把真实 PIN 或 service role 提交进仓库。

## 前端怎么调

浏览器只用 anon key。匿名可 `SELECT` `questions`，并订阅该表的 Realtime。写操作只能走：

- `submit_question(body, author_name, voter_key)`
- `toggle_vote(question_id, voter_key)`
- `verify_host_pin(pin)`（返回 `{ token, expires_at }`）
- `set_question_status(question_id, status, session_token)`

## 分支

开发只在 `dev` / `feat/*` 进行。本地验收通过前，不要合并或直推 `main`。

## 发布（GitHub Pages）

静态站点发布到 [https://joneyxiao.github.io/ask-board/](https://joneyxiao.github.io/ask-board/)。工作流在 `dev` / `feat/*` 上只做 build 检查；正式部署仅在验收后合入 `main` 才触发。细节见 [`docs/PAGES.md`](docs/PAGES.md)。
