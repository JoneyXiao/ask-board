export function ConfigNotice() {
  return (
    <div className="config" role="status">
      <h2>还没连上 Supabase</h2>
      <p>
        复制 <code>.env.example</code> 为 <code>.env</code>，填入 <code>supabase status</code> 里的 API URL
        和 anon key，然后重新运行。
      </p>
    </div>
  )
}
