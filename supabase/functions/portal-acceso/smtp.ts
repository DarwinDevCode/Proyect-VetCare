// VetCare - envio de credenciales del portal via SMTP (Gmail).
//
// Aislado de index.ts porque solo lo necesitan las acciones 'automatico' y
// 'restablecer' -- 'manual' no debe fallar si el SMTP no esta configurado, asi
// que las variables de entorno se leen recien al enviar, no al cargar el modulo.
//
// nodemailer (via npm:), no denomailer: es el que usa el propio ejemplo oficial
// de Supabase para este caso (examples/edge-functions/.../send-email-smtp). Se
// probo primero con denomailer (import por URL, deno.land/x) y el cliente SMTP
// crasheaba el worker completo con "invalid cmd" al negociar STARTTLS contra
// smtp.gmail.com:587 en este runtime (supabase-edge-runtime 1.74, Deno 2.1) --
// un fallo que ni siquiera el try/catch de quien llama podia atrapar (se cae a
// nivel de event loop, no como una Promise rechazada). nodemailer via npm si
// funciona.
import nodemailer from 'npm:nodemailer@^9';

interface CredencialesPortal {
  correo: string;
  nombrePropietario: string;
  password: string;
  esNuevaCuenta: boolean;
  // URL absoluta a /portal/ingresar (deriva del header Origin de quien llama a
  // la Edge Function -- ver index.ts). Sin esto, el correo solo podia decir la
  // ruta relativa "/portal/ingresar", sin dominio: el propietario no tenia forma
  // de saber a que sitio pertenecia esa ruta y terminaba entrando por la URL
  // principal (login de personal), que rechaza su cuenta de portal con "Tu cuenta
  // no tiene un perfil configurado" -- bug real encontrado por el usuario.
  urlPortal: string | null;
}

export async function enviarCredencialesPortal(datos: CredencialesPortal): Promise<void> {
  const host = Deno.env.get('VETCARE_SMTP_HOST');
  const puertoTexto = Deno.env.get('VETCARE_SMTP_PORT');
  const usuario = Deno.env.get('VETCARE_SMTP_USUARIO');
  const password = Deno.env.get('VETCARE_SMTP_PASSWORD');
  const remitente = Deno.env.get('VETCARE_SMTP_REMITENTE') ?? usuario;
  const tlsHabilitado = (Deno.env.get('VETCARE_SMTP_TLS') ?? 'true').toLowerCase() !== 'false';

  if (!host || !puertoTexto || !usuario || !password || !remitente) {
    throw new Error('SMTP no configurado: faltan variables VETCARE_SMTP_* en el entorno.');
  }

  const puerto = Number(puertoTexto);
  // 465 = TLS implicito; cualquier otro puerto (587 en el caso de Gmail) usa
  // STARTTLS -- "secure" en nodemailer es especificamente ese TLS implicito,
  // no un interruptor general de "usar cifrado".
  const tlsImplicito = puerto === 465;

  const transporte = nodemailer.createTransport({
    host,
    port: puerto,
    secure: tlsImplicito,
    requireTLS: !tlsImplicito && tlsHabilitado,
    auth: { user: usuario, pass: password },
  });

  const titulo = datos.esNuevaCuenta ? 'Acceso al Portal VetCare' : 'Nueva contraseña del Portal VetCare';
  const introduccion = datos.esNuevaCuenta
    ? 'Se creó tu acceso al Portal del propietario de VetCare.'
    : 'Se generó una nueva contraseña temporal para tu acceso al Portal del propietario de VetCare.';
  const lineaAcceso = datos.urlPortal
    ? `Ingresa desde: ${datos.urlPortal}`
    : 'Pide la dirección del Portal del propietario en la clínica si no la tienes.';
  const lineaAccesoHtml = datos.urlPortal
    ? `<p>Ingresa desde <a href="${datos.urlPortal}">${datos.urlPortal}</a>.</p>`
    : '<p>Pide la dirección del Portal del propietario en la clínica si no la tienes.</p>';

  await transporte.sendMail({
    from: remitente,
    to: datos.correo,
    subject: titulo,
    text: `Hola ${datos.nombrePropietario},

${introduccion}

Correo:      ${datos.correo}
Contraseña:  ${datos.password}

${lineaAcceso}
Importante: este acceso es distinto al que usa el personal de la clínica -- no
uses la página principal del sistema, entra por la dirección de arriba.
Cambia esta contraseña apenas puedas.

Si no reconoces esta solicitud, contacta a la clínica.`,
    html: `<p>Hola ${datos.nombrePropietario},</p>
<p>${introduccion}</p>
<p><b>Correo:</b> ${datos.correo}<br/><b>Contraseña:</b> ${datos.password}</p>
${lineaAccesoHtml}
<p><b>Importante:</b> este acceso es distinto al que usa el personal de la clínica — no entres por la página principal del sistema, usa el enlace de arriba. Cambia esta contraseña apenas puedas.</p>
<p>Si no reconoces esta solicitud, contacta a la clínica.</p>`,
  });
}
