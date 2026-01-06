/**
 * GitChitty Package Registry - git.chitty.cc
 * Serves packages from R2 storage
 *
 * Patterns:
 *   git.chitty.cc/{pkg}           -> download latest
 *   git.chitty.cc/{pkg}.json      -> package metadata
 *   git.chitty.cc/{pkg}/install   -> install script
 *   git.chitty.cc/{pkg}@{version} -> specific version
 */

import { getPackageMetadata, corsHeaders } from '@chittyos/core'
import type { PackageMetadata } from '@chittyos/core'

interface Env {
  PACKAGES?: R2Bucket
}

function parsePackagePath(path: string): {
  name: string
  version?: string
  action?: 'json' | 'install' | 'download'
} | null {
  // Remove leading slash
  const clean = path.replace(/^\//, '')
  if (!clean) return null

  // Check for .json suffix
  if (clean.endsWith('.json')) {
    return { name: clean.slice(0, -5), action: 'json' }
  }

  // Check for /install suffix
  if (clean.endsWith('/install')) {
    return { name: clean.slice(0, -8), action: 'install' }
  }

  // Check for @version
  const versionMatch = clean.match(/^([a-z][a-z0-9-]*)@(.+)$/)
  if (versionMatch) {
    return { name: versionMatch[1], version: versionMatch[2], action: 'download' }
  }

  // Plain package name
  if (/^[a-z][a-z0-9-]*$/.test(clean)) {
    return { name: clean, action: 'download' }
  }

  return null
}

function generateInstallScript(pkg: PackageMetadata): string {
  const lines = [
    '#!/bin/bash',
    `# Install script for ${pkg.name}`,
    'set -e',
    ''
  ]

  if (pkg.platforms.includes('npm')) {
    lines.push(`# Install via npm`)
    lines.push(`if command -v npm &> /dev/null; then`)
    lines.push(`  npm install -g ${pkg.npm || pkg.name}`)
    lines.push(`  exit 0`)
    lines.push(`fi`)
    lines.push('')
  }

  if (pkg.platforms.includes('brew')) {
    lines.push(`# Install via Homebrew`)
    lines.push(`if command -v brew &> /dev/null; then`)
    lines.push(`  brew install ${pkg.brew || pkg.name}`)
    lines.push(`  exit 0`)
    lines.push(`fi`)
    lines.push('')
  }

  if (pkg.platforms.includes('binary')) {
    lines.push(`# Direct binary download`)
    lines.push(`curl -fsSL "${pkg.install_url}" | sh`)
    lines.push('')
  }

  lines.push(`echo "No supported package manager found. Visit: ${pkg.install_url}"`)
  lines.push('exit 1')

  return lines.join('\n')
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url)

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders(request.headers.get('Origin') || undefined) })
    }

    if (url.pathname === '/health') {
      return Response.json({ status: 'ok', service: 'gitchitty' })
    }

    // Package index
    if (url.pathname === '/' || url.pathname === '/packages') {
      return Response.json({
        registry: 'git.chitty.cc',
        usage: {
          download: 'git.chitty.cc/{package}',
          metadata: 'git.chitty.cc/{package}.json',
          install: 'curl -fsSL git.chitty.cc/{package}/install | bash',
          version: 'git.chitty.cc/{package}@{version}'
        }
      })
    }

    const parsed = parsePackagePath(url.pathname)
    if (!parsed) {
      return Response.json({ error: 'Invalid package path' }, { status: 400 })
    }

    // Get package metadata from registry
    const metadata = await getPackageMetadata(parsed.name)
    if (!metadata) {
      return Response.json({ error: `Package '${parsed.name}' not found` }, { status: 404 })
    }

    // Return JSON metadata
    if (parsed.action === 'json') {
      return Response.json(metadata)
    }

    // Return install script
    if (parsed.action === 'install') {
      return new Response(generateInstallScript(metadata), {
        headers: {
          'Content-Type': 'text/x-shellscript',
          'Content-Disposition': `attachment; filename="${parsed.name}-install.sh"`
        }
      })
    }

    // Download package
    if (parsed.action === 'download') {
      // Try R2 first
      if (env.PACKAGES) {
        const version = parsed.version || metadata.version
        const key = `${parsed.name}/${version}/${parsed.name}.tar.gz`
        const object = await env.PACKAGES.get(key)

        if (object) {
          return new Response(object.body, {
            headers: {
              'Content-Type': 'application/gzip',
              'Content-Disposition': `attachment; filename="${parsed.name}-${version}.tar.gz"`,
              'X-Package-Version': version
            }
          })
        }
      }

      // Redirect to install URL
      return Response.redirect(metadata.install_url, 302)
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 })
  }
}
