// Jest setup file
// This runs before all tests

// Load environment variables from .env.local
import { config } from 'dotenv';
import { resolve } from 'path';

// Load .env.local file
config({ path: resolve(__dirname, '../.env.local') });

// Set test timeout to 30 seconds (for async operations)
jest.setTimeout(30000);

// Suppress console logs during tests (optional - comment out if you want to see logs)
// global.console = {
//   ...console,
//   log: jest.fn(),
//   debug: jest.fn(),
//   info: jest.fn(),
//   warn: jest.fn(),
//   error: jest.fn(),
// };

