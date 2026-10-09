# Conectar MediCore con Supabase

El proyecto Supabase de MediCore ya tiene el esquema inicial aplicado.

## Base de datos activa
- Project ref: `icapgdprieiduaklvckn`
- Tablas: `profiles`, `appointments`, `notifications`
- Row Level Security (RLS): activado en las tres tablas.
- El panel incorpora acceso por enlace mágico enviado al correo (sin contraseña en el formulario).

## Configuración del frontend
1. Abre `supabase-config.js`.
2. Sustituye `PEGA_AQUI_TU_PUBLISHABLE_KEY` por la publishable key pública de tu proyecto Supabase.
3. No uses `service_role`, `sb_secret_...`, contraseñas de base de datos ni JWT secrets.
4. En Supabase → Authentication → URL Configuration, agrega la URL de GitHub Pages de MediCore a las URL permitidas.
5. Prueba el acceso con un correo de prueba.

## Seguridad
Todas las tablas tienen RLS activado y las políticas limitan las filas a la cuenta autenticada. No registres datos médicos reales en esta versión de demostración. El esquema actual no implementa permisos completos por consultorio ni una agenda multi-médico; los roles no deben asignarse desde el cliente.

## Estado de la integración
El esquema está aplicado y el panel incluye el flujo de autenticación por correo. La publishable key debe configurarse en `supabase-config.js`. La sincronización CRUD de citas aún requiere completar y probar la integración del panel antes de usarla.
