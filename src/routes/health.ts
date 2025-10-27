import { Router } from 'express';
import { steamService, translationService } from '../index';

const router = Router();

// Health check endpoint
router.get('/', async (req, res) => {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    services: {
      steam: { status: 'unknown', message: '' },
      translation: { status: 'unknown', message: '' },
      database: { status: 'healthy', message: 'Connected' }
    }
  };

  // Check Steam API
  try {
    const steamCheck = await steamService.validateConfiguration();
    health.services.steam = {
      status: steamCheck.valid ? 'healthy' : 'error',
      message: steamCheck.message
    };
  } catch (error) {
    health.services.steam = {
      status: 'error',
      message: 'Failed to validate Steam API'
    };
  }

  // Check Translation API
  try {
    const translationCheck = await translationService.validateConfiguration();
    health.services.translation = {
      status: translationCheck.valid ? 'healthy' : 'error',
      message: translationCheck.message
    };
  } catch (error) {
    health.services.translation = {
      status: 'error',
      message: 'Failed to validate Translation API'
    };
  }

  // Determine overall status
  const hasErrors = Object.values(health.services).some(service => service.status === 'error');
  if (hasErrors) {
    health.status = 'degraded';
  }

  const statusCode = health.status === 'healthy' ? 200 : 503;
  res.status(statusCode).json(health);
});

export default router;
