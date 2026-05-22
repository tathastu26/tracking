import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

function parseEnv(envText) {
  return envText.split(/\r?\n/).reduce((acc, line) => {
    const m = line.match(/^([^=#]+)=([\s\S]*)$/)
    if (m) acc[m[1].trim()] = m[2].trim()
    return acc
  }, {})
}

function sortValue(value) {
  if (Array.isArray(value)) return value.map(sortValue)
  if (value && typeof value === 'object') {
    const entries = Object.entries(value).sort(([a], [b]) => a.localeCompare(b))
    return entries.reduce((acc, [k, v]) => {
      acc[k] = sortValue(v)
      return acc
    }, {})
  }
  return value
}

function stableStringify(value) {
  return JSON.stringify(sortValue(value))
}

function toHex(buffer) {
  return Array.from(new Uint8Array(buffer)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

async function sha256(text) {
  const encoder = new TextEncoder()
  const data = encoder.encode(text)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return toHex(digest)
}

async function hashObject(obj) {
  return sha256(stableStringify(obj))
}

async function verifyIntegrityChain(records) {
  let expectedPrevHash = null
  for (let i = 0; i < records.length; i++) {
    const record = records[i]
    const version = record.version ?? 1
    const timestampCandidates = Array.from(new Set([
      typeof record.data.updated_at === 'string' ? record.data.updated_at : null,
      record.timestamp ?? null,
    ].filter((v) => typeof v === 'string' && v.length > 0)))

    const expectedHashes = await Promise.all(timestampCandidates.map((timestamp) =>
      hashObject({ data: record.data, prevHash: expectedPrevHash, timestamp, version })
    ))

    if (record.prevHash !== expectedPrevHash || !expectedHashes.includes(record.hash)) {
      return { valid: false, brokenAt: i + 1 }
    }

    expectedPrevHash = record.hash
  }
  return { valid: true }
}

async function main() {
  const envPath = path.resolve(process.cwd(), '.env.local')
  if (!fs.existsSync(envPath)) {
    console.error('.env.local not found')
    process.exit(1)
  }
  const env = parseEnv(fs.readFileSync(envPath, 'utf8'))
  const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL
  const SUPABASE_KEY = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_ROLE
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('Supabase credentials missing in .env.local')
    process.exit(1)
  }

  const { createClient } = await import('@supabase/supabase-js')
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

  const { data, error } = await supabase
    .from('profile_integrity_log')
    .select('user_id,hash,prev_hash,payload_snapshot,version,created_at')
    .order('created_at', { ascending: true })
    .limit(1000)

  if (error) {
    console.error('Error querying Supabase:', error.message || error)
    process.exit(1)
  }

  const rows = data || []
  if (rows.length === 0) {
    console.log('No integrity rows found')
    process.exit(0)
  }

  const groups = rows.reduce((acc, row) => {
    const uid = row.user_id || 'unknown'
    if (!acc[uid]) acc[uid] = []
    acc[uid].push({ hash: row.hash, prevHash: row.prev_hash, data: row.payload_snapshot, timestamp: row.created_at, version: row.version })
    return acc
  }, {})

  const userIds = Object.keys(groups)
  console.log('Found users with integrity logs:', userIds.length)

  // pick first user
  const firstUser = userIds[0]
  const records = groups[firstUser]
  console.log('Checking user:', firstUser, 'records:', records.length)

  const verification = await verifyIntegrityChain(records)
  console.log('Verification result for user', firstUser, JSON.stringify(verification))
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
