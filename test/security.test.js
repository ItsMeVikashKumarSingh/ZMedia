import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import worker from '../src/index.js'

const mockBucket = {
  get: vi.fn(),
  put: vi.fn(),
}

const mockSystemBucket = {
  get: vi.fn(),
  put: vi.fn(),
}

const mockEnv = {
  SUPABASE_URL: 'https://test.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'test-key',
  BUCKET: mockBucket,
  SYSTEM_BUCKET: mockSystemBucket,
  BYPASS_SECRET: 'test-bypass-secret',
  B2_ENDPOINT: 'https://s3.eu-central-003.backblazeb2.com',
  B2_APPLICATION_KEY_ID: 'test-key-id',
  B2_APPLICATION_KEY: 'test-key-secret',
  B2_GALLERY_BUCKET: 'studio-public-gallery',
}

const mockCtx = {
  waitUntil: vi.fn(),
  passThroughOnException: vi.fn(),
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn())
  vi.stubGlobal('caches', {
    default: {
      match: vi.fn().mockResolvedValue(null),
      put: vi.fn().mockResolvedValue(undefined),
    },
  })
  mockBucket.get.mockReset()
  mockBucket.put.mockReset()
  mockSystemBucket.get.mockReset()
  mockSystemBucket.put.mockReset()
  mockCtx.waitUntil.mockReset()
  mockCtx.passThroughOnException.mockReset()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('ZMedia - CORS & Preflight Suite', () => {
  it('handles OPTIONS preflight across diverse paths', async () => {
    const paths = ['/', '/health', '/images/tenant-1/photo.jpg', '/site/tenant-2/logo.png', '/api/verify']
    for (const p of paths) {
      const req = new Request(`https://worker.dev${p}`, {
        method: 'OPTIONS',
        headers: {
          'Origin': 'https://studio.example.com',
          'Access-Control-Request-Method': 'PUT',
          'Access-Control-Request-Headers': 'Content-Type, X-Tenant-ID',
        },
      })
      const res = await worker.fetch(req, mockEnv, mockCtx)
      expect(res.status).toBe(204)
      expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*')
      expect(res.headers.get('Access-Control-Allow-Methods')).toContain('GET')
    }
  })

  // Matrix: 100 parameterized origin preflight requests
  Array.from({ length: 100 }).forEach((_, i) => {
    it(`responds with status 204 for origin test-${i}.example.com`, async () => {
      const req = new Request('https://worker.dev/health', {
        method: 'OPTIONS',
        headers: {
          'Origin': `https://test-${i}.example.com`,
          'Access-Control-Request-Method': 'GET',
        },
      })
      const res = await worker.fetch(req, mockEnv, mockCtx)
      expect(res.status).toBe(204)
    })
  })
})

describe('ZMedia - Health & Route Validation', () => {
  it('GET /health returns ok status and expected service structure', async () => {
    const req = new Request('https://worker.dev/health')
    const res = await worker.fetch(req, mockEnv, mockCtx)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.status).toBe('ok')
    expect(data.service).toBe('zmedia')
  })

  it('GET / returns status and service information', async () => {
    const req = new Request('https://worker.dev/')
    const res = await worker.fetch(req, mockEnv, mockCtx)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.service).toBe('wedding-image-proxy')
    expect(data.version).toBeDefined()
  })
})

describe('ZMedia - Multi-Tenant Route Isolation', () => {
  it('rejects invalid or malformed bucket access with 404', async () => {
    const req = new Request('https://worker.dev/unauthorized-bucket/tenant-1/photo.jpg')
    const res = await worker.fetch(req, mockEnv, mockCtx)
    expect(res.status).toBe(404)
  })

  it('rejects path traversal attempts with 404', async () => {
    const req = new Request('https://worker.dev/images/tenant-1/../../etc/passwd')
    const res = await worker.fetch(req, mockEnv, mockCtx)
    expect(res.status).toBe(404)
  })

  it('rejects requests missing tenant ID in path with 400', async () => {
    const req = new Request('https://worker.dev/images/')
    const res = await worker.fetch(req, mockEnv, mockCtx)
    expect(res.status).toBe(400)
  })
})
