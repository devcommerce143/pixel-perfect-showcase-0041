import assert from "node:assert/strict";

export async function runNotificationChecks(h) {
  const { evaluate, click, navigate, send, screenshot, passed, waitFor, en, ar, bridge } = h;
  const bell = "document.querySelector('button:has(svg.lucide-bell)')";
  const panel = "document.querySelector('[role=dialog]')";
  const panelButton = (label) =>
    `[...(${panel}?.querySelectorAll('button')??[])].find(e=>e.textContent.trim()===${JSON.stringify(label)})`;
  const countLabel = (dictionary, count) =>
    dictionary["notifications.unreadCount"].replace("{count}", String(count));
  const hasCount = (dictionary, count) =>
    evaluate(
      `${bell}?.getAttribute('aria-label')===${JSON.stringify(countLabel(dictionary, count))}`,
    );
  async function open() {
    await click(bell);
    await waitFor(() => evaluate(`!!${panel}`), "notification popover");
  }
  async function escape() {
    await send("Input.dispatchKeyEvent", {
      type: "keyDown",
      key: "Escape",
      code: "Escape",
      windowsVirtualKeyCode: 27,
    });
    await send("Input.dispatchKeyEvent", {
      type: "keyUp",
      key: "Escape",
      code: "Escape",
      windowsVirtualKeyCode: 27,
    });
    await waitFor(() => evaluate(`!${panel}`), "keyboard dismissal");
  }
  await navigate("/docs");
  await waitFor(() => evaluate(`!!${bell}`), "notification bell");
  await open();
  assert.ok(await evaluate(`!!${panel}.querySelector('[aria-busy=true]')`));
  await screenshot("notifications-loading-en");
  bridge.release();
  await waitFor(() => hasCount(en, 0), "empty count");
  await waitFor(
    () => evaluate(`${panel}.textContent.includes(${JSON.stringify(en["notifications.empty"])})`),
    "empty guidance",
  );
  await screenshot("notifications-empty-en");
  passed("real browser loading and empty personal inbox with zero unread");
  await escape();
  assert.ok(
    await evaluate(
      'document.activeElement===document.querySelector("button:has(svg.lucide-bell)")',
    ),
  );
  await bridge.seedAndChangeRole();
  await open();
  await waitFor(() => hasCount(en, 21), "successful role change unread count");
  await waitFor(
    () => evaluate(`${panel}.querySelectorAll('li').length===20`),
    "first notification page",
  );
  await screenshot("notifications-page-one-en");
  passed("committed real role change appears in browser list and unread count");
  await click(panelButton(en["common.next"]));
  await waitFor(
    () => evaluate(`${panel}.querySelectorAll('li').length===1`),
    "second notification page",
  );
  await screenshot("notifications-page-two-en");
  await click(panelButton(en["common.previous"]));
  await waitFor(() => evaluate(`${panel}.querySelectorAll('li').length===20`), "return first page");
  await click(panelButton(en["notifications.markRead"]));
  await waitFor(() => hasCount(en, 20), "persisted read count");
  await send("Page.reload");
  await waitFor(() => hasCount(en, 20), "read survives full browser reload");
  await open();
  await waitFor(
    () => evaluate(`${panel}.textContent.includes(${JSON.stringify(en["notifications.read"])})`),
    "stored read label",
  );
  passed("pagination, mark-one-read and actual PostgreSQL persistence after reload");
  await bridge.failedChange();
  await click(panelButton(en["common.refresh"]));
  await waitFor(() => hasCount(en, 20), "failed change unchanged count");
  await screenshot("notifications-read-en");
  passed("rolled-back role change adds no browser notification");

  for (const [locale, dictionary] of [
    ["en", en],
    ["ar", ar],
  ]) {
    if (locale === "ar") {
      await escape();
      await evaluate("localStorage.setItem('dc.locale','ar')");
      await send("Page.reload");
      await waitFor(() => hasCount(ar, 20), "Arabic unread accessible name");
      await open();
    }
    await waitFor(
      () => evaluate(`${panel}.querySelectorAll('li').length===20`),
      "loaded localized list",
    );
    const layout = await evaluate(
      `(()=>{const p=${panel};const r=p.getBoundingClientRect();return {dir:getComputedStyle(p).direction,overflow:p.scrollWidth>p.clientWidth,inside:r.left>=0&&r.right<=innerWidth};})()`,
    );
    assert.deepEqual(layout, {
      dir: locale === "ar" ? "rtl" : "ltr",
      overflow: false,
      inside: true,
    });
    await screenshot(`notifications-list-${locale}`);
    bridge.failure(true);
    await click(panelButton(dictionary["common.refresh"]));
    await waitFor(
      () => evaluate(`!!${panel}.querySelector('[role=alert]')`),
      "safe localized failure",
    );
    assert.equal(await evaluate(`${panel}.textContent.includes('SYNTHETIC SECRET STACK')`), false);
    assert.ok(
      await evaluate(
        `${panel}.textContent.includes(${JSON.stringify(dictionary["common.errorBody"])})`,
      ),
    );
    await screenshot(`notifications-error-${locale}`);
    bridge.failure(false);
    await click(panelButton(dictionary["common.retry"]));
    await waitFor(() => hasCount(dictionary, 20), "retry stored state");
    await send("Input.dispatchKeyEvent", {
      type: "keyDown",
      key: "Tab",
      code: "Tab",
      windowsVirtualKeyCode: 9,
    });
    await send("Input.dispatchKeyEvent", {
      type: "keyUp",
      key: "Tab",
      code: "Tab",
      windowsVirtualKeyCode: 9,
    });
    assert.ok(await evaluate(`${panel}.contains(document.activeElement)`));
    passed(
      `${locale}: localized list, bounded RTL/LTR layout, safe error/retry and keyboard focus`,
    );
    const preview = await evaluate(
      `(()=>{const e=${panel}.querySelector('li p.line-clamp-2');const s=getComputedStyle(e);return {clamp:s.webkitLineClamp,height:e.getBoundingClientRect().height,line:parseFloat(s.lineHeight),text:e.textContent};})()`,
    );
    assert.equal(preview.clamp, "2");
    assert.ok(preview.height <= preview.line * 2 + 1);
    assert.equal(preview.text, dictionary["notifications.accessBody"]);
    bridge.failAll(true);
    await click(panelButton(dictionary["notifications.markAllRead"]));
    await waitFor(
      () => evaluate(`!!${panel}.querySelector('[role=alert]')`),
      "mark-all safe failure",
    );
    assert.ok(await hasCount(dictionary, 20));
    assert.equal(await evaluate(`${panel}.textContent.includes('SYNTHETIC SECRET STACK')`), false);
    bridge.failAll(false);
    bridge.pauseAll();
    const callsBefore = bridge.allCalls();
    await click(panelButton(dictionary["notifications.markAllRead"]));
    await waitFor(
      () => evaluate(`!!${panelButton(dictionary["notifications.markingAll"])}?.disabled`),
      "mark-all in progress",
    );
    await click(panelButton(dictionary["notifications.markingAll"]));
    assert.ok(await hasCount(dictionary, 20));
    await waitFor(() => bridge.allCalls() === callsBefore + 1, "one mark-all request only");
    bridge.releaseAll();
    await waitFor(() => hasCount(dictionary, 0), "mark-all server-confirmed zero");
    assert.equal(
      await evaluate(`${panelButton(dictionary["notifications.markAllRead"])}.disabled`),
      true,
    );
    await screenshot(`notifications-mark-all-${locale}`);
    await send("Page.reload");
    await waitFor(() => hasCount(dictionary, 0), "mark-all persists after reload");
    await open();
    assert.equal(
      await evaluate(`${panelButton(dictionary["notifications.markAllRead"])}.disabled`),
      true,
    );
    passed(
      `${locale}: two-line preview, failed mark-all preserves state, duplicate prevention and persisted all-page read state`,
    );
    if (locale === "en") {
      await bridge.restoreUnread();
      await click(panelButton(dictionary["common.refresh"]));
      await waitFor(() => hasCount(dictionary, 20), "restore synthetic unread fixture for Arabic");
    }
  }
  await escape();
}
