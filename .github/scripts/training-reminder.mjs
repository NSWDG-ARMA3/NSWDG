import fs from "node:fs";
import path from "node:path";

const {
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  DISCORD_WEBHOOK_URL,
  PORTAL_URL,
  SCHEDULING_URL
} = process.env;

if (!SUPABASE_URL) {
  throw new Error(
    "SUPABASE_URL is missing."
  );
}

if (!SUPABASE_ANON_KEY) {
  throw new Error(
    "SUPABASE_ANON_KEY is missing."
  );
}

if (!DISCORD_WEBHOOK_URL) {
  throw new Error(
    "DISCORD_WEBHOOK_URL is missing."
  );
}

const statePath = path.resolve(
  ".github/training-reminder-state.json"
);

const state = loadState();
const now = new Date();

const AVAILABILITY_TIMEZONE = "Europe/Amsterdam";
const AVAILABILITY_REMINDER_HOUR = 18;

const AVAILABILITY_REMINDER_DAYS = new Set([
  "Mon",
  "Wed",
  "Fri"
]);

/*
 * The Action runs every five minutes.
 * This checks for training between 25 and 35 minutes away.
 */
const lowerLimit = new Date(
  now.getTime() +
  25 * 60 * 1000
);

const upperLimit = new Date(
  now.getTime() +
  35 * 60 * 1000
);

const query = new URL(
  `${SUPABASE_URL}/rest/v1/training_sessions`
);

query.searchParams.set(
  "select",
  [
    "id",
    "title",
    "description",
    "start_at",
    "end_at",
    "location",
    "status",
    "category",
    "mandatory"
  ].join(",")
);

query.searchParams.set(
  "status",
  "in.(SCHEDULED,POSTPONED)"
);

query.searchParams.append(
  "start_at",
  `gte.${lowerLimit.toISOString()}`
);

query.searchParams.append(
  "start_at",
  `lte.${upperLimit.toISOString()}`
);

query.searchParams.set(
  "order",
  "start_at.asc"
);

console.log(
  `Checking training from ${lowerLimit.toISOString()} ` +
  `through ${upperLimit.toISOString()}`
);

const response = await fetch(
  query,
  {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization:
        `Bearer ${SUPABASE_ANON_KEY}`,
      Accept: "application/json"
    }
  }
);

if (!response.ok) {
  const responseBody =
    await response.text();

  throw new Error(
    `Supabase returned ${response.status}: ` +
    responseBody
  );
}

const sessions =
  await response.json();

console.log(
  `Found ${sessions.length} matching training session(s).`
);

let changed = false;

if (await maybeSendAvailabilityReminder()) {
  changed = true;
}

for (const session of sessions) {
  const reminderKey =
    buildReminderKey(session);

  if (state.sent[reminderKey]) {
    console.log(
      `Reminder already sent: ${session.title}`
    );

    continue;
  }

  await sendReminder(session);

  state.sent[reminderKey] = {
    sessionId: session.id,
    title: session.title,
    startAt: session.start_at,
    sentAt: new Date().toISOString()
  };

  changed = true;

  console.log(
    `Reminder sent: ${session.title}`
  );
}

if (removeExpiredEntries()) {
  changed = true;
}

if (changed) {
  saveState();
} else {
  console.log(
    "No reminder state changes were required."
  );
}

async function maybeSendAvailabilityReminder() {
  const local = getLocalDateParts(
    now,
    AVAILABILITY_TIMEZONE
  );

  if (!AVAILABILITY_REMINDER_DAYS.has(local.weekday)) {
    return false;
  }

  /*
   * The GitHub Action runs every five minutes.
   *
   * On Monday, Wednesday and Friday, the first run
   * at or after 18:00 Amsterdam time sends the reminder.
   */
  if (local.hour < AVAILABILITY_REMINDER_HOUR) {
    return false;
  }

  const dateKey = [
    local.year,
    String(local.month).padStart(2, "0"),
    String(local.day).padStart(2, "0")
  ].join("-");

  const reminderKey =
    `availability:${dateKey}`;

  /*
   * Prevent the reminder from being sent every five minutes.
   */
  if (state.sent[reminderKey]) {
    console.log(
      `Availability reminder already sent for ${dateKey}.`
    );

    return false;
  }

  const nextWeek =
    getNextWeekRange(local);

  const webhookResponse = await fetch(
    addWaitParameter(
      DISCORD_WEBHOOK_URL
    ),
    {
      method: "POST",

      headers: {
        "Content-Type": "application/json"
      },

      body: JSON.stringify({
        content:
          `@everyone Availability reminder: Please submit your availability for next week ` +
          `(${formatCalendarDate(nextWeek.monday)} - ${formatCalendarDate(nextWeek.sunday)}).\n` +
          (SCHEDULING_URL ||
            "https://www.rsqdn.com/member/scheduling/"),

        allowed_mentions: {
          parse: ["everyone"]
        },

        username: "NAVADMIN",

        avatar_url:
          "https://www.rsqdn.com/nsw.png"
      })
    }
  );

  if (!webhookResponse.ok) {
    const responseBody =
      await webhookResponse.text();

    throw new Error(
      `Discord returned ${webhookResponse.status}: ` +
      responseBody
    );
  }

  state.sent[reminderKey] = {
    type: "availability",
    targetWeek: nextWeek.monday.iso,
    sentAt: new Date().toISOString()
  };

  console.log(
    `Availability reminder sent for week of ${nextWeek.monday.iso}.`
  );

  return true;
}


function getLocalDateParts(
  date,
  timeZone
) {
  const parts =
    new Intl.DateTimeFormat(
      "en-GB",
      {
        timeZone,
        weekday: "short",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        hourCycle: "h23"
      }
    ).formatToParts(date);

  const values = {};

  for (const part of parts) {
    if (part.type !== "literal") {
      values[part.type] =
        part.value;
    }
  }

  return {
    weekday: values.weekday,
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
    hour: Number(values.hour)
  };
}


function getNextWeekRange(local) {
  /*
   * Treat the Amsterdam calendar date as a plain
   * calendar date. We only care about Monday-Sunday,
   * not the UTC offset here.
   */
  const currentDate = new Date(
    Date.UTC(
      local.year,
      local.month - 1,
      local.day
    )
  );

  const currentWeekday =
    currentDate.getUTCDay();

  /*
   * Always select NEXT Monday.
   *
   * Monday -> +7 days
   * Wednesday -> +5 days
   * Friday -> +3 days
   */
  const daysUntilNextMonday =
    currentWeekday === 0
      ? 1
      : 8 - currentWeekday;

  const mondayDate =
    new Date(currentDate);

  mondayDate.setUTCDate(
    mondayDate.getUTCDate() +
    daysUntilNextMonday
  );

  const sundayDate =
    new Date(mondayDate);

  sundayDate.setUTCDate(
    sundayDate.getUTCDate() + 6
  );

  return {
    monday: calendarDate(mondayDate),
    sunday: calendarDate(sundayDate)
  };
}


function calendarDate(date) {
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
    iso:
      date.toISOString().slice(0, 10)
  };
}


function formatCalendarDate(value) {
  return new Intl.DateTimeFormat(
    "en-GB",
    {
      day: "numeric",
      month: "short",
      timeZone: "UTC"
    }
  ).format(
    new Date(
      Date.UTC(
        value.year,
        value.month - 1,
        value.day
      )
    )
  );
}

function buildReminderKey(session) {
  return [
    "training",
    session.id,
    session.start_at
  ].join(":");
}

async function sendReminder(session) {
  const startTimestamp =
    Math.floor(
      new Date(
        session.start_at
      ).getTime() / 1000
    );

  const endTimestamp =
    session.end_at
      ? Math.floor(
          new Date(
            session.end_at
          ).getTime() / 1000
        )
      : null;

  const fields = [
    {
      name: "Start",
      value:
        `<t:${startTimestamp}:F>\n` +
        `<t:${startTimestamp}:R>`,
      inline: true
    },
    {
      name: "Location",
      value:
        session.location ||
        "To be confirmed",
      inline: true
    },
    {
      name: "Category",
      value:
        formatCategory(
          session.category
        ),
      inline: true
    },
    {
      name: "Attendance",
      value:
        session.mandatory === false
          ? "Optional"
          : "Required",
      inline: true
    }
  ];

  if (endTimestamp) {
    fields.splice(
      1,
      0,
      {
        name: "End",
        value:
          `<t:${endTimestamp}:t>`,
        inline: true
      }
    );
  }

  const webhookResponse =
    await fetch(
      addWaitParameter(
        DISCORD_WEBHOOK_URL
      ),
      {
        method: "POST",
        headers: {
          "Content-Type":
            "application/json"
        },
            body: JSON.stringify({
            content: "<@&1424715895015739516>",

            allowed_mentions: {
                parse: [],
                roles: ["1424715895015739516"]
            },

            username: "NAVADMIN",
            avatar_url: "https://www.rsqdn.com/nsw.png",
          embeds: [
            {
              title:
                "TRAINING REMINDER",
              description:
                `**${session.title}**\n\n` +
                "Training begins in approximately 30 minutes. " +
                "Personnel should review posted instructions and be prepared before start time.",
              url: PORTAL_URL,
              color: 13937237,
              fields,
              footer: {
                text:
                  "NAVADMIN"
              },
              timestamp:
                new Date().toISOString()
            }
          ]
        })
      }
    );

  if (!webhookResponse.ok) {
    const responseBody =
      await webhookResponse.text();

    throw new Error(
      `Discord returned ${webhookResponse.status}: ` +
      responseBody
    );
  }
}

function addWaitParameter(webhookUrl) {
  const url = new URL(webhookUrl);

  url.searchParams.set(
    "wait",
    "true"
  );

  return url.toString();
}

function formatCategory(category) {
  switch (category) {
    case "PRO_DEVELOPMENT":
      return "Professional Development";

    case "UNIT_WIDE":
      return "Unit Wide";

    case "INNER_TEAM":
      return "Inner Team";

    default:
      return String(
        category || "Training"
      ).replaceAll("_", " ");
  }
}

function loadState() {
  if (!fs.existsSync(statePath)) {
    return {
      version: 1,
      sent: {}
    };
  }

  try {
    const parsed = JSON.parse(
      fs.readFileSync(
        statePath,
        "utf8"
      )
    );

    return {
      version: 1,
      sent:
        parsed.sent &&
        typeof parsed.sent === "object"
          ? parsed.sent
          : {}
    };
  } catch (error) {
    console.warn(
      "Could not read reminder state. Starting with an empty state.",
      error
    );

    return {
      version: 1,
      sent: {}
    };
  }
}

function saveState() {
  fs.mkdirSync(
    path.dirname(statePath),
    {
      recursive: true
    }
  );

  fs.writeFileSync(
    statePath,
    JSON.stringify(
      state,
      null,
      2
    ) + "\n",
    "utf8"
  );
}

function removeExpiredEntries() {
  const expiryTime =
    Date.now() -
    45 * 24 * 60 * 60 * 1000;

  let removed = false;

  for (
    const [key, value]
    of Object.entries(state.sent)
  ) {
    const sentAt = new Date(
      value.sentAt
    ).getTime();

    if (
      !Number.isFinite(sentAt) ||
      sentAt < expiryTime
    ) {
      delete state.sent[key];
      removed = true;
    }
  }

  return removed;
}