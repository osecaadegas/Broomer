import dotenv from "dotenv";
import pg from "pg";

const { Pool } = pg;

dotenv.config({ path: [".env.local", ".env"] });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Mock questionnaire data — replace these with your real questions later.
const questions = [
  {
    prompt: "🧹 Wusup Broomer good mood?",
    type: "rating",
    options: ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"],
    required: true,
  },
  {
    prompt: "Do you like purple shade😈",
    type: "single",
    options: ["Fuck yeah!", "Hell nahh"],
    required: true,
  },
  {
    prompt:
      "I know .... its my bad but i think its only fair if i also note your Bday somewhere im horrible with dates tho🤦🏿",
    type: "datetime",
    options: [],
    required: false,
    dependsOn: 1,
    conditionType: "gt",
    conditionValue: "8",
  },
  {
    prompt: "What is your idea of a dangerously good time⚡",
    type: "long",
    options: [],
    required: false,
  },
  {
    prompt: "Be honest... did you cause any trouble today ? 😆",
    type: "single",
    options: ["Yes", "No"],
    required: false,
    followUpOption: "Yes",
    followUpPlaceholder: "come on shoot it out",
  },
  {
    prompt: "This conversation would be way more interesting in person wouldnt it ?",
    type: "runaway",
    options: [],
    required: false,
  },
  {
    prompt: "",
    type: "image",
    options: ["/images/spongebob.png", "/images/remy.png"],
    required: false,
  },
  {
    prompt:
      "Anything you want to say but couldnt say it nowhere else on our vast means of comunication?",
    type: "long",
    options: [],
    required: false,
    placeholder: "dont be shy :p",
  },
  {
    prompt: "You can only pick 2 out of the bunch",
    type: "multiple",
    options: ["Burn", "Monster (anyflavour not lemonade)", "H3LL", "Red Bull"],
    required: false,
    multipleMax: 2,
  },
  {
    prompt: "Allright now a year latter when will that coffe finally happen?",
    type: "datetime",
    options: [],
    required: false,
  },
  {
    prompt: "Who pays for the coffe?",
    type: "single",
    options: ["Me", "You", "Either way"],
    required: false,
    dependsOn: 10,
    conditionType: "gte",
    conditionValue: "2000-01-01T00:00",
    responseText: "right..... like i would ever let you pay for it",
    responseTrigger: "*",
  },
  {
    prompt: "What question you would have asked me but didnt had the oportunity for ?🤔",
    type: "long",
    options: [],
    required: false,
  },
];

async function seed() {
  await pool.query("TRUNCATE responses, questions RESTART IDENTITY CASCADE");

  for (let i = 0; i < questions.length; i += 1) {
    const q = questions[i];
    await pool.query(
      `INSERT INTO questions
         (prompt, type, options, required, position, depends_on, condition_type, condition_value, follow_up_option, follow_up_placeholder, placeholder)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        q.prompt,
        q.type,
        JSON.stringify(q.options),
        q.required,
        i + 1,
        q.dependsOn ?? null,
        q.conditionType ?? null,
        q.conditionValue ?? null,
        q.followUpOption ?? null,
        q.followUpPlaceholder ?? null,
        q.placeholder ?? null,
      ],
    );
  }

  console.log(`Seeded ${questions.length} mock questions.`);
  await pool.end();
}

try {
  await seed();
} catch (error) {
  console.error("Failed to seed database:", error);
  process.exit(1);
}
