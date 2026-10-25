import assert from "node:assert/strict";
import path from "node:path";
import { readFile, writeFile } from "node:fs/promises";
import { workbookFixture } from "./bulk-workbook-fixture.mjs";

/** Real browser interactions against the parent harness's GET-only local fixtures. */
export async function runBulkJobsChecks(h) {
  const {
    evaluate,
    click,
    navigate,
    contains,
    button,
    combo,
    option,
    send,
    screenshot,
    passed,
    waitFor,
    artifacts,
    downloads,
    tenant,
    en,
    ar,
    setRole,
  } = h;
  const disabled = (dictionary = en) =>
    evaluate(`${button(dictionary["humanSend.review"])}.disabled`);
  const menuItem = (label) =>
    `[...document.querySelectorAll('[role=menuitem]')].find(e=>e.textContent.trim()===${JSON.stringify(label)})`;
  async function fill(selector, value) {
    await click(selector);
    await evaluate(`${selector}.select()`);
    await send("Input.insertText", { text: value });
  }
  async function upload(name, contents) {
    await waitFor(
      () =>
        evaluate(
          "!!document.querySelector('input[type=file]') && !document.querySelector('input[type=file]').disabled",
        ),
      "upload input ready",
    );
    const file = path.join(artifacts, name);
    await writeFile(file, contents);
    const root = await send("DOM.getDocument");
    const input = await send("DOM.querySelector", {
      nodeId: root.root.nodeId,
      selector: 'input[type="file"]',
    });
    await send("DOM.setFileInputFiles", { nodeId: input.nodeId, files: [file] });
  }
  async function select(label, prefix) {
    await waitFor(() => evaluate(`!!${combo(label)}`), `selector: ${label}`);
    await click(combo(label));
    await waitFor(() => evaluate(`!!${option(prefix)}`), `choice: ${prefix}`);
    await click(option(prefix));
    await waitFor(
      () => evaluate("document.querySelectorAll('[role=option]').length===0"),
      "choice closed",
    );
  }
  async function closeReview() {
    await click(button(en["common.cancel"]));
    await waitFor(
      () => evaluate("document.querySelectorAll('[role=dialog]').length===0"),
      "review fully closed",
    );
  }
  async function create(dictionary = en) {
    await navigate(`/messages/bulk?tenantId=${tenant}`);
    await contains(dictionary["bulkHistory.title"]);
    await click(button(dictionary["humanBulk.title"]));
    await contains(dictionary["humanBulk.subtitle"]);
    await select(dictionary["common.application"], "Fixture submission application");
    await select(dictionary["msg.senderIdentity"], "Fixture SMS sender");
  }

  await navigate(`/messages/bulk?tenantId=${tenant}`);
  await contains(en["bulkHistory.title"]);
  assert.equal(
    await evaluate(
      `document.querySelector('h1').parentElement.parentElement.contains(${button(en["humanBulk.title"])})`,
    ),
    true,
  );
  passed("create button belongs to the Bulk Jobs page heading");
  await click(button(en["humanBulk.downloadSample"]));
  await waitFor(
    () => evaluate("document.querySelectorAll('[role=menuitem]').length===3"),
    "three download options",
  );
  for (const key of ["sms", "email", "whatsapp"])
    assert.equal(await evaluate(`!!${menuItem(en[`humanBulk.sample.${key}`])}`), true);
  await click(menuItem(en["humanBulk.sample.sms"]));
  const workbook = await waitFor(async () => {
    try {
      return await readFile(path.join(downloads, "bulk-sms-sample.xlsx"));
    } catch {
      return false;
    }
  }, "SMS workbook download");
  assert.equal(workbook.readUInt32LE(0), 0x04034b50);
  await waitFor(
    () => evaluate("document.querySelectorAll('[role=menuitem]').length===0"),
    "SMS menu closed",
  );
  await click(button(en["humanBulk.downloadSample"]));
  await waitFor(
    () => evaluate("document.querySelectorAll('[role=menuitem]').length===3"),
    "sample menu reopened",
  );
  await evaluate(
    "Promise.allSettled(document.querySelector('[role=menu]').getAnimations().map(a=>a.finished))",
  );
  await click(menuItem(en["humanBulk.sample.email"]));
  await waitFor(async () => {
    try {
      return (await readFile(path.join(downloads, "bulk-email-sample.csv"), "utf8")).includes(
        "recipient,subject,body",
      );
    } catch {
      return false;
    }
  }, "Email CSV download");
  passed("exactly three sample options; SMS XLSX and Email CSV download in the browser");

  await create();
  assert.equal(await disabled(), true);
  await fill("document.querySelector('#bulk-add-recipient')", "+15550000000");
  await click(button(en["bulkPreview.add"]));
  await contains("+15550000000");
  await fill("document.querySelector('#bulk-add-recipient')", "invalid-recipient");
  await click(button(en["bulkPreview.add"]));
  await contains(en["bulkPreview.error.recipient"]);
  assert.equal(await disabled(), true);
  await click(
    `[...document.querySelectorAll('button')].find(e=>e.getAttribute('aria-label')===${JSON.stringify(en["bulkPreview.remove"].replace("{row}", "2"))})`,
  );
  await waitFor(
    () =>
      evaluate(
        `!document.body.innerText.includes(${JSON.stringify(en["bulkPreview.error.recipient"])})`,
      ),
    "invalid row removed",
  );
  await fill(
    "document.querySelector('#human-message-body')",
    "Synthetic bulk fixture; never submitted",
  );
  await waitFor(async () => !(await disabled()), "manual review available");
  passed("manual recipient add/remove and invalid-row validation");

  await click("document.querySelector('details summary')");
  await fill(
    "document.querySelector('details textarea')",
    Array.from({ length: 15 }, (_, i) => `+15550000${String(i + 1).padStart(3, "0")}`).join("\n"),
  );
  await click(button(en["bulkPreview.addList"]));
  assert.equal(await evaluate("document.querySelector('table tbody').rows.length"), 10);
  await click(
    `[...document.querySelectorAll('nav button')].find(e=>e.textContent.includes(${JSON.stringify(en["common.next"])}))`,
  );
  await waitFor(
    () => evaluate("document.querySelector('table tbody').rows.length===6"),
    "second recipient page",
  );
  await screenshot("bulk-manual-pagination");
  await click(button(en["bulkPreview.clear"]));
  await fill("document.querySelector('#bulk-add-recipient')", "+15550000000");
  await click(button(en["bulkPreview.add"]));
  await click(button(en["humanSend.review"]));
  await contains(en["humanBulk.confirmNote"]);
  assert.equal(
    await evaluate("document.querySelector('[role=dialog] table tbody').rows.length"),
    1,
  );
  assert.equal(await evaluate(`${button(en["humanBulk.create"])}.disabled`), true);
  await click("document.querySelector('#human-message-ack')");
  await waitFor(
    () => evaluate(`!${button(en["humanBulk.create"])}.disabled`),
    "acknowledged review without submitting",
  );
  await screenshot("bulk-manual-confirmation");
  await closeReview();
  passed("manual paste pagination and table-based confirmation preserve explicit acknowledgement");

  await click("document.querySelector('#human-bulk-csv')");
  await upload("wrong-channel.csv", "recipient,subject,body\ncustomer@example.test,Subject,Body");
  await contains(en["bulkPreview.issue.headers"]);
  assert.equal(await disabled(), true);
  await upload("malformed.csv", 'recipient,body\n+15550000000,"Unclosed');
  await contains(en["bulkPreview.issue.malformed"]);
  assert.equal(await disabled(), true);
  await upload("invalid-recipient.csv", "recipient,body\nwrong,Body");
  await contains(en["bulkPreview.error.recipient"]);
  assert.equal(await disabled(), true);
  passed("wrong-channel, malformed CSV and invalid recipients block review");

  const validCsv =
    'recipient,body\r\n+15550000000,"First, synthetic fixture"\r\n+15550000001,"Second\nline fixture"';
  await upload("valid-sms.csv", validCsv);
  await contains("First, synthetic fixture");
  await waitFor(async () => !(await disabled()), "CSV ready for review");
  assert.equal(await evaluate("document.querySelector('table tbody').rows.length"), 2);
  await click(button(en["humanSend.review"]));
  await contains(en["humanBulk.confirmNote"]);
  assert.equal(
    await evaluate("document.querySelector('[role=dialog] table tbody').rows.length"),
    2,
  );
  await screenshot("bulk-csv-confirmation");
  await closeReview();
  passed("quoted commas, multiline CSV and CSV confirmation render as recipient tables");

  await select(en["humanBulk.csvMode"], en["humanBulk.shared"]);
  await contains(en["bulkPreview.error.shared"]);
  assert.equal(await disabled(), true);
  await select(en["humanBulk.csvMode"], en["humanBulk.personalized"]);
  await waitFor(async () => !(await disabled()), "personalized mode restored");
  passed("shared/personalized mode changes revalidate message content");

  await select(en["common.channel"], en["channel.email"]);
  await contains(en["bulkPreview.issue.headers"]);
  await select(en["msg.senderIdentity"], "Fixture email sender");
  await upload(
    "valid-email.csv",
    "recipient,subject,body\ncustomer@example.test,Fixture subject,Fixture email body",
  );
  await contains("Fixture subject");
  await waitFor(async () => !(await disabled()), "email CSV ready");
  await select(en["common.channel"], en["channel.sms"]);
  await contains(en["bulkPreview.issue.headers"]);
  assert.equal(await disabled(), true);
  await select(en["msg.senderIdentity"], "Fixture SMS sender");
  await upload("valid-sms.csv", validCsv);
  await waitFor(async () => !(await disabled()), "SMS CSV restored");
  passed("Email preview fields work; channel switching revalidates the existing upload");

  await upload("sms-workbook.xlsx", workbook);
  await contains("+966500000001");
  await waitFor(async () => !(await disabled()), "SMS workbook preview ready");
  passed("Downloaded SMS XLSX imports and previews the exact text phone number");
  await upload("edited-sms.xlsx", workbookFixture(workbook, "shared"));
  await contains("+966500000001");
  await waitFor(async () => !(await disabled()), "compressed Excel workbook ready");
  for (const kind of ["numeric", "formula"]) {
    await upload(`invalid-${kind}.xlsx`, workbookFixture(workbook, kind));
    await contains(en["humanBulk.csvError"]);
    assert.equal(await disabled(), true);
  }
  await select(en["common.channel"], en["channel.email"]);
  await upload("sms-on-email.xlsx", workbook);
  await contains(en["humanBulk.csvOnly"]);
  assert.equal(await disabled(), true);
  await select(en["common.channel"], en["channel.sms"]);
  await select(en["msg.senderIdentity"], "Fixture SMS sender");
  passed(
    "Compressed/shared-string XLSX works; numeric phones, formulas and non-SMS XLSX are rejected",
  );
  await upload("too-many.csv", `recipient,body\n${"+15550000000,Body\n".repeat(1001)}`);
  await contains(en["bulkPreview.issue.limit"]);
  assert.equal(await disabled(), true);
  await upload("too-large.csv", "x".repeat(2 * 1024 * 1024 + 1));
  await contains(en["humanBulk.csvError"]);
  assert.equal(await disabled(), true);
  await upload("valid-sms.csv", validCsv);
  await waitFor(async () => !(await disabled()), "valid reupload after size/count failures");
  passed("row/file limits block review and a subsequent valid upload recovers");

  await send("Emulation.setDeviceMetricsOverride", {
    width: 390,
    height: 844,
    deviceScaleFactor: 1,
    mobile: false,
  });
  assert.equal(await evaluate("document.documentElement.scrollWidth<=window.innerWidth+1"), true);
  await screenshot("bulk-csv-mobile");
  await send("Emulation.setDeviceMetricsOverride", {
    width: 1440,
    height: 1000,
    deviceScaleFactor: 1,
    mobile: false,
  });
  passed("recipient table stays within the mobile viewport");

  await evaluate("localStorage.setItem('dc.locale','ar')");
  await create(ar);
  await click("document.querySelector('#human-bulk-csv')");
  await upload("arabic-sms.csv", "recipient,body\n+15550000000,Arabic fixture");
  await contains(ar["bulkPreview.title"]);
  await waitFor(async () => !(await disabled(ar)), "Arabic CSV preview");
  assert.equal(await evaluate("document.documentElement.dir"), "rtl");
  await screenshot("bulk-csv-arabic");
  passed("Arabic recipient preview, validation labels and RTL");

  setRole("VIEWER");
  await navigate("/messages/bulk");
  await contains(ar["bulkHistory.title"]);
  assert.equal(await evaluate(`!!${button(ar["humanBulk.title"])}`), false);
  assert.equal(await evaluate("!!document.querySelector('input[type=file]')"), false);
  passed("viewer retains monitoring without creation or file-upload controls");
}
