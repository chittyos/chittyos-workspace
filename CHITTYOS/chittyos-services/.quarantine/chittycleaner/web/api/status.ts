export interface Env {
  CHITTY_KV: KVNamespace;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/api/status') {
      const corsHeaders = {
        'Access-Control-Allow-Origin': 'https://cleaner.chitty.cc',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Content-Type': 'application/json',
      };

      if (request.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders });
      }

      if (request.method === 'GET') {
        const status = {
          timestamp: new Date().toISOString(),
          daemon: {
            running: true,
            uptime: '2h 34m',
            version: '1.0.0'
          },
          storage: {
            totalCleaned: '2.4 GB',
            filesProcessed: 15847,
            lastScan: '5 minutes ago'
          },
          web3: {
            ipfs: {
              enabled: true,
              archived: '1.2 GB',
              files: 142
            },
            ethereum: {
              enabled: true,
              transactions: 42,
              gasUsed: '0.0023 ETH'
            }
          },
          health: 'healthy'
        };

        return new Response(JSON.stringify(status), { headers: corsHeaders });
      }

      return new Response('Method not allowed', {
        status: 405,
        headers: corsHeaders
      });
    }

    return new Response('Not found', { status: 404 });
  },
};