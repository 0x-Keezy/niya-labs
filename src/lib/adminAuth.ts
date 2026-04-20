import type { NextApiRequest } from 'next';

export function verifyAdminAuth(req: NextApiRequest): boolean {
  const adminPassword = process.env.ADMIN_PASSWORD;
  
  if (!adminPassword) {
    console.warn('ADMIN_PASSWORD environment variable is not set. Admin features are disabled.');
    return false;
  }
  
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return false;
  }
  
  const token = authHeader.substring(7);
  return token === adminPassword;
}

export function isAdminConfigured(): boolean {
  return !!process.env.ADMIN_PASSWORD;
}
