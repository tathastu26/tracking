function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortValue)
  }

  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))

    return entries.reduce<Record<string, unknown>>((accumulator, [key, nestedValue]) => {
      accumulator[key] = sortValue(nestedValue)
      return accumulator
    }, {})
  }

  return value
}

function stableStringify(value: unknown): string {
  return JSON.stringify(sortValue(value))
}

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

async function sha256(text: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(text)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return toHex(digest)
}

export async function hashObject(obj: Record<string, unknown>): Promise<string> {
  return sha256(stableStringify(obj))
}

export async function buildIntegrityRecord(
  data: Record<string, unknown>,
  prevHash: string | null
): Promise<{ hash: string; prevHash: string | null; timestamp: string; version: number }> {
  const timestamp = typeof data.updated_at === 'string' ? data.updated_at : new Date().toISOString()
  const version = 1
  const hash = await hashObject({ data, prevHash, timestamp, version })

  return { hash, prevHash, timestamp, version }
}

export async function verifyIntegrityChain(
  records: Array<{
    hash: string
    prevHash: string | null
    data: Record<string, unknown>
    timestamp?: string
    version?: number
  }>
): Promise<{ valid: boolean; brokenAt?: number }> {
  let expectedPrevHash: string | null = null

  for (let index = 0; index < records.length; index += 1) {
    const record = records[index]
    const version = record.version ?? 1
    const timestampCandidates = Array.from(
      new Set(
        [
          typeof record.data.updated_at === 'string' ? record.data.updated_at : null,
          record.timestamp ?? null,
        ].filter((value): value is string => typeof value === 'string' && value.length > 0)
      )
    )

    const expectedHashes = await Promise.all(
      timestampCandidates.map((timestamp) =>
        hashObject({
          data: record.data,
          prevHash: expectedPrevHash,
          timestamp,
          version,
        })
      )
    )

    if (
      record.prevHash !== expectedPrevHash ||
      !expectedHashes.includes(record.hash)
    ) {
      return { valid: false, brokenAt: index + 1 }
    }

    expectedPrevHash = record.hash
  }

  return { valid: true }
}