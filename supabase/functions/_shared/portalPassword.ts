// VetCare - contraseñas temporales y correo de credenciales del Portal del
// propietario. Vive en _shared/ (no dentro de portal-acceso/) porque ahora lo
// usan dos Edge Functions: portal-acceso ('automatico'/'restablecer') y
// portal-olvide-password (autoservicio desde el login) -- carpetas con "_" no
// se despliegan como funcion propia, es el lugar que reserva Supabase para
// codigo compartido entre funciones.
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

// Alfabeto sin caracteres ambiguos (0/O, 1/l/I) para que una contraseña leida
// desde el correo por el propietario no genere errores de trascripcion.
const ALFABETO_PASSWORD = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%';

export function generarPasswordTemporal(longitud = 12): string {
  const bytes = new Uint8Array(longitud);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => ALFABETO_PASSWORD[b % ALFABETO_PASSWORD.length]).join('');
}

// Copia literal de los tokens de frontend/src/theme.ts (ORGANIC) -- una Edge
// Function (Deno) no puede importar ese archivo (proyecto/runtime de frontend
// distinto), asi que los valores concretos se repiten aqui a proposito. Si
// theme.ts cambia la paleta "Organic", actualizar tambien aqui.
const TEMA = {
  bg: '#f5ead8',
  surface: '#ffffff',
  text: '#201e1d',
  textSecundario: '#645c50',
  neutral100: '#f9f4ed',
  neutral300: '#dcd3c4',
  accent500: '#d67f48',
  accent600: '#b2622d',
  accent100: '#fff2eb',
  radiusLg: '28px',
  fuenteEncabezado: '"Segoe UI", system-ui, sans-serif',
  fuenteCuerpo: '"Segoe UI", Roboto, Arial, sans-serif',
};

interface CredencialesPortal {
  correo: string;
  nombrePropietario: string;
  password: string;
  esNuevaCuenta: boolean;
  // URL absoluta a /portal/ingresar (deriva del header Origin de quien llama a
  // la Edge Function). Sin esto, el correo solo podia decir la ruta relativa
  // "/portal/ingresar", sin dominio: el propietario no tenia forma de saber a
  // que sitio pertenecia esa ruta y terminaba entrando por la URL principal
  // (login de personal) -- bug real, ver CLAUDE.md seccion 14.
  urlPortal: string | null;
}

// Exportadas (dejan de ser privadas) para poder probarlas directo desde
// portalPassword.test.ts -- en particular, que un nombre de propietario con
// HTML/script no quede sin escapar en el correo (ver ese archivo).
export function escaparHtml(texto: string): string {
  return texto.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function plantillaHtml(opciones: {
  titulo: string;
  introduccion: string;
  correo: string;
  password: string;
  urlPortal: string | null;
  notaFinal: string;
}): string {
  const { titulo, introduccion, correo, password, urlPortal, notaFinal } = opciones;
  const botonAcceso = urlPortal
    ? `<tr><td align="center" style="padding: 8px 0 4px;">
         <a href="${urlPortal}" style="display:inline-block; background:${TEMA.accent600}; color:#ffffff; text-decoration:none; font-family:${TEMA.fuenteCuerpo}; font-weight:600; font-size:15px; padding:12px 32px; border-radius:999px;">Ingresar al portal</a>
       </td></tr>
       <tr><td align="center" style="padding: 4px 0 0; font-family:${TEMA.fuenteCuerpo}; font-size:12px; color:${TEMA.textSecundario};">
         O copia este enlace: <a href="${urlPortal}" style="color:${TEMA.accent600};">${urlPortal}</a>
       </td></tr>`
    : `<tr><td align="center" style="padding: 8px 0; font-family:${TEMA.fuenteCuerpo}; font-size:13px; color:${TEMA.textSecundario};">
         Pide la dirección del Portal del propietario en la clínica si no la tienes.
       </td></tr>`;

  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escaparHtml(titulo)}</title>
</head>
<body style="margin:0; padding:24px 12px; background:${TEMA.bg}; font-family:${TEMA.fuenteCuerpo};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px; margin:0 auto;">
    <tr>
      <td style="background:${TEMA.accent600}; border-radius:${TEMA.radiusLg} ${TEMA.radiusLg} 0 0; padding:20px 24px; text-align:center;">
        <span style="font-family:${TEMA.fuenteEncabezado}; font-size:22px; color:#ffffff; font-weight:700;">🐾 VetCare</span>
      </td>
    </tr>
    <tr>
      <td style="background:${TEMA.surface}; border-radius:0 0 ${TEMA.radiusLg} ${TEMA.radiusLg}; padding:32px 28px; box-shadow:0 12px 32px rgba(46,43,37,0.14);">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          <tr><td style="font-family:${TEMA.fuenteEncabezado}; font-size:20px; color:${TEMA.text}; padding-bottom:12px;">${escaparHtml(titulo)}</td></tr>
          <tr><td style="font-family:${TEMA.fuenteCuerpo}; font-size:15px; color:${TEMA.text}; line-height:1.5; padding-bottom:20px;">${escaparHtml(introduccion)}</td></tr>
          <tr>
            <td style="background:${TEMA.neutral100}; border:1px solid ${TEMA.neutral300}; border-radius:16px; padding:16px 20px; margin-bottom: 20px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="font-family:${TEMA.fuenteCuerpo}; font-size:13px; color:${TEMA.textSecundario}; padding-bottom:4px;">Correo</td>
                </tr>
                <tr>
                  <td style="font-family:${TEMA.fuenteCuerpo}; font-size:15px; color:${TEMA.text}; padding-bottom:12px;">${escaparHtml(correo)}</td>
                </tr>
                <tr>
                  <td style="font-family:${TEMA.fuenteCuerpo}; font-size:13px; color:${TEMA.textSecundario}; padding-bottom:4px;">Contraseña temporal</td>
                </tr>
                <tr>
                  <td style="font-family:'Courier New', monospace; font-size:17px; letter-spacing:0.5px; color:${TEMA.accent600}; font-weight:700;">${escaparHtml(password)}</td>
                </tr>
              </table>
            </td>
          </tr>
          <tr><td style="height:20px;"></td></tr>
          ${botonAcceso}
          <tr><td style="height:20px;"></td></tr>
          <tr>
            <td style="background:${TEMA.accent100}; border-radius:12px; padding:12px 16px; font-family:${TEMA.fuenteCuerpo}; font-size:13px; color:${TEMA.text}; line-height:1.4;">
              <b>Importante:</b> este acceso es distinto al que usa el personal de la clínica — no entres por la página principal del sistema, usa el botón de arriba. Cambia esta contraseña apenas puedas.
            </td>
          </tr>
        </table>
      </td>
    </tr>
    <tr>
      <td style="padding:16px 8px; text-align:center; font-family:${TEMA.fuenteCuerpo}; font-size:12px; color:${TEMA.textSecundario};">
        ${escaparHtml(notaFinal)}
      </td>
    </tr>
  </table>
</body>
</html>`;
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
    ? `Hola ${datos.nombrePropietario}, se creó tu acceso al Portal del propietario de VetCare.`
    : `Hola ${datos.nombrePropietario}, se generó una nueva contraseña temporal para tu acceso al Portal del propietario de VetCare.`;
  const lineaAcceso = datos.urlPortal
    ? `Ingresa desde: ${datos.urlPortal}`
    : 'Pide la dirección del Portal del propietario en la clínica si no la tienes.';

  const info = await transporte.sendMail({
    from: remitente,
    to: datos.correo,
    subject: titulo,
    text: `Hola ${datos.nombrePropietario},

${datos.esNuevaCuenta ? 'Se creó tu acceso al Portal del propietario de VetCare.' : 'Se generó una nueva contraseña temporal para tu acceso al Portal del propietario de VetCare.'}

Correo:      ${datos.correo}
Contraseña:  ${datos.password}

${lineaAcceso}
Importante: este acceso es distinto al que usa el personal de la clínica -- no
uses la página principal del sistema, entra por la dirección de arriba.
Cambia esta contraseña apenas puedas.

Si no reconoces esta solicitud, contacta a la clínica.`,
    html: plantillaHtml({
      titulo,
      introduccion,
      correo: datos.correo,
      password: datos.password,
      urlPortal: datos.urlPortal,
      notaFinal: 'Si no reconoces esta solicitud, contacta a la clínica. Este correo se generó automáticamente.',
    }),
  });

  console.log('enviarCredencialesPortal: respuesta SMTP', JSON.stringify({
    messageId: info.messageId,
    accepted: info.accepted,
    rejected: info.rejected,
    response: info.response,
  }));
}
