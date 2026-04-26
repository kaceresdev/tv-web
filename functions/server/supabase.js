const config = require("./variables");
const { createClient } = require("@supabase/supabase-js");

let supabaseClient;
let supabaseLastUrl = "";
let supabaseLastSecret = "";

function getSupabase() {
  const url = config.supabaseUrl;
  const publishable = config.supabasePublishableKey;
  const secret = config.supabaseSecretKey;
  if (!url || !publishable || !secret) return null;
  if (!supabaseClient || supabaseLastUrl !== url || supabaseLastSecret !== secret) {
    supabaseClient = createClient(url, secret, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    supabaseLastUrl = url;
    supabaseLastSecret = secret;
  }
  return supabaseClient;
}

/** Solo dígitos para columnas bigint (p. ej. `mobile` en `Users`). */
function parseMobileBigint(mobile) {
  if (mobile === undefined || mobile === null) return 0;
  const digits = String(mobile).replace(/\D/g, "");
  if (!digits) return 0;
  const n = Number(digits.slice(-15));
  return Number.isFinite(n) ? n : 0;
}

/** `code` del pedido como bigint PK en `Users`. */
function resolveOrderCodeBigint(code) {
  if (code === undefined || code === null || code === "") return null;
  const tryNum = (v, digitsOnly) => {
    const s = String(v).trim();
    const raw = digitsOnly ? s.replace(/\D/g, "") : s.replace(/\s/g, "");
    if (!raw) return null;
    const n = Number(digitsOnly ? raw : raw);
    return Number.isFinite(n) && !Number.isNaN(n) && n >= 0 ? Math.trunc(n) : null;
  };
  return tryNum(code, false) ?? tryNum(code, true);
}

/** Convierte texto de fecha de la web a YYYY-MM-DD para Postgres date */
function parseExpirationDateForDb(text) {
  if (!text || !String(text).trim()) {
    return new Date().toISOString().slice(0, 10);
  }
  const trimmed = String(text).trim();
  const dmy = trimmed.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})/);
  if (dmy) {
    const dd = dmy[1].padStart(2, "0");
    const mm = dmy[2].padStart(2, "0");
    return `${dmy[3]}-${mm}-${dd}`;
  }
  const iso = trimmed.match(/^(\d{4}-\d{2}-\d{2})/);
  if (iso) return iso[1];
  const parsed = new Date(trimmed);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  return new Date().toISOString().slice(0, 10);
}

async function saveUsersRowToSupabase(row) {
  const codeVal = row.code != null ? Number(row.code) : NaN;
  if (!Number.isFinite(codeVal)) {
    console.warn("⚠️ code inválido (PK bigint); no se escribe en Supabase.");
    return { saved: false, error: "code inválido o ausente: clave primaria requerida" };
  }
  const supabase = getSupabase();
  if (!supabase) {
    console.warn("⚠️ Supabase no configurado (SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY y SUPABASE_SECRET_KEY); no se guarda en BD.");
    return { saved: false, error: "Supabase no configurado" };
  }
  const rowToSend = { ...row, code: codeVal };
  const { error } = await supabase.from("Users").upsert(rowToSend, { onConflict: "code" });
  if (error) {
    console.error("❌ Error guardando en Supabase Users:", error);
    return { saved: false, error: error.message };
  }
  console.log("✅ Fila guardada en Supabase Users (code=%s)", codeVal);
  return { saved: true };
}

module.exports = {
  getSupabase,
  parseMobileBigint,
  resolveOrderCodeBigint,
  parseExpirationDateForDb,
  saveUsersRowToSupabase,
};
