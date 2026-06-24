import express, { Request, Response, NextFunction } from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { v4 as uuid } from 'uuid';

/**
 * API Gateway de NeoLend.
 *
 * Punto único de entrada: enruta cada prefijo /api/* al microservicio
 * correspondiente (definido por variable de entorno), propaga un
 * x-correlation-id para la trazabilidad extremo a extremo y centraliza el log.
 */

const PORT = process.env.PORT || 8080;

// Mapa ruta -> URL del microservicio (con valores por defecto del compose).
const ROUTES: Record<string, string> = {
  '/api/loans': process.env.LOAN_URL ?? 'http://loan-application:3001',
  '/api/score': process.env.SCORING_URL ?? 'http://scoring-engine:8001',
  '/api/credits': process.env.CREDIT_URL ?? 'http://credit-ledger:3003',
  '/api/disbursements': process.env.DISBURSEMENT_URL ?? 'http://disbursement:3004',
  '/api/collections': process.env.COLLECTIONS_URL ?? 'http://collections:3005',
  '/api/investors': process.env.INVESTOR_URL ?? 'http://investor-portal:3006',
  '/api/gamification': process.env.GAMIFICATION_URL ?? 'http://gamification:3007',
  '/api/fraud': process.env.FRAUD_URL ?? 'http://fraud-detection:8002',
  '/api/audit': process.env.AUDIT_URL ?? 'http://audit-trail:3008',
};

const app = express();

// Correlation-id + logging
app.use((req: Request, _res: Response, next: NextFunction) => {
  const cid = (req.headers['x-correlation-id'] as string) || uuid();
  req.headers['x-correlation-id'] = cid;
  console.log(`[gateway] ${req.method} ${req.url} cid=${cid}`);
  next();
});

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'api-gateway', routes: Object.keys(ROUTES) });
});

// Monta un proxy por cada prefijo. pathRewrite quita el prefijo /api/<x>.
for (const [prefix, target] of Object.entries(ROUTES)) {
  app.use(
    prefix,
    createProxyMiddleware({
      target,
      changeOrigin: true,
      pathRewrite: { [`^${prefix}`]: '' },
      onError: (err, _req, res) => {
        (res as Response).status(502).json({ error: 'upstream_unavailable', target, detail: err.message });
      },
    } as any),
  );
}

app.listen(PORT, () => {
  console.log(`[api-gateway] escuchando en :${PORT}`);
  console.log('[api-gateway] rutas:', Object.keys(ROUTES).join(', '));
});
