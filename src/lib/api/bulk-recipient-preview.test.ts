import assert from "node:assert/strict";
import { test } from "node:test";
import { csvRecipientPreview, manualRecipientPreview } from "./bulk-recipient-preview.ts";

const phone = "+15555550123";
test("previews SMS, email and WhatsApp channel-specific fields without discarding recipient values", () => {
  const sms = csvRecipientPreview(`recipient,body\n${phone},Hello`, "sms", "PERSONALIZED");
  assert.equal(sms.issue, null);
  assert.deepEqual(sms.rows[0]?.fields, { recipient: phone, body: "Hello" });
  assert.deepEqual(sms.rows[0]?.errors, []);
  const email = csvRecipientPreview(
    "recipient,subject,body\nname@example.test,Subject,Body",
    "email",
    "PERSONALIZED",
  );
  assert.deepEqual(email.rows[0]?.errors, []);
  assert.equal(email.rows[0]?.fields["subject"], "Subject");
  const whatsapp = csvRecipientPreview(
    `recipient,template_key,language,variables\n${phone},approved_template,en,{}`,
    "whatsapp",
    "SHARED",
  );
  assert.deepEqual(whatsapp.rows[0]?.errors, []);
});
test("rejects wrong-channel, duplicate, missing and unknown column headers", () => {
  for (const csv of [
    "recipient,subject,body\nx,y,z",
    "recipient,recipient\nx,y",
    "body\nx",
    "recipient,extra\nx,y",
  ]) {
    assert.equal(csvRecipientPreview(csv, "sms", "PERSONALIZED").issue, "headers");
  }
  const csv = `recipient,body\n${phone},Hello`;
  assert.equal(csvRecipientPreview(csv, "email", "PERSONALIZED").issue, "headers");
});
test("supports BOM, CRLF, reordered columns, quoted commas, escaped quotes and multiline bodies", () => {
  const csv = `\uFEFFbody,recipient\r\n"Hello, ""Sara""\nNext line",${phone}\r\n\r\n`;
  const result = csvRecipientPreview(csv, "sms", "PERSONALIZED");
  assert.equal(result.issue, null);
  assert.equal(result.rows[0]?.fields["body"], 'Hello, "Sara"\nNext line');
  assert.equal(result.rows.length, 1);
});
test("rejects malformed quoting, missing fields, empty files and NUL bytes", () => {
  for (const csv of [
    "",
    "recipient,body",
    `recipient,body\n${phone}`,
    `recipient,body\n${phone},"unfinished`,
    `recipient,body\n${phone},"closed"junk`,
    `recipient,body\n${phone},bad\0`,
  ]) {
    assert.equal(csvRecipientPreview(csv, "sms", "SHARED").issue, "malformed");
  }
});
test("marks invalid recipients and per-channel missing or oversized content", () => {
  const result = csvRecipientPreview(
    `recipient,body\ninvalid,Hello\n${phone},`,
    "sms",
    "PERSONALIZED",
  );
  assert.deepEqual(result.rows[0]?.errors, ["recipient"]);
  assert.deepEqual(result.rows[1]?.errors, ["content"]);
  assert.ok(
    csvRecipientPreview(
      `recipient,body\n${phone},${"x".repeat(1601)}`,
      "sms",
      "SHARED",
    ).rows[0]?.errors.includes("content"),
  );
  assert.ok(
    csvRecipientPreview(
      `recipient,subject,body\n${phone},Subject,Body`,
      "email",
      "SHARED",
    ).rows[0]?.errors.includes("recipient"),
  );
});
test("distinguishes shared and personalized content", () => {
  const csv = `recipient,body\n${phone},First\n${phone},Second`;
  assert.ok(csvRecipientPreview(csv, "sms", "SHARED").rows[1]?.errors.includes("shared"));
  assert.deepEqual(csvRecipientPreview(csv, "sms", "PERSONALIZED").rows[1]?.errors, []);
});
test("validates WhatsApp variable objects and consistent template/language", () => {
  const result = csvRecipientPreview(
    `recipient,template_key,language,variables\n${phone},one,en,{}\n${phone},two,ar,[]`,
    "whatsapp",
    "PERSONALIZED",
  );
  assert.ok(result.rows[1]?.errors.includes("variables"));
  assert.ok(result.rows[1]?.errors.includes("template"));
});
test("enforces 1000 recipients and 2 MB without silently truncating uploaded data", () => {
  assert.equal(
    csvRecipientPreview(`recipient,body\n${`${phone},Hello\n`.repeat(1000)}`, "sms", "SHARED").rows
      .length,
    1000,
  );
  assert.equal(
    csvRecipientPreview(`recipient,body\n${`${phone},Hello\n`.repeat(1001)}`, "sms", "SHARED")
      .issue,
    "limit",
  );
  assert.equal(
    csvRecipientPreview("x".repeat(2 * 1024 * 1024 + 1), "email", "SHARED").issue,
    "limit",
  );
});
test("manual lists preserve order and duplicates, trim whitespace and revalidate for the selected channel", () => {
  const value = ` ${phone} \r\n\nname@example.test\n${phone}`;
  const sms = manualRecipientPreview(value, "sms");
  assert.equal(sms.rows.length, 3);
  assert.equal(sms.rows[2]?.fields["recipient"], phone);
  assert.deepEqual(sms.rows[1]?.errors, ["recipient"]);
  assert.deepEqual(manualRecipientPreview(value, "email").rows[1]?.errors, []);
  assert.equal(manualRecipientPreview(`${phone}\n`.repeat(1001), "sms").issue, "limit");
});
