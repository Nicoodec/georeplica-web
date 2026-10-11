# Genera aviso-legal.html, privacidad.html y cookies.html desde una plantilla común.
# Los datos de la empresa ({{razonSocial}}, {{cif}}...) se rellenan al compilar
# desde legal.config.json (ver vite.config.js). Ejecutar: python scripts/legal-pages.py
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

FLAG_ES = '<svg class="lang__flag" viewBox="0 0 3 2" aria-hidden="true"><rect width="3" height="2" fill="#c60b1e"/><rect y=".5" width="3" height="1" fill="#ffc400"/></svg>'
FLAG_UK = '<svg class="lang__flag" viewBox="0 0 60 30" aria-hidden="true"><clipPath id="ukS"><path d="M0 0v30h60V0z"/></clipPath><clipPath id="ukT"><path d="M30 15h30v15zv15H0zH0V0zV0h30z"/></clipPath><g clip-path="url(#ukS)"><path d="M0 0v30h60V0z" fill="#012169"/><path d="M0 0l60 30m0-30L0 30" stroke="#fff" stroke-width="6"/><path d="M0 0l60 30m0-30L0 30" clip-path="url(#ukT)" stroke="#C8102E" stroke-width="4"/><path d="M30 0v30M0 15h60" stroke="#fff" stroke-width="10"/><path d="M30 0v30M0 15h60" stroke="#C8102E" stroke-width="6"/></g></svg>'

PAGES = [
    ('aviso-legal.html', 'Aviso legal', 'Legal notice'),
    ('privacidad.html', 'Política de privacidad', 'Privacy policy'),
    ('cookies.html', 'Política de cookies', 'Cookie policy'),
]


def foot_nav(current):
    out = []
    for file, es, en in PAGES:
        cur = ' aria-current="page"' if file == current else ''
        out.append(f'<a href="./{file}" data-keep-lang{cur}><span data-lang="es">{es}</span><span data-lang="en">{en}</span></a>')
    return '\n        '.join(out)


def page(file, es_title, en_title, body):
    titles = json.dumps({'es': f'{es_title} — GeoReplica Technologies', 'en': f'{en_title} — GeoReplica Technologies'}, ensure_ascii=False)
    return f'''<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>{es_title} — GeoReplica Technologies</title>
  <meta name="theme-color" content="#060708" />
  <link rel="icon" href="./favicon.ico" sizes="48x48" />
  <link rel="icon" type="image/png" sizes="32x32" href="./favicon-32.png" />
  <link rel="icon" type="image/png" sizes="96x96" href="./favicon-96.png" />
  <link rel="icon" type="image/png" sizes="192x192" href="./favicon-192.png" />
  <link rel="apple-touch-icon" href="./apple-touch-icon.png" />
  <link rel="manifest" href="./site.webmanifest" />
  <link rel="canonical" href="https://georeplica.ai/{file}" />
  <script type="application/json" id="titles">{titles}</script>
</head>
<body>
  <header class="top">
    <a class="brand" href="./" data-keep-lang aria-label="GeoReplica">
      <svg viewBox="0 0 540 480" aria-hidden="true"><path d="M 31 306 A 240 240 0 1 1 496 222" /><circle cx="345" cy="288" r="27" /><path d="M 488 272 L 499 438 Q 500 455 483 455 L 405 455" /></svg>
      <span>geo<b>Replica</b></span>
    </a>
    <div class="top__right">
      <a class="back mono" href="./" data-keep-lang><span data-lang="es">← Volver a la web</span><span data-lang="en">← Back to the site</span></a>
      <div class="lang mono" role="group" aria-label="Idioma / Language">
        <button type="button" class="lang__opt is-active" data-l="es" aria-pressed="true" lang="es" title="Español">{FLAG_ES}<span>ES</span></button>
        <button type="button" class="lang__opt" data-l="en" aria-pressed="false" lang="en" title="English">{FLAG_UK}<span>EN</span></button>
      </div>
    </div>
  </header>

  <main>
    <article class="doc">
{body}
    </article>
  </main>

  <footer class="foot mono">
    <span>GeoReplica Technologies · Internet of Twins</span>
    <nav aria-label="Legal">
        {foot_nav(file)}
    </nav>
  </footer>
  <script type="module" src="./src/legal.js"></script>
</body>
</html>
'''


def both(es, en):
    return f'<div data-lang="es">\n{es}\n</div>\n<div data-lang="en">\n{en}\n</div>'


TITULAR_ES = '''<dl class="data">
  <div><dt>Titular</dt><dd>{{razonSocial}}</dd></div>
  <div><dt>CIF</dt><dd>{{cif}}</dd></div>
  <div><dt>Domicilio social</dt><dd>{{domicilio}}</dd></div>
  <div><dt>Datos registrales</dt><dd>{{registro}}</dd></div>
  <div><dt>Correo electrónico</dt><dd><a href="mailto:{{email}}">{{email}}</a></dd></div>
  <div><dt>Sitio web</dt><dd>{{web}}</dd></div>
</dl>'''
TITULAR_EN = '''<dl class="data">
  <div><dt>Owner</dt><dd>{{razonSocial}}</dd></div>
  <div><dt>Tax ID (CIF)</dt><dd>{{cif}}</dd></div>
  <div><dt>Registered office</dt><dd>{{domicilio}}</dd></div>
  <div><dt>Registry details</dt><dd>{{registro}}</dd></div>
  <div><dt>Email</dt><dd><a href="mailto:{{email}}">{{email}}</a></dd></div>
  <div><dt>Website</dt><dd>{{web}}</dd></div>
</dl>'''

AVISO = both('''      <div class="kicker mono"><b>01</b> Legal</div>
      <h1>Aviso legal</h1>
      <p class="updated mono">Última actualización: {{fecha}}</p>

      <h2><span class="n">01</span>Datos identificativos</h2>
      <p>En cumplimiento del artículo 10 de la Ley 34/2002, de 11 de julio, de Servicios de la Sociedad de la Información y de Comercio Electrónico (LSSI-CE), se informa de los datos del titular de este sitio web:</p>
''' + TITULAR_ES + '''

      <h2><span class="n">02</span>Objeto</h2>
      <p>Este sitio web tiene como finalidad presentar la actividad, los servicios y la tecnología de gemelos digitales de {{razonSocial}}, así como ofrecer un medio de contacto. El acceso y la navegación atribuyen la condición de usuario e implican la aceptación de este aviso legal.</p>

      <h2><span class="n">03</span>Condiciones de uso</h2>
      <p>El usuario se compromete a hacer un uso adecuado del sitio web, conforme a la ley, la buena fe y el orden público, y a no emplearlo para actividades ilícitas, lesivas de derechos de terceros o que puedan dañar, inutilizar o sobrecargar el sitio o impedir su normal utilización.</p>
      <p>El acceso al sitio web es gratuito y no requiere registro.</p>

      <h2><span class="n">04</span>Propiedad intelectual e industrial</h2>
      <p>Los contenidos del sitio web (textos, diseño, código, gráficos, animaciones, logotipos y marcas) son titularidad de {{razonSocial}} o de terceros que han autorizado su uso, y están protegidos por la normativa de propiedad intelectual e industrial. Queda prohibida su reproducción, distribución, comunicación pública o transformación sin autorización expresa, salvo los usos permitidos por la ley.</p>
      <p>El modelo tridimensional base de la figura procede de los ejemplos públicos de la biblioteca three.js (personaje de Mixamo) y se utiliza conforme a sus condiciones de uso.</p>

      <h2><span class="n">05</span>Responsabilidad</h2>
      <p>{{razonSocial}} procura que la información del sitio sea correcta y esté actualizada, pero no garantiza la ausencia de errores ni la disponibilidad ininterrumpida del servicio. Las cifras, simulaciones y escenarios mostrados en las demostraciones interactivas tienen carácter ilustrativo y no constituyen datos reales, asesoramiento ni compromiso contractual.</p>
      <p>En particular, los contenidos sobre salud son una demostración tecnológica y no constituyen consejo médico ni sustituyen la valoración de un profesional sanitario.</p>

      <h2><span class="n">06</span>Enlaces</h2>
      <p>Si el sitio incluye enlaces a páginas de terceros, {{razonSocial}} no se responsabiliza de su contenido ni de sus políticas, que se rigen por sus propias condiciones.</p>

      <h2><span class="n">07</span>Protección de datos y cookies</h2>
      <p>El tratamiento de datos personales se describe en la <a href="./privacidad.html" data-keep-lang>Política de privacidad</a>, y el uso de cookies y tecnologías similares, en la <a href="./cookies.html" data-keep-lang>Política de cookies</a>.</p>

      <h2><span class="n">08</span>Legislación aplicable y jurisdicción</h2>
      <p>Este aviso legal se rige por la legislación española. Para cualquier controversia, las partes se someten a los juzgados y tribunales de {{tribunales}}, salvo que la normativa aplicable establezca otro fuero, en particular cuando el usuario tenga la condición de consumidor.</p>''',
'''      <div class="kicker mono"><b>01</b> Legal</div>
      <h1>Legal notice</h1>
      <p class="updated mono">Last updated: {{fechaEn}}</p>

      <h2><span class="n">01</span>Owner of the website</h2>
      <p>In accordance with article 10 of Spanish Law 34/2002 of 11 July on Information Society Services and Electronic Commerce (LSSI-CE), the details of the owner of this website are as follows:</p>
''' + TITULAR_EN + '''

      <h2><span class="n">02</span>Purpose</h2>
      <p>This website presents the activity, services and digital twin technology of {{razonSocial}} and provides a means of contact. Accessing and browsing the website makes you a user and implies acceptance of this legal notice.</p>

      <h2><span class="n">03</span>Terms of use</h2>
      <p>Users agree to use the website lawfully and in good faith, and not to use it for illegal purposes, to infringe the rights of others, or in any way that could damage, disable or overload the website or prevent its normal use.</p>
      <p>Access to the website is free of charge and requires no registration.</p>

      <h2><span class="n">04</span>Intellectual and industrial property</h2>
      <p>The contents of this website (text, design, code, graphics, animations, logos and trademarks) belong to {{razonSocial}} or to third parties who have authorised their use, and are protected by intellectual and industrial property law. Reproduction, distribution, public communication or transformation without express permission is prohibited, except where permitted by law.</p>
      <p>The base 3D model of the figure comes from the public examples of the three.js library (a Mixamo character) and is used in accordance with its terms of use.</p>

      <h2><span class="n">05</span>Liability</h2>
      <p>{{razonSocial}} endeavours to keep the information on this website accurate and up to date, but does not guarantee that it is free of errors or that the service will be available without interruption. The figures, simulations and scenarios shown in the interactive demonstrations are illustrative only and do not constitute real data, advice or a contractual commitment.</p>
      <p>In particular, the health content is a technology demonstration and does not constitute medical advice or replace assessment by a healthcare professional.</p>

      <h2><span class="n">06</span>Links</h2>
      <p>Where the website links to third-party pages, {{razonSocial}} is not responsible for their content or policies, which are governed by their own terms.</p>

      <h2><span class="n">07</span>Data protection and cookies</h2>
      <p>The processing of personal data is described in the <a href="./privacidad.html" data-keep-lang>Privacy policy</a>, and the use of cookies and similar technologies in the <a href="./cookies.html" data-keep-lang>Cookie policy</a>.</p>

      <h2><span class="n">08</span>Governing law and jurisdiction</h2>
      <p>This legal notice is governed by Spanish law. Any dispute shall be submitted to the courts of {{tribunales}}, unless applicable law provides otherwise, in particular where the user is a consumer.</p>''')

PRIVACIDAD = both('''      <div class="kicker mono"><b>02</b> Legal</div>
      <h1>Política de privacidad</h1>
      <p class="updated mono">Última actualización: {{fecha}}</p>

      <p>Esta política explica cómo se tratan los datos personales de quienes visitan este sitio web o se ponen en contacto con nosotros, conforme al Reglamento (UE) 2016/679 (RGPD) y a la Ley Orgánica 3/2018 de Protección de Datos Personales y garantía de los derechos digitales (LOPDGDD).</p>

      <h2><span class="n">01</span>Responsable del tratamiento</h2>
''' + TITULAR_ES + '''

      <h2><span class="n">02</span>Qué datos tratamos y para qué</h2>
      <table class="table">
        <thead><tr><th>Actividad</th><th>Datos</th><th>Finalidad</th><th>Base jurídica</th></tr></thead>
        <tbody>
          <tr><td>Contacto por correo electrónico</td><td>Nombre, dirección de correo y lo que nos cuentes en tu mensaje</td><td>Responder a tu consulta y, en su caso, preparar una propuesta</td><td>Tu consentimiento al escribirnos y la aplicación de medidas precontractuales a tu petición (art. 6.1.a y 6.1.b RGPD)</td></tr>
          <tr><td>Navegación por la web</td><td>Dirección IP, navegador, fecha y hora de acceso, registrados por el proveedor de alojamiento</td><td>Servir la web, garantizar su seguridad y prevenir abusos</td><td>Interés legítimo en mantener el sitio seguro y operativo (art. 6.1.f RGPD)</td></tr>
        </tbody>
      </table>
      <p>Este sitio no utiliza formularios, no pide registro, no incluye herramientas de analítica ni publicidad y no elabora perfiles. No se toman decisiones automatizadas que te afecten.</p>

      <h2><span class="n">03</span>Cuánto tiempo los conservamos</h2>
      <p>Los datos de contacto se conservan el tiempo necesario para atender tu consulta y, si se inicia una relación comercial, mientras dure y durante los plazos legales de prescripción. Los registros técnicos de acceso se conservan durante el periodo limitado que establece el proveedor de alojamiento para fines de seguridad.</p>

      <h2><span class="n">04</span>A quién se comunican</h2>
      <p>No cedemos tus datos a terceros, salvo obligación legal. Para prestar el servicio intervienen proveedores que actúan como encargados del tratamiento, con los que existe el correspondiente contrato:</p>
      <ul>
        <li><strong>Alojamiento web:</strong> {{hosting}} ({{hostingSede}}).</li>
        <li><strong>Correo electrónico corporativo:</strong> el proveedor del servicio de correo de {{razonSocial}}.</li>
      </ul>

      <h2><span class="n">05</span>Transferencias internacionales</h2>
      <p>Algunos de estos proveedores pueden tratar datos fuera del Espacio Económico Europeo. En ese caso, las transferencias se amparan en el Marco de Privacidad de Datos UE-EE. UU. o en las cláusulas contractuales tipo aprobadas por la Comisión Europea, que garantizan un nivel de protección adecuado.</p>

      <h2><span class="n">06</span>Tus derechos</h2>
      <p>Puedes ejercer en cualquier momento tus derechos de acceso, rectificación, supresión, oposición, limitación del tratamiento y portabilidad, así como retirar el consentimiento prestado, escribiendo a <a href="mailto:{{email}}">{{email}}</a>. Te responderemos en el plazo de un mes.</p>
      <p>Si consideras que no hemos atendido correctamente tus derechos, puedes presentar una reclamación ante la Agencia Española de Protección de Datos (<a href="https://www.aepd.es" rel="noopener">www.aepd.es</a>).</p>

      <h2><span class="n">07</span>Seguridad</h2>
      <p>La web se sirve siempre de forma cifrada (HTTPS) y aplicamos medidas técnicas y organizativas adecuadas para proteger los datos frente a pérdida, uso indebido o acceso no autorizado.</p>

      <h2><span class="n">08</span>Menores</h2>
      <p>Este sitio no está dirigido a menores de 14 años y no recogemos conscientemente sus datos.</p>

      <h2><span class="n">09</span>Cambios en esta política</h2>
      <p>Podemos actualizar esta política para adaptarla a cambios legales o del propio sitio. La fecha de la última actualización figura al principio de la página.</p>''',
'''      <div class="kicker mono"><b>02</b> Legal</div>
      <h1>Privacy policy</h1>
      <p class="updated mono">Last updated: {{fechaEn}}</p>

      <p>This policy explains how we process the personal data of people who visit this website or contact us, in accordance with Regulation (EU) 2016/679 (GDPR) and Spanish Organic Law 3/2018 on Personal Data Protection and Digital Rights (LOPDGDD).</p>

      <h2><span class="n">01</span>Data controller</h2>
''' + TITULAR_EN + '''

      <h2><span class="n">02</span>What data we process and why</h2>
      <table class="table">
        <thead><tr><th>Activity</th><th>Data</th><th>Purpose</th><th>Legal basis</th></tr></thead>
        <tbody>
          <tr><td>Contact by email</td><td>Name, email address and whatever you tell us in your message</td><td>To answer your enquiry and, where appropriate, prepare a proposal</td><td>Your consent when you write to us and steps taken at your request before entering into a contract (art. 6.1.a and 6.1.b GDPR)</td></tr>
          <tr><td>Browsing the website</td><td>IP address, browser, date and time of access, logged by the hosting provider</td><td>To serve the website, keep it secure and prevent abuse</td><td>Legitimate interest in keeping the website secure and operational (art. 6.1.f GDPR)</td></tr>
        </tbody>
      </table>
      <p>This website uses no forms, requires no registration, includes no analytics or advertising tools and does not create profiles. No automated decisions affecting you are made.</p>

      <h2><span class="n">03</span>How long we keep it</h2>
      <p>Contact data is kept for as long as needed to handle your enquiry and, if a business relationship begins, for its duration and the applicable statutory limitation periods. Technical access logs are kept for the limited period set by the hosting provider for security purposes.</p>

      <h2><span class="n">04</span>Who we share it with</h2>
      <p>We do not share your data with third parties unless required by law. The following providers act as data processors under the corresponding agreements:</p>
      <ul>
        <li><strong>Web hosting:</strong> {{hosting}} ({{hostingSedeEn}}).</li>
        <li><strong>Corporate email:</strong> the email service provider used by {{razonSocial}}.</li>
      </ul>

      <h2><span class="n">05</span>International transfers</h2>
      <p>Some of these providers may process data outside the European Economic Area. In that case, transfers rely on the EU-US Data Privacy Framework or on the standard contractual clauses approved by the European Commission, which ensure an adequate level of protection.</p>

      <h2><span class="n">06</span>Your rights</h2>
      <p>You may at any time exercise your rights of access, rectification, erasure, objection, restriction of processing and portability, and withdraw any consent given, by writing to <a href="mailto:{{email}}">{{email}}</a>. We will reply within one month.</p>
      <p>If you believe we have not handled your request properly, you may lodge a complaint with the Spanish Data Protection Agency (<a href="https://www.aepd.es" rel="noopener">www.aepd.es</a>).</p>

      <h2><span class="n">07</span>Security</h2>
      <p>The website is always served over an encrypted connection (HTTPS), and we apply appropriate technical and organisational measures to protect data against loss, misuse or unauthorised access.</p>

      <h2><span class="n">08</span>Children</h2>
      <p>This website is not aimed at children under 14 and we do not knowingly collect their data.</p>

      <h2><span class="n">09</span>Changes to this policy</h2>
      <p>We may update this policy to reflect legal changes or changes to the website. The date of the latest update is shown at the top of the page.</p>''')

COOKIES = both('''      <div class="kicker mono"><b>03</b> Legal</div>
      <h1>Política de cookies</h1>
      <p class="updated mono">Última actualización: {{fecha}}</p>

      <h2><span class="n">01</span>En resumen</h2>
      <p><strong>Este sitio web no utiliza cookies.</strong> No usamos herramientas de analítica, publicidad, redes sociales ni ningún otro servicio de terceros que las instale. Por eso no te mostramos ningún aviso para aceptarlas o rechazarlas.</p>

      <h2><span class="n">02</span>Qué guardamos en tu navegador</h2>
      <p>Lo único que la web guarda en tu dispositivo es el idioma que eliges con el selector ES | EN, para mostrártelo igual en tu próxima visita. Se guarda en el almacenamiento local del navegador (localStorage), no se envía a ningún servidor y no sirve para identificarte ni para seguir tu navegación.</p>
      <table class="table">
        <thead><tr><th>Nombre</th><th>Tipo</th><th>Finalidad</th><th>Duración</th></tr></thead>
        <tbody>
          <tr><td>gr-lang</td><td>Almacenamiento local, propio</td><td>Recordar el idioma elegido por el usuario</td><td>Hasta que lo borres desde tu navegador</td></tr>
        </tbody>
      </table>
      <p>Según el artículo 22.2 de la LSSI-CE y la Guía sobre el uso de las cookies de la Agencia Española de Protección de Datos, este tipo de almacenamiento, solicitado expresamente por el usuario para personalizar la interfaz, está exento de consentimiento.</p>

      <h2><span class="n">03</span>Cómo borrarlo</h2>
      <p>Puedes eliminarlo en cualquier momento desde la configuración de tu navegador, en el apartado de privacidad o de datos de sitios web. La web seguirá funcionando igual y se mostrará en español.</p>

      <h2><span class="n">04</span>Cambios</h2>
      <p>Si en el futuro incorporamos cookies que requieran tu consentimiento, como las de analítica, actualizaremos esta política y te pediremos permiso antes de instalarlas.</p>''',
'''      <div class="kicker mono"><b>03</b> Legal</div>
      <h1>Cookie policy</h1>
      <p class="updated mono">Last updated: {{fechaEn}}</p>

      <h2><span class="n">01</span>In short</h2>
      <p><strong>This website does not use cookies.</strong> We use no analytics, advertising, social media or any other third-party service that would set them. That is why we do not show you a banner to accept or reject them.</p>

      <h2><span class="n">02</span>What we store in your browser</h2>
      <p>The only thing the website stores on your device is the language you choose with the ES | EN selector, so it can show the site in that language on your next visit. It is kept in your browser’s local storage, is never sent to any server and cannot be used to identify you or track your browsing.</p>
      <table class="table">
        <thead><tr><th>Name</th><th>Type</th><th>Purpose</th><th>Duration</th></tr></thead>
        <tbody>
          <tr><td>gr-lang</td><td>Local storage, first party</td><td>Remember the language chosen by the user</td><td>Until you delete it from your browser</td></tr>
        </tbody>
      </table>
      <p>Under article 22.2 of the Spanish LSSI-CE and the Spanish Data Protection Agency’s guidance on cookies, this kind of storage, expressly requested by the user to personalise the interface, is exempt from consent.</p>

      <h2><span class="n">03</span>How to delete it</h2>
      <p>You can delete it at any time from your browser settings, under privacy or site data. The website will keep working and will be shown in Spanish.</p>

      <h2><span class="n">04</span>Changes</h2>
      <p>If we ever add cookies that require your consent, such as analytics cookies, we will update this policy and ask for your permission before setting them.</p>''')

BODIES = {'aviso-legal.html': AVISO, 'privacidad.html': PRIVACIDAD, 'cookies.html': COOKIES}
for file, es, en in PAGES:
    (ROOT / file).write_text(page(file, es, en, BODIES[file]), encoding='utf-8')
    print('escrita', file)
