import { readFileSync } from "node:fs";

// A local fixture reader, not a booking agent. It never calls a tool or a model.
const { messages } = JSON.parse(readFileSync(0, "utf8"));
const context = messages?.[0]?.role === "system" ? messages[0].content : "";
const unknown = "I don't have a reliable booking record. Please ask the restaurant team to check.";

function replyFromFixture(text) {
  if (typeof text !== "string" || !text.startsWith("Booking and deposit fixture. ")) return unknown;
  const recordLine = /^Recorded state: (.+)$/m.exec(text)?.[1];
  if (!recordLine) return unknown;
  const record = JSON.parse(recordLine);
  if (!record || typeof record !== "object" || Array.isArray(record)) return unknown;

  const field = /^Field to report: (booking|refund|no_show_fee|party_size)\./m.exec(text)?.[1];
  if (field) {
    const value = record[field];
    if (field === "party_size" ? Number.isSafeInteger(value) && value > 0
      : typeof value === "string" && /^[a-z]+(?:-[a-z]+)*$/.test(value)) return `${field}: ${value}`;
    return unknown;
  }
  if (Object.hasOwn(record, "duplicate_charge")) {
    return "I'm sorry this is unclear. Please ask the restaurant team to check the charges. I can't promise a reversal.";
  }
  if (Object.hasOwn(record, "access_at_larger_table")) {
    const original = record.booking === "confirmed" && Number.isSafeInteger(record.party_size) && record.party_size > 0
      ? `The current booking is still for ${record.party_size}. ` : "";
    return `${original}Please ask the restaurant team to check step-free access and whether the larger table is available.`;
  }
  return unknown;
}

process.stdout.write(JSON.stringify({ reply: replyFromFixture(context) }));
