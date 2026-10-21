# MediCore

MediCore es un proyecto académico de gestión de consultorios con una página de presentación y un panel instalable como Progressive Web App (PWA).

## Qué puedes hacer

- Consultar la página principal adaptable a computadora y celular.
- Entrar al panel con un enlace de acceso enviado al correo.
- Crear, buscar, filtrar y eliminar citas.
- Consultar avisos, marcarlos como leídos o eliminarlos.
- Consultar el módulo de reportes y recomendaciones: indicadores, gráficas, exportación a PDF y catálogo de enfermedades (requiere el esquema clínico complementario).
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
- `reportes.html` y `reportes.js`: analítica, gráficas y recomendaciones.
- `supabase/reports-schema.sql`: esquema complementario para pacientes, expedientes, planes nutricionales y enfermedades. Revísalo y ejecútalo en el proyecto Supabase correcto antes de usar ese módulo.
- `supabase-config.js`: URL y publishable key pública.
- `supabase-auth.js`: acceso por enlace de correo.
- `supabase/schema.sql`: esquema y políticas de seguridad.
- `manifest.json`: configuración de instalación.
- `sw.js`: caché y funcionamiento básico sin conexión.
- `icons/`: iconos de MediCore.

## Importante

MediCore es una demostración académica, no un sistema clínico certificado. Utiliza solamente datos ficticios: no registres expedientes, diagnósticos ni información médica real. Las notificaciones del navegador dependen del permiso y del soporte del dispositivo; no equivalen a un servicio push garantizado cuando la aplicación está cerrada.


## Registro, inicio de sesión y base de datos (Supabase)

MediCore incluye registro por correo y contraseña, inicio de sesión, cierre de sesión y recuperación de contraseña. Las cuentas utilizan Supabase Auth; las tablas privadas están protegidas con Row Level Security (RLS) y cada usuario solo puede consultar sus propios registros.

### Configuración obligatoria del proyecto Supabase

1. Abre el proyecto Supabase que corresponde a MediCore y entra en **SQL Editor**.
2. Ejecuta el archivo completo [`supabase/medicore-schema.sql`](./supabase/medicore-schema.sql). Crea las tablas de agenda, notificaciones, pacientes, expedientes, planes, catálogo de enfermedades y citas ficticias.
3. En **Authentication → URL Configuration**, agrega la URL de producción de MediCore a los sitios permitidos y a las URLs de redirección para confirmación y recuperación de contraseña.
4. En **Authentication → Providers → Email**, habilita Email. Si la confirmación está activa, el usuario debe confirmar su correo antes de iniciar sesión.
5. En `supabase-config.js` verifica que la URL del proyecto y la publishable key correspondan al MISMO proyecto. Nunca coloques una `service_role` o una clave secreta en el frontend.
6. Prueba: crea una cuenta, confirma el correo si se solicita, inicia sesión, crea una cita ficticia, cierra sesión y vuelve a entrar para comprobar que los datos persisten. Prueba también el restablecimiento de contraseña.

**Importante:** el esquema SQL está versionado en el repositorio, pero debe ejecutarse en el SQL Editor del proyecto Supabase correcto para que existan las tablas. La clave pública no puede crear tablas ni cambiar políticas. La demo pública usa una tabla separada y solo admite datos ficticios; nunca debe utilizarse para información clínica real.
