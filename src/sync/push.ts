// =============================================================
// src/sync/push.ts – Envío de outbox cuando hay internet
// =============================================================
import { makeClient } from "../api/client";
import { DB } from "../db/sqlite";

const queueSubmission = async (form_id: string, payload: any) => {
  const id = Math.random().toString(36).slice(2);
  await DB.exec(
    `INSERT OR REPLACE INTO pending_submission (id, form_id, payload, created_at) VALUES (?, ?, ?, datetime('now'))`,
    [id, form_id, JSON.stringify(payload)]
  );
  return id;
};

const flushOutbox = async () => {
  const api = await makeClient();
  const rows = await DB.query<{ id: string; form_id: string; payload: string }>(
    `SELECT id, form_id, payload FROM pending_submission ORDER BY created_at ASC`
  );
  for (const r of rows) {
    try {
      await api.post(`/submissions`, {
        form_id: r.form_id,
        payload: JSON.parse(r.payload),
      });
      await DB.exec(`DELETE FROM pending_submission WHERE id = ?`, [r.id]);
    } catch (e) {
      // salimos en el primer error para reintentar luego
      break;
    }
  }
};
export { flushOutbox, queueSubmission };
