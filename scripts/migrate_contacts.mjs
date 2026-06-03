/**
 * migrate_contacts.mjs — Convert flat primary_contact strings to contacts arrays
 *
 * Parses entries like:
 *   "Katie Archer katiea@archipelago.ca; Scott Buchanan scottb@archipelago.ca"
 * into:
 *   [{ name: "Katie Archer", email: "katiea@archipelago.ca" },
 *    { name: "Scott Buchanan", email: "scottb@archipelago.ca" }]
 *
 * Usage: node scripts/migrate_contacts.mjs
 */
import { readFileSync, writeFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const PATH = join(ROOT, 'data', 'programs.json')

const EMAIL_RE = /[\w.+'-]+@[\w.-]+\.[a-zA-Z]{2,}/g

function parseContact(raw) {
  const str = raw.trim()
  if (!str) return null

  const emails = str.match(EMAIL_RE) || []
  // Remove email(s) from string to get the name portion
  let name = str.replace(EMAIL_RE, '').replace(/\s{2,}/g, ' ').trim()
  // Clean up trailing punctuation left after email removal
  name = name.replace(/[;,:()\[\]]+$/g, '').replace(/^[;,:()\[\]]+/g, '').trim()

  if (!name && !emails.length) return null
  const contact = { name: name || emails[0]?.split('@')[0] || '' }
  if (emails[0]) contact.email = emails[0]
  return contact
}

function parseContacts(raw) {
  if (!raw) return []
  const parts = raw.split(';').map(s => s.trim()).filter(Boolean)
  const contacts = []

  for (const part of parts) {
    const emails = part.match(EMAIL_RE) || []
    let name = part.replace(EMAIL_RE, '').replace(/\s{2,}/g, ' ').trim()
    name = name.replace(/[;,:()\[\]]+$/g, '').replace(/^[;,:()\[\]]+/g, '').trim()

    // "Name; email@x.com" pattern — email-only part belongs to the previous contact
    const isEmailOnly = !name && emails.length > 0
    if (isEmailOnly && contacts.length > 0 && !contacts[contacts.length - 1].email) {
      contacts[contacts.length - 1].email = emails[0]
      continue
    }

    if (!name && !emails.length) continue
    const contact = { name: name || emails[0]?.split('@')[0] || '' }
    if (emails[0]) contact.email = emails[0]
    contacts.push(contact)
  }

  return contacts
}

const programs = JSON.parse(readFileSync(PATH, 'utf8'))
const log = []

const updated = programs.map(p => {
  // Skip if contacts array already exists
  if (Array.isArray(p.contacts)) return p

  const contacts = parseContacts(p.primary_contact)
  // If primary_contact_email was a separate field, merge into first contact
  if (p.primary_contact_email && contacts.length > 0 && !contacts[0].email) {
    contacts[0].email = p.primary_contact_email
  } else if (p.primary_contact_email && contacts.length === 0) {
    contacts.push({ name: '', email: p.primary_contact_email })
  }

  if (p.primary_contact || p.primary_contact_email) {
    log.push({ programme: p.programme_name, from: p.primary_contact, to: contacts })
  }

  const { primary_contact, primary_contact_email, ...rest } = p
  return { ...rest, contacts }
})

writeFileSync(PATH, JSON.stringify(updated, null, 2))

console.log(`Migrated ${log.length} programmes\n`)
for (const { programme, from, to } of log) {
  console.log(`  ${programme}`)
  console.log(`    from: ${JSON.stringify(from)}`)
  console.log(`    to:   ${JSON.stringify(to)}`)
}
console.log(`\nWritten to ${PATH}`)
