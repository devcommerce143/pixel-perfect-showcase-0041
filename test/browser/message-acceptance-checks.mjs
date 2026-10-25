import assert from "node:assert/strict";

// Local fixtures only: writes are rejected except an in-memory acceptance receipt.
export async function runMessageAcceptanceChecks(h) {
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
    tenant,
    en,
    ar,
    setScenario,
    setRole,
  } = h;
  await navigate(`/messages/send?tenantId=${tenant}`);
  await contains(en["humanSend.title"]);
  for (const [language, dictionary] of [
    ["en", en],
    ["ar", ar],
  ]) {
    await evaluate(`localStorage.setItem('dc.locale', '${language}')`);
    for (const [scenario, key] of [
      ["missing", "notice.subscriptionMissing"],
      ["expired", "notice.subscriptionEnded"],
      ["suspended", "notice.tenantSuspended"],
      ["channel", "notice.channelUnavailable"],
    ]) {
      setScenario(scenario);
      await navigate(`/messages/send?tenantId=${tenant}`);
      await contains(dictionary[key].replace("{channel}", dictionary["channel.sms"]));
      assert.equal(await evaluate(`${button(dictionary["humanSend.review"])}.disabled`), true);
      const state = await evaluate(
        `(()=>{const e=[...document.querySelectorAll('[role=status]')].find(e=>e.textContent.includes(${JSON.stringify(dictionary["notice.sendingUnavailable"])}));const r=e.getBoundingClientRect();const svg=e.querySelector('svg');const i=svg.getBoundingClientRect();return {direction:getComputedStyle(e).direction,align:getComputedStyle(e).textAlign,width:r.width,overflow:e.scrollWidth>e.clientWidth,iconInside:i.left>=r.left&&i.right<=r.right,title:!!e.querySelector('h5')};})()`,
      );
      assert.equal(state.direction, language === "ar" ? "rtl" : "ltr");
      assert.ok(state.width > 100 && !state.overflow && state.iconInside && state.title);
      await screenshot(`message-${scenario}-${language}`);
      passed(
        `${language}: ${scenario} restriction, disabled review, titled status and bounded layout`,
      );
    }
    setScenario("sender");
    await navigate(`/messages/send?tenantId=${tenant}`);
    await contains(dictionary["humanSend.chooseApplication"]);
    await waitFor(
      () => evaluate(`!!${combo(dictionary["common.application"])}`),
      "application selector mounted",
    );
    await click(combo(dictionary["common.application"]));
    await waitFor(
      () => evaluate(`!!${option("Fixture submission application")}`),
      "application choice",
    );
    await click(option("Fixture submission application"));
    await contains(dictionary["notice.senderSetup"]);
    assert.equal(await evaluate(`${button(dictionary["humanSend.review"])}.disabled`), true);
    await screenshot(`message-sender-${language}`);
    passed(`${language}: no eligible sender produces guidance and blocks review`);
    setScenario("failure");
    await navigate(`/messages/send?tenantId=${tenant}`);
    await contains(dictionary["common.errorBody"]);
    assert.equal(await evaluate(`${button(dictionary["humanSend.review"])}.disabled`), true);
    assert.equal(await evaluate("document.body.innerText.includes('Fixture failure')"), false);
    assert.ok(await evaluate("document.querySelectorAll('[role=alert]').length>0"));
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
    assert.ok(await evaluate("document.activeElement!==document.body"));
    await screenshot(`message-failure-${language}`);
    passed(`${language}: backend failure stays safe, blocks review and supports keyboard focus`);
    setScenario("active");
    setRole("VIEWER");
    await navigate(`/messages/send?tenantId=${tenant}`);
    await contains(dictionary["common.forbiddenTitle"]);
    assert.equal(await evaluate("!!document.querySelector('#human-message-recipient')"), false);
    await screenshot(`message-forbidden-${language}`);
    passed(`${language}: viewer sees access restriction without send controls`);
    setRole("PLATFORM_SUPER_ADMIN");
    setScenario("success");
    await navigate(`/messages/send?tenantId=${tenant}`);
    await waitFor(
      () => evaluate(`!!${combo(dictionary["common.application"])}`),
      "ready application selector",
    );
    await click(combo(dictionary["common.application"]));
    await waitFor(
      () => evaluate(`!!${option("Fixture submission application")}`),
      "application option",
    );
    await click(option("Fixture submission application"));
    await waitFor(
      () => evaluate("document.querySelectorAll('[role=option]').length===0"),
      "application menu closed",
    );
    await waitFor(
      () =>
        evaluate(
          `!!${combo(dictionary["msg.senderIdentity"])} && !${combo(dictionary["msg.senderIdentity"])}.disabled`,
        ),
      "sender selector",
    );
    await click(combo(dictionary["msg.senderIdentity"]));
    await waitFor(async () => {
      if (await evaluate(`!!${option("Fixture SMS sender")}`)) return true;
      const closed = await evaluate(
        `${combo(dictionary["msg.senderIdentity"])}?.getAttribute('aria-expanded')==='false'`,
      );
      if (closed) await click(combo(dictionary["msg.senderIdentity"]));
      return false;
    }, "sender option");
    await click(option("Fixture SMS sender"));
    async function fill(id, value) {
      await click(`document.querySelector('#${id}')`);
      await evaluate(`document.querySelector('#${id}').select()`);
      await send("Input.insertText", { text: value });
    }
    await fill("human-message-recipient", "invalid-recipient");
    await fill("human-message-body", "Controlled fixture only");
    assert.equal(await evaluate(`${button(dictionary["humanSend.review"])}.disabled`), true);
    await screenshot(`message-invalid-${language}`);
    passed(`${language}: invalid recipient blocks review`);
    await fill("human-message-recipient", "+15550000000");
    await waitFor(
      () => evaluate(`!${button(dictionary["humanSend.review"])}.disabled`),
      "valid review",
    );
    await click(button(dictionary["humanSend.review"]));
    await contains(dictionary["humanSend.confirmNote"]);
    await contains(dictionary["humanSend.note"]);
    await click("document.querySelector('#human-message-ack')");
    await click(button(dictionary["humanSend.accept"]));
    await contains(dictionary["humanSend.accepted"]);
    await screenshot(`message-success-${language}`);
    passed(`${language}: controlled local receipt displays acceptance without claiming delivery`);
    for (const [scenario, key] of [
      ["provider-empty", "liveProviders.empty"],
      ["provider-failed", "liveProviders.failure.TIMEOUT"],
      ["provider-unavailable", "common.errorBody"],
    ]) {
      setScenario(scenario);
      await navigate("/platform/providers");
      await contains(dictionary[key]);
      assert.equal(await evaluate("document.body.innerText.includes('Fixture failure')"), false);
      if (scenario === "provider-empty")
        assert.equal(await evaluate("document.querySelectorAll('[role=alert]').length"), 0);
      if (scenario === "provider-unavailable")
        assert.equal(await evaluate("document.querySelectorAll('[role=alert]').length"), 1);
      await screenshot(`${scenario}-${language}`);
      passed(
        `${language}: ${scenario} has distinct empty/status/error presentation without raw exception`,
      );
    }
  }
}
