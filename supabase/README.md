# Conectar MediCore con Supabase

Esta carpeta contiene el esquema inicial de base de datos para MediCore. **El esquema aún no está aplicado a ningún proyecto**: primero hay que seleccionar/identificar el proyecto Supabase correcto.

## 1. Aplicar el esquema

1. Abre el proyecto Supabase que usarás para MediCore.
2. Entra en **SQL Editor**.
3. Abre el archivo `schema.sql` de este repositorio, copia su contenido y ejecútalo.
4. En **Table Editor**, verifica que aparezcan `profiles`, `appointments` y `notifications`.
5. En **Authentication → Providers**, habilita Email si usarás correo y contraseña.

## 2. Tablas incluidas

- `profiles`: perfil básico y rol (`patient`, `doctor`, `admin`). El rol no puede cambiarse desde el cliente.
- `appointments`: citas propiedad de la cuenta autenticada.
- `notifications`: avisos privados de cada cuenta.

Todas las tablas tienen Row Level Security (RLS) habilitado y políticas que limitan el acceso a filas de la cuenta autenticada. Los permisos actuales son una base segura de inicio, no un sistema completo de permisos por consultorio. Antes de habilitar cuentas de médicos y administradores hay que definir la relación entre consultorios, médicos y pacientes y administrar esos roles desde un entorno confiable.

## 3. Credenciales del frontend

Para una aplicación estática publicada en GitHub Pages, el frontend usa una **Project URL** y una **publishable key** (o la antigua `anon` key si el proyecto aún no tiene publishable key). Esas credenciales identifican el proyecto; RLS sigue siendo la protección de los datos.

- Nunca publiques `service_role`, `sb_secret_...`, contraseñas de base de datos ni JWT secrets.
- No guardes datos médicos reales en la demostración.
- No habilites acceso anónimo a tablas de pacientes.
- Activa confirmación de correo y revisa las URL de redirección de Auth para el dominio de GitHub Pages.

## Estado actual

La interfaz de MediCore sigue usando almacenamiento local hasta que se identifique el proyecto Supabase y se conecten la autenticación y las operaciones CRUD. Este archivo SQL prepara el esquema, pero **no crea por sí mismo una conexión en vivo**.
