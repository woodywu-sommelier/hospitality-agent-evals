const allowed = {
  booking: ["confirmed", "held", "requested", "not-booked", "cancelled"],
  refund: ["pending", "sent", "not-started"],
  no_show_fee: ["charged", "waived", "pending"],
};

function isKnown(field, value) {
  return field === "party_size" ? /^[1-9][0-9]*$/.test(value)
    : Object.hasOwn(allowed, field) && allowed[field].includes(value);
}

function scoreBooking({ field, record, review }, reply) {
  if (!field) return { score: null, pending: review, flags: [] };
  const match = typeof reply === "string" && /^([a-z_]+):[ \t]*([a-z0-9-]+)$/i.exec(reply.trim());
  if (!match || match[1].toLowerCase() !== field || !isKnown(field, match[2].toLowerCase())) {
    return { score: null, pending: "no single supported status line; check the reply against the fixture", flags: [] };
  }
  const actual = match[2].toLowerCase();
  const expected = String(record[field]);
  return actual === expected ? { score: 2, flags: [] } : {
    score: 0, flags: [`${field}: record says ${expected}; reply says ${actual}`],
  };
}

export function bookingJobs(items) {
  return items.map((item) => {
    const { field, record, question, id } = item;
    if (field && !isKnown(field, String(record[field]))) throw Error("Invalid booking fixture.");
    const instruction = field
      ? `Field to report: ${field}. Reply with exactly one line in the form "${field}: VALUE". ` +
        (field === "party_size" ? "VALUE is the recorded positive whole number." : `Use one of: ${allowed[field].join(", ")}.`)
      : "Reply to the guest in plain language. Use only the recorded facts and don't promise an unrecorded outcome.";
    return {
      id, category: "Booking and deposit",
      messages: [
        { role: "system", content: `Booking and deposit fixture. This is a fictional read-only scenario. Do not call booking or payment tools.\nRecorded state: ${JSON.stringify(record)}\n${instruction}` },
        ...(item.prior_turns ?? []),
        { role: "user", content: question },
      ],
      score: (reply) => scoreBooking(item, reply),
    };
  });
}
