// ============================================
// CORREOS - Panadería San Carlos
// ============================================

const EMAILJS_CONFIG = Object.freeze({
    serviceId: 'service_tviskjk',
    templateId: 'template_try5hic',
    publicKey: 'ehlEQ7xd1E_AIattx'
});

let enviando = false;

export async function enviarCorreo(asunto, mensaje) {
    if (!asunto?.trim() || !mensaje?.trim()) {
        throw new Error('El asunto y el mensaje son obligatorios.');
    }

    if (enviando) {
        throw new Error('Hay un correo en proceso. Espera a que termine.');
    }

    enviando = true;

    try {
        const respuesta = await fetch(
            'https://api.emailjs.com/api/v1.0/email/send',
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    service_id: EMAILJS_CONFIG.serviceId,
                    template_id: EMAILJS_CONFIG.templateId,
                    user_id: EMAILJS_CONFIG.publicKey,
                    template_params: {
                        asunto: asunto.trim(),
                        mensaje: mensaje.trim()
                    }
                })
            }
        );

        const resultado = await respuesta.text();

        if (!respuesta.ok) {
            console.error('EmailJS:', respuesta.status, resultado);

            throw new Error(
                `EmailJS rechazó el envío (${respuesta.status}): ${resultado}`
            );
        }

        return {
            aceptado: true,
            mensaje: 'EmailJS aceptó el correo para su envío.'
        };
    } finally {
        enviando = false;
    }
}

export async function enviarCorreoPrueba() {
    return enviarCorreo(
        'Prueba de correo - Panadería San Carlos',
        'Esta es una prueba de conexión con EmailJS. ' +
        'El sistema ya puede solicitar el envío de correos desde la página web.'
    );
}