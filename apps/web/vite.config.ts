import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@newbal/shared': path.resolve(__dirname, '../../packages/shared/src'),
    },
  },
  define: {
    'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(
      process.env.VITE_SUPABASE_URL || 'https://nrsqfnblceubfhppqots.supabase.co'
    ),
    'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(
      process.env.VITE_SUPABASE_ANON_KEY ||
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5yc3FmbmJsY2V1YmZocHBxb3RzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE0MzgxMjMsImV4cCI6MjEwNzAxNDEyM30.TT76mjBFmqjqYMjuROz6MrGXuhGO5uFMLHZ8Y3SE5KU'
    ),
  },
  server: {
    port: 3000,
    host: true,
  },
});
