-- 仅限本地开发的种子数据。主持 PIN 为 1234，禁止用于生产。
-- 生产环境请在 Supabase SQL 编辑器自行写入 pin_hash，不要套用本文件。

insert into public.host_secrets (id, pin_hash, updated_at)
values (true, extensions.crypt('1234', extensions.gen_salt('bf')), now())
on conflict (id) do update
set pin_hash = excluded.pin_hash,
    updated_at = now();
