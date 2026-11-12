# 提问墙（ask-board）

AI Spark Meetup 现场提问墙。观众投稿并投票，大屏通过 Realtime 更新，主持人用 PIN 把问题标成「开放 / 正在讲 / 已回答」。

数据契约见 [`docs/DEV_PLAN.md`](docs/DEV_PLAN.md)。改契约须先改该文件，并告知协调者 askboard。

前端是 Next.js App Router 静态导出（`output: 'export'`），部署目标是 [https://joneyxiao.github.io/ask-board/](https://joneyxiao.github.io/ask-board/)。`basePath` 和 `assetPrefix` 都是 `/ask-board`。

- `/` 大屏。`/wall` 会转到这里。没有投稿表单。
- `/ask` 观众投稿（昵称可选）并投票。`voter_key` 是第一次访问时生成的 UUID，放在 `localStorage`。
- `/host` 用 `verify_host_pin` 换会话 token，放在 `sessionStorage`，再调用 `set_question_status`。

浏览器只用 anon key。写操作只走下面四个 RPC。

## 本地启动

需要 [Supabase CLI](https://supabase.com/docs/guides/local-development/cli/getting-started)、Docker 和 Node.js 20+。

```bash
supabase start
supabase status
```

把 API URL 和 **anon** key 写入 `.env`（先复制 `.env.example`）：

```
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<supabase status 里的 anon key>
```

只要这两个变量。不要把 service role 写进环境变量文件、文档或 CI。

```bash
npm install
npm run dev
```

开发地址是 [http://localhost:3000/ask-board/](http://localhost:3000/ask-board/)。静态导出会把这两个变量打进页面，改了 `.env` 之后需要重新 `npm run dev` 或 `npm run build`。

本地主持 PIN 是 `1234`，**仅限本地，禁止用于生产**。哈希写在 `supabase/seed.sql`，不会进入生产 migration。应用源码里不写 PIN。

## 静态导出

```bash
npm run build
```

产物在 `out/`。本地预览时要带上 `/ask-board` 前缀，否则脚本和样式会 404：

```bash
mkdir -p /tmp/ask-board-preview
rm -rf /tmp/ask-board-preview/ask-board
cp -r out /tmp/ask-board-preview/ask-board
npx serve /tmp/ask-board-preview
```

然后打开 [http://localhost:3000/ask-board/](http://localhost:3000/ask-board/)。GitHub Pages 的发布流程不在这个分支里。

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

匿名可 `SELECT` `questions`，并订阅该表的 Realtime。写操作只能走：

- `submit_question(body, author_name, voter_key)`
- `toggle_vote(question_id, voter_key)`
- `verify_host_pin(pin)`（返回 `{ token, expires_at }`）
- `set_question_status(question_id, status, session_token)`

`voter_key` 必须是 UUID。同一 key 每小时最多投稿 5 条。已回答的问题不能投票。标成「正在讲」时，后端会把其他「正在讲」改回开放。

## 分支

开发只在 `dev` / `feat/*` 进行。本地验收通过前，不要合并或直推 `main`。
