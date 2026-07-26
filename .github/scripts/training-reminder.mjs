import fs from "node:fs";
import path from "node:path";

const {
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  DISCORD_WEBHOOK_URL,
  PORTAL_URL
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
          username:
            "NAVADMIN",
          avatar_url:
            "https://www.rsqdn.com/nsw.png",
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
                  "Naval Special Warfare Command | Training Portal"
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