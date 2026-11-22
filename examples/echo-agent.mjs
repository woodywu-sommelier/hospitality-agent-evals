import { readFileSync } from "node:fs";

const { messages } = JSON.parse(readFileSync(0, "utf8"));
if (!Array.isArray(messages) || !messages.length) process.exit(1);
const question = messages.at(-1).content;
const reply = question.includes("2012") && question.includes("Yquem")
  ? "Château d'Yquem 2012 is a Sauternes with notes of apricot."
  : messages[0].role === "system"
    ? "The tasting menu costs $999."
    : "I'd need to check that first.";
process.stdout.write(JSON.stringify({ reply }));
