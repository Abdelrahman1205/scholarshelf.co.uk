const { Pool } = require("pg");
const bcrypt = require("bcryptjs");
const { randomUUID } = require("crypto");

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

const pool = new Pool({
  connectionString: databaseUrl,
  ssl: { rejectUnauthorized: false },
});

const users = [
  {
    username: "admin",
    password: "admin123",
    name: "School Administrator",
    role: "admin",
    email: "admin@school.edu",
  },
  {
    username: "teacher",
    password: "teacher123",
    name: "Ms. Johnson",
    role: "teacher",
    email: "teacher@school.edu",
  },
  {
    username: "parent",
    password: "parent123",
    name: "John Smith",
    role: "parent",
    email: "parent@example.com",
  },
];

async function main() {
  for (const user of users) {
    const passwordHash = bcrypt.hashSync(user.password, 10);
    await pool.query(
      "INSERT INTO users (id, username, password_hash, name, role, email, status, school_id, created_at, updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW(),NOW()) ON CONFLICT (username) DO NOTHING",
      [randomUUID(), user.username, passwordHash, user.name, user.role, user.email, "active", null],
    );
  }

  console.log("Demo users seeded successfully.");
}

main()
  .catch((error) => {
    console.error("Failed to seed demo users:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
