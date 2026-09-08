// Single Vercel serverless entry point for all /api/* routes.
// The shared handler implementation lives in api/_handler.ts (underscore
// prefix so Vercel does not also register it as its own function).
export { default } from './_handler'
