# MediCore

MediCore es un proyecto académico de gestión de consultorios con una página de presentación y un panel instalable como Progressive Web App (PWA).

## Qué puedes hacer

- Consultar la página principal adaptable a computadora y celular.
- Entrar al panel con un enlace de acceso enviado al correo.
- Crear, buscar, filtrar y eliminar citas.
- Consultar avisos, marcarlos como leídos o eliminarlos.
- Activar notificaciones del navegador si el dispositivo lo permite.
- Instalar la PWA y utilizar recursos almacenados en caché.

## Base de datos: Supabase

El panel está conectado al proyecto Supabase de MediCore. Utiliza PostgreSQL y tres tablas:

| Tabla | ¿Qué guarda? |
|---|---|
| `profiles` | El perfil básico de la cuenta. |
| `appointments` | Citas, fecha, hora, especialidad y nota breve. |
| `notifications` | Avisos y si ya fueron leídos. |

Las citas y notificaciones se consultan y guardan en la nube. Por eso, al entrar con la misma cuenta desde otro dispositivo, puedes recuperar los registros de esa cuenta. Las políticas de Row Level Security (RLS) restringen las filas a su propietario. El navegador usa únicamente la publishable key pública; nunca agregues una clave `service_role` o `sb_secret` al frontend.

El esquema se encuentra en `supabase/schema.sql`. La base de datos ya cuenta con las tablas `profiles`, `appointments` y `notifications`.

## Cómo probarlo

1. Abre la página publicada mediante HTTPS.
2. Entra al panel desde **Ver MediCore**.
3. Escribe tu correo y solicita el enlace de acceso.
4. Abre el enlace que recibas y regresa al panel.
5. En **Agenda de citas**, crea una cita con información ficticia.
6. Recarga la página o entra desde otro dispositivo con la misma cuenta: la cita debe seguir guardada.
7. Revisa la tabla `appointments` desde **Supabase → Table Editor** para comprobar el registro.

## Archivos principales

- `index.html`: página informativa.
- `style.css`: estilos de la página principal.
- `script.js`: menú, instalación PWA y notificaciones de prueba.
- `panel.html`: acceso y panel.
- `panel.css`: estilos del panel.
- `panel.js`: operaciones CRUD con Supabase y renderizado de citas/avisos.
- `supabase-config.js`: URL y publishable key pública.
- `supabase-auth.js`: acceso por enlace de correo.
- `supabase/schema.sql`: esquema y políticas de seguridad.
- `manifest.json`: configuración de instalación.
- `sw.js`: caché y funcionamiento básico sin conexión.
- `icons/`: iconos de MediCore.

## Importante

MediCore es una demostración académica, no un sistema clínico certificado. Utiliza solamente datos ficticios: no registres expedientes, diagnósticos ni información médica real. Las notificaciones del navegador dependen del permiso y del soporte del dispositivo; no equivalen a un servicio push garantizado cuando la aplicación está cerrada.
