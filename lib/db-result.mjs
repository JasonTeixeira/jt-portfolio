// Unwrap a supabase-js result, THROWING on error.
//
// supabase-js resolves (never rejects) with { data, error }. The DB layers wrap
// their calls in a guard() try/catch, so a query that only reads `r.data` makes a
// FAILED query look like a success (data:null, error ignored) — a write that never
// persisted returns ok:true. Routing every result through these helpers turns a DB
// error back into a thrown error, which guard() catches as { ok:false, error }.

function orThrow(r) {
  if (r && r.error) {
    const e = r.error;
    throw new Error(e.message || e.details || e.code || 'db_error');
  }
  return r;
}

// first row of an array result (.insert().select(), .update().select()) or null
export function first(r) { orThrow(r); return (r && r.data && r.data[0]) || null; }
// the raw data as-is: a single object (.maybeSingle()), null, or whatever was selected
export function rows(r) { orThrow(r); return (r && r.data) || null; }
// an array result, never null (list queries)
export function list(r) { orThrow(r); return (r && r.data) || []; }
