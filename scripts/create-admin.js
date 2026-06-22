// Creates or promotes a user to admin.
// Usage:
//   ADMIN_EMAIL=you@example.com ADMIN_PASSWORD=yourpassword npm run admin:create
//
// If the email already exists the account is promoted to admin and the
// password is updated. If it does not exist a new admin account is created.

import bcrypt from 'bcryptjs'
import { pool } from '../server/db.js'

const email    = process.env.ADMIN_EMAIL?.trim().toLowerCase()
const password = process.env.ADMIN_PASSWORD

if (!email || !password) {
  console.error('Error: ADMIN_EMAIL and ADMIN_PASSWORD must be set.')
  console.error('Example:')
  console.error('  ADMIN_EMAIL=you@example.com ADMIN_PASSWORD=secret npm run admin:create')
  process.exit(1)
}

if (password.length < 8) {
  console.error('Error: ADMIN_PASSWORD must be at least 8 characters.')
  process.exit(1)
}

const hash = await bcrypt.hash(password, 12)

const { rows } = await pool.query(
  `INSERT INTO users (email, password_hash, is_admin, email_verified)
   VALUES ($1, $2, TRUE, TRUE)
   ON CONFLICT (email) DO UPDATE
     SET is_admin      = TRUE,
         password_hash = $2,
         email_verified = TRUE,
         updated_at    = NOW()
   RETURNING id, email, is_admin`,
  [email, hash]
)

const u = rows[0]
console.log(`✓ Admin account ready`)
console.log(`  Email : ${u.email}`)
console.log(`  ID    : ${u.id}`)

await pool.end()
