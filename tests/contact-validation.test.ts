// Guarantee: the contact form accepts only what the founders can act on, and says every time in two zones.
// Name and email are required (email in a form safe for Reply-To), questions need a message, lengths are
// capped, at most three proposed times that haven't passed, and line breaks never survive in one-line fields.
// The scheduler offers no time sooner than 12 hours, opens on a weekday, and handles summer-time changes; the
// letter gives each time in the visitor's zone and in IST, and its HTML escapes whatever the visitor typed.
import { describe, expect, it } from "vitest";
import { composeEmail, letterBlocks, letterHtml, letterText, sentStamp, subjectFor, timeLine } from "@/components/site/company/contact/letter";
import { MIN_NOTICE_MS, SLOT_CLOCKS, WINDOW_DAYS, bookableDays, firstChoiceDay, hasSlots, offeredAt, slotsOn } from "@/components/site/company/contact/schedule";
import { LIMITS, MESSAGES, multiLine, oneLine, validateContact, type ContactMessage } from "@/components/site/company/contact/submission";
import { IST_ZONE, addDays, dayAndClock, dayLong, dayShort, formatOffset, indiaGap, isTimeZone, offsetMinutes, wallClock, zoneName, zonedInstant } from "@/components/site/company/contact/zones";

const NOW = Date.UTC(2026, 10, 4, 6, 0); // Wed 4 Nov 2026, 06:00 UTC, 11:30 in India
const THU_9_BERLIN = Date.UTC(2026, 10, 5, 8, 0); // Thu 5 Nov, 09:00 in Berlin (CET), 13:30 IST
const iso = (t: number) => new Date(t).toISOString();

const demo = {
  topic: "demo",
  name: "Ada Lovelace",
  email: "ada@example.com",
  company: "Acme",
  website: "acme.example",
  volume: "10 to 50",
  message: "Hello",
  times: [iso(THU_9_BERLIN)],
  timeZone: "Europe/Berlin",
  page: "https://exhibit.9to5code.com/contact",
  referrer: "/pricing",
};
const errorsOf = (input: unknown) => {
  const r = validateContact(input, NOW);
  return r.ok ? {} : r.errors;
};

describe("validating a message", () => {
  it("accepts a full demo request and cleans it", () => {
    const r = validateContact({ ...demo, name: "  Ada\r\nLovelace  ", message: "Line one\r\n\r\n\r\n\r\nLine two\u0007" }, NOW);
    expect(r).toEqual({ ok: true, value: { ...demo, name: "Ada Lovelace", message: "Line one\n\nLine two", times: [THU_9_BERLIN] } });
  });

  it("needs a name and an email for a demo, and a message for a question", () => {
    expect(errorsOf({ ...demo, name: " ", email: "" })).toEqual({ name: MESSAGES.nameMissing, email: MESSAGES.emailMissing });
    expect(errorsOf({ ...demo, topic: "question", message: "" })).toEqual({ message: MESSAGES.messageMissing });
    expect(errorsOf({ ...demo, topic: "other", name: "", message: "Press enquiry" })).toEqual({ name: MESSAGES.nameMissing });
    expect(errorsOf({ ...demo, topic: "sales" })).toEqual({ topic: MESSAGES.topic });
    expect(errorsOf(null)).toMatchObject({ topic: MESSAGES.topic, name: MESSAGES.nameMissing, email: MESSAGES.emailMissing });
  });

  it("only takes an email address that is safe to put in a Reply-To header", () => {
    for (const email of ["ada@example.com\r\nBcc: evil@example.com", "Ada <ada@example.com>", "ada@example.com, evil@example.com", "ada@example", "ada@@example.com", 'a"b@example.com', "ada@example.c", "ada@-example.com"]) {
      expect(errorsOf({ ...demo, email })).toEqual({ email: MESSAGES.emailBad });
    }
    for (const email of ["ada.lovelace+demo@analytical-engines.co.uk", "o'brien@example.ie", "x@xn--80ak6aa92e.com", "a@b.xn--p1ai"]) {
      expect(errorsOf({ ...demo, email })).toEqual({});
    }
    expect(errorsOf({ ...demo, email: `${"a".repeat(250)}@example.com` })).toEqual({ email: MESSAGES.emailBad });
  });

  it("caps every field's length", () => {
    expect(errorsOf({ ...demo, name: "a".repeat(LIMITS.name + 1), company: "c".repeat(LIMITS.company + 1), website: "w".repeat(LIMITS.website + 1), message: "m".repeat(LIMITS.message + 1) })).toEqual({
      name: MESSAGES.nameLong,
      company: MESSAGES.company,
      website: MESSAGES.website,
      message: MESSAGES.messageLong,
    });
    expect(errorsOf({ ...demo, name: "a".repeat(LIMITS.name), message: "m".repeat(LIMITS.message) })).toEqual({});
  });

  it("takes the dispute volume only from the list", () => {
    expect(errorsOf({ ...demo, volume: "A million" })).toEqual({ volume: MESSAGES.volume });
    expect(errorsOf({ ...demo, volume: "" })).toEqual({});
  });

  it("takes up to three proposed times, still ahead, sorted and without repeats", () => {
    const later = THU_9_BERLIN + 3 * 3_600_000;
    const r = validateContact({ ...demo, times: [iso(later), iso(THU_9_BERLIN), iso(later)] }, NOW);
    expect(r.ok && r.value.times).toEqual([THU_9_BERLIN, later]);
    expect(errorsOf({ ...demo, times: [1, 2, 3, 4].map((h) => iso(THU_9_BERLIN + h * 3_600_000)) })).toEqual({ times: MESSAGES.timesMany });
    expect(errorsOf({ ...demo, times: [iso(NOW - 2 * 3_600_000)] })).toEqual({ times: MESSAGES.timesPast });
    expect(errorsOf({ ...demo, times: [iso(NOW + (WINDOW_DAYS + 5) * 86_400_000)] })).toEqual({ times: MESSAGES.timesBad });
    for (const times of [["tomorrow at nine"], ["2026-11-05T09:00:00+01:00"], [1762329600000], "2026-11-05T08:00:00.000Z"]) {
      expect(errorsOf({ ...demo, times })).toEqual({ times: MESSAGES.timesBad });
    }
  });

  it("needs a real time zone when there are times, and ignores times on a question", () => {
    expect(errorsOf({ ...demo, timeZone: "Mars/Olympus_Mons" })).toEqual({ timeZone: MESSAGES.timeZone });
    const q = validateContact({ ...demo, topic: "question", website: "dropped", volume: "dropped", timeZone: "nonsense" }, NOW);
    expect(q.ok && q.value).toMatchObject({ topic: "question", times: [], website: "", volume: "", timeZone: "UTC" });
  });

  it("keeps line breaks out of one-line fields and tidies running text", () => {
    expect(oneLine("a\r\nb c\td\u0000e")).toBe("a b c d e");
    expect(oneLine(42)).toBe("");
    expect(multiLine("  one  \r\ntwo\r\rthree\u0008\n\n\n\nfour  ")).toBe("one\ntwo\n\nthree\n\nfour");
  });
});

describe("time zones", () => {
  it("converts a wall-clock time in a zone to the right instant", () => {
    expect(zonedInstant("2026-11-05", "09:00", "Europe/Berlin")).toBe(THU_9_BERLIN);
    expect(zonedInstant("2026-11-05", "13:30", IST_ZONE)).toBe(THU_9_BERLIN);
    expect(zonedInstant("2026-11-05", "03:00", "America/New_York")).toBe(THU_9_BERLIN);
    expect(zonedInstant("2026-11-05", "13:45", "Asia/Kathmandu")).toBe(THU_9_BERLIN);
  });

  it("knows the clock skipped when summer time starts, and picks a real time when it ends", () => {
    expect(zonedInstant("2027-03-28", "02:30", "Europe/Berlin")).toBeNull();
    const repeated = zonedInstant("2026-10-25", "02:30", "Europe/Berlin")!;
    expect(wallClock(repeated, "Europe/Berlin")).toEqual({ year: 2026, month: 10, day: 25, hour: 2, minute: 30 });
    expect(zonedInstant("2027-03-14", "02:30", "America/New_York")).toBeNull();
  });

  it("names offsets and zones the way the form and the email show them", () => {
    expect(offsetMinutes(NOW, IST_ZONE)).toBe(330);
    expect(offsetMinutes(NOW, "America/St_Johns")).toBe(-210);
    expect([0, 60, 330, -210, -600, 345].map(formatOffset)).toEqual(["GMT", "GMT+1", "GMT+5:30", "GMT-3:30", "GMT-10", "GMT+5:45"]);
    expect(zoneName("America/New_York", NOW)).toBe("New York time");
    expect(zoneName("Asia/Calcutta", NOW)).toBe("Kolkata time");
    expect(zoneName("UTC", NOW)).toBe("UTC");
    expect(zoneName("Etc/GMT+5", NOW)).toBe("GMT-5");
    expect(isTimeZone("Europe/Berlin") && !isTimeZone("Europe/Atlantis") && !isTimeZone("")).toBe(true);
  });

  it("writes days and the gap to India in words", () => {
    expect(dayShort("2026-11-05")).toBe("Thu 5 Nov");
    expect(dayLong("2026-09-07")).toBe("Monday 7 September");
    expect(dayAndClock(THU_9_BERLIN, "America/Los_Angeles", true)).toBe("Thu 5 Nov, 12:00 am");
    expect(indiaGap("Europe/Berlin", NOW)).toBe("India is 4 h 30 min ahead of you.");
    expect(indiaGap("Asia/Tokyo", NOW)).toBe("India is 3 h 30 min behind you.");
    expect(indiaGap("Asia/Dubai", NOW)).toBe("India is 1 h 30 min ahead of you.");
    expect(indiaGap("Asia/Calcutta", NOW)).toBe("You're on India time, like the founders.");
  });
});

describe("the times on offer", () => {
  it("offers every half hour from 08:00 to 19:30, never sooner than 12 hours away", () => {
    expect(SLOT_CLOCKS).toHaveLength(24);
    expect([SLOT_CLOCKS[0], SLOT_CLOCKS[23]]).toEqual(["08:00", "19:30"]);
    // 06:00 UTC is 07:00 in Berlin: 12 hours on is 19:00, so today has two times left.
    expect(slotsOn("2026-11-04", "Europe/Berlin", NOW).map((s) => s.clock)).toEqual(["19:00", "19:30"]);
    expect(slotsOn("2026-11-05", "Europe/Berlin", NOW)).toHaveLength(24);
    for (const s of slotsOn("2026-11-04", "Europe/Berlin", NOW)) expect(s.at).toBeGreaterThanOrEqual(NOW + MIN_NOTICE_MS);
  });

  it("covers four weeks from today, in the visitor's own calendar", () => {
    expect(bookableDays("Europe/Berlin", NOW)).toEqual({ first: "2026-11-04", last: "2026-12-01" });
    expect(bookableDays("Pacific/Kiritimati", NOW).first).toBe("2026-11-04");
    expect(bookableDays("Pacific/Pago_Pago", NOW).first).toBe("2026-11-03");
    expect(offeredAt({ day: "2026-12-02", clock: "09:00" }, "Europe/Berlin", NOW)).toBeNull();
    expect(offeredAt({ day: "2026-11-05", clock: "09:15" }, "Europe/Berlin", NOW)).toBeNull();
    expect(offeredAt({ day: "2026-11-05", clock: "09:00" }, "Europe/Berlin", NOW)).toBe(THU_9_BERLIN);
  });

  it("opens on a weekday, even when the weekend comes first", () => {
    expect(firstChoiceDay("Europe/Berlin", NOW)).toBe("2026-11-04");
    const fridayNight = Date.UTC(2026, 10, 6, 20, 0);
    expect(hasSlots("2026-11-07", "UTC", fridayNight)).toBe(true); // Saturday is offered
    expect(firstChoiceDay("UTC", fridayNight)).toBe("2026-11-09"); // but Monday comes first
  });

  it("agrees with itself about which days have times, around the world", () => {
    for (const zone of ["Europe/Berlin", "America/New_York", "Asia/Kathmandu", "America/St_Johns", "Pacific/Kiritimati", "Pacific/Pago_Pago", "Australia/Lord_Howe"]) {
      for (const now of [NOW, Date.UTC(2026, 10, 4, 21, 47), Date.UTC(2027, 2, 27, 12, 0)]) {
        const { first } = bookableDays(zone, now);
        for (let i = -1; i <= WINDOW_DAYS; i++) {
          const day = addDays(first, i);
          expect(hasSlots(day, zone, now), `${zone} ${day}`).toBe(slotsOn(day, zone, now).length > 0);
        }
      }
    }
  });
});

describe("the letter", () => {
  const message: ContactMessage = { ...demo, topic: "demo", times: [THU_9_BERLIN, Date.UTC(2026, 10, 5, 19, 0)] };

  it("names the request in the subject", () => {
    expect(subjectFor(message)).toBe("Demo request: Ada Lovelace, Acme");
    expect(subjectFor({ topic: "question", name: "Ada", company: "" })).toBe("Question: Ada");
    expect(subjectFor({ topic: "other", name: "", company: "" })).toBe("Message");
  });

  it("gives each time in the visitor's zone and in IST, with India's date when it differs", () => {
    expect(timeLine(THU_9_BERLIN, "Europe/Berlin")).toBe("Thu 5 Nov, 09:00 Berlin time (GMT+1) = 13:30 IST");
    expect(timeLine(Date.UTC(2026, 10, 5, 19, 0), "America/New_York")).toBe("Thu 5 Nov, 14:00 New York time (GMT-5) = Fri 6 Nov, 00:30 IST");
    expect(timeLine(THU_9_BERLIN, "Asia/Calcutta")).toBe("Thu 5 Nov, 13:30 IST");
    expect(timeLine(THU_9_BERLIN, "UTC")).toBe("Thu 5 Nov, 08:00 UTC = 13:30 IST");
  });

  it("leaves out what the visitor left empty", () => {
    const text = letterText(letterBlocks({ ...message, company: "", website: "", volume: "", message: "", times: [] }));
    expect(text).toBe("Hello Shivansh and Someet,\n\nI'd like a demo of Exhibit.\n\nName: Ada Lovelace\nEmail: ada@example.com");
    expect(letterText(letterBlocks({ ...message, topic: "question", company: "", message: "Is there an API?" }))).toBe("Hello Shivansh and Someet,\n\nIs there an API?\n\nAda Lovelace\nada@example.com");
  });

  it("sends every field, both zones, the page, where the visitor came from and when", () => {
    const email = composeEmail(message, NOW);
    expect(email.subject).toBe("Demo request: Ada Lovelace, Acme");
    expect(email.text).toBe(
      [
        "Hello Shivansh and Someet,",
        "",
        "I'd like a demo of Exhibit.",
        "",
        "Name: Ada Lovelace",
        "Email: ada@example.com",
        "Company or store: Acme",
        "Website: acme.example",
        "PayPal disputes a month: 10 to 50",
        "",
        "Times that suit me:",
        "- Thu 5 Nov, 09:00 Berlin time (GMT+1) = 13:30 IST",
        "- Thu 5 Nov, 20:00 Berlin time (GMT+1) = Fri 6 Nov, 00:30 IST",
        "",
        "Hello",
        "",
        "Sent with the contact form on https://exhibit.9to5code.com/contact",
        "Came from: /pricing",
        "Sent: Wed 4 Nov 2026, 06:00 UTC (11:30 IST)",
        "Visitor's time zone: Europe/Berlin (GMT+1)",
      ].join("\n"),
    );
    expect(sentStamp(Date.UTC(2026, 10, 4, 20, 15))).toBe("Wed 4 Nov 2026, 20:15 UTC (Thu 5 Nov, 01:45 IST)");
  });

  it("escapes what the visitor typed in the HTML version, and links nothing", () => {
    const html = letterHtml(letterBlocks({ ...message, name: '<img src=x onerror="alert(1)">', message: "<script>alert('x')</script> & more" }), "<b>subject</b>");
    expect(html).not.toMatch(/<script|<img|onerror="/);
    expect(html).toContain("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;");
    expect(html).toContain("&lt;script&gt;alert(&#39;x&#39;)&lt;/script&gt; &amp; more");
    expect(html).toContain("<title>&lt;b&gt;subject&lt;/b&gt;</title>");
    expect(html).not.toMatch(/<a\s|<img\s|\s(src|href)="/);
  });
});
