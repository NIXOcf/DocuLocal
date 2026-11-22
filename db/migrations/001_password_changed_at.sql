-- Idempotente: invalida los JWT emitidos antes del último cambio de contraseña (H-13).
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_changed_at timestamptz;
