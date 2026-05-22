import fs from 'fs'
import path from 'path'

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

async function run() {
  const cwd = process.cwd()
  const envPath = path.resolve(cwd, '.env.local')
  if (!fs.existsSync(envPath)) {
    console.error('.env.local not found')
    process.exit(1)
  }
  const env = parseEnv(fs.readFileSync(envPath, 'utf8'))
  const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL
  const SUPABASE_KEY = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_ROLE
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('Supabase credentials missing')
    process.exit(1)
  }

  const { createClient } = await import('@supabase/supabase-js')
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

  console.log('Fetching integrity rows...')
  const { data, error } = await supabase
    .from('profile_integrity_log')
    .select('id,user_id,hash,prev_hash,payload_snapshot,version,created_at')
    .order('user_id', { ascending: true })
    .order('created_at', { ascending: true })

  if (error) {
    console.error('Query error', error)
    process.exit(1)
  }
  const rows = data || []
  console.log('Total rows:', rows.length)

  const groups = rows.reduce((acc, row) => {
    const uid = row.user_id || 'unknown'
    if (!acc[uid]) acc[uid] = []
    acc[uid].push(row)
    return acc
  }, {})

  const backups = []
  const updates = []
  const userIds = Object.keys(groups)
  console.log('Users to process:', userIds.length)

  for (const uid of userIds) {
    const recs = groups[uid]
    let expectedPrevHash = null
    for (const r of recs) {
      const dataObj = r.payload_snapshot
      const version = r.version ?? 1
      const timestamp = typeof dataObj?.updated_at === 'string' ? dataObj.updated_at : r.created_at
      const computedHash = await hashObject({ data: dataObj, prevHash: expectedPrevHash, timestamp, version })

      if (r.prev_hash !== expectedPrevHash || r.hash !== computedHash) {
        backups.push({ original: r })
        updates.push({ id: r.id, newHash: computedHash, newPrevHash: expectedPrevHash })
      }

      expectedPrevHash = computedHash
    }
  }

  if (backups.length === 0) {
    console.log('No changes required; all chains valid.')
    process.exit(0)
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const backupFile = path.resolve(cwd, `integrity_backup_${timestamp}.json`)
  fs.writeFileSync(backupFile, JSON.stringify({ backups, updates, generatedAt: new Date().toISOString() }, null, 2))
  console.log('Backup written to', backupFile)

  // Apply updates
  console.log('Applying updates:', updates.length)
  for (const u of updates) {
    const { data: updData, error: updErr } = await supabase
      .from('profile_integrity_log')
      .update({ hash: u.newHash, prev_hash: u.newPrevHash })
      .eq('id', u.id)
    if (updErr) {
      console.error('Failed to update id', u.id, updErr)
      process.exit(1)
    }
  }

  console.log('Updates applied successfully.')
  console.log('Done.')
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
