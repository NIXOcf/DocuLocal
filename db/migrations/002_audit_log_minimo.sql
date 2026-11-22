-- Auditoría mínima (Ley 21.719): solo fecha, user_id, acción, recurso. Quita datos que no se necesitan.
ALTER TABLE audit_log DROP COLUMN IF EXISTS ip;
ALTER TABLE audit_log DROP COLUMN IF EXISTS request_id;
ALTER TABLE audit_log DROP COLUMN IF EXISTS detail;
