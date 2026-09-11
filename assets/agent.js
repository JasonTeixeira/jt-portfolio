/**
 * assets/agent.js — "Atlas," Jason's AI associate. A premium, agentic site-wide
 * assistant: it represents Jason, qualifies the visitor, and drives to the real
 * conversion actions (free mini-eval, book a call, see it live, browse services).
 *
 * Real AI via /api/chat (mode: associate, DeepSeek) with a typewriter reveal;
 * falls back to a scripted brain when the endpoint is offline, so it NEVER
 * breaks on a static host. Contextual action chips + inline lead capture
 * (/api/lead) turn the chat into a conversion surface, not a toy.
 *
 * Drop-in: <script defer src="assets/agent.js"></script>
 * Programmatic open (e.g. a hero CTA): window.openAtlas()
 */
(function () {
  var C = { bg: '#0B0B0D', panel: '#0C0C0E', line: '#26241F', ink: '#F4F2EF', dim: '#A8A29E', faint: '#8E8882', green: '#10b981', cyan: '#22d3ee', purple: '#a78bfa' };
  var MONO = "'JetBrains Mono',monospace";
  // Locale (mirrors the rest of the site: /es/ and /pt/ prefixes). Nadine speaks in all three.
  var LOC = (function () { var p = location.pathname; return /^\/pt(\/|$)/.test(p) ? 'pt' : /^\/es(\/|$)/.test(p) ? 'es' : 'en'; })();
  function L(m) { return (m && (m[LOC] || m.en)) || ''; }

  var GREET = L({
    en: "Hi — I'm Jason's assistant. Tell me what you're working on, and I'll point you straight to the right thing. So, what brings you in today?",
    es: "Hola — soy la asistente de Jason. Cuéntame en qué estás trabajando y te llevo directo a lo que necesitas. ¿Qué te trae por aquí hoy?",
    pt: "Oi — sou a assistente do Jason. Me conta no que você está trabalhando e eu te levo direto ao que precisa. O que te traz aqui hoje?"
  });

  // Every guided answer = a real Nadine voice clip (assets/concierge/<loc>/<clip>.mp3) + localized copy
  // that MATCHES the recorded line. This tap-through tree covers the common questions + key objections;
  // free-text still hits the live AI as text (can't pre-record a live reply). Covers ~the whole journey.
  var GUIDED = {
    build: { clip: 'build', next: ['useCases', 'eval', 'proof', 'book'],
      en: "Jason builds AI features and then proves they actually work — chatbots, RAG assistants, automations — with the evaluation and testing that keeps them honest in production. Want to see it live, or have your own feature checked for free?",
      es: "Jason construye funciones de IA y luego demuestra que realmente funcionan — chatbots, asistentes RAG, automatizaciones — con la evaluación y las pruebas que las mantienen confiables en producción. ¿Quieres verlo en vivo o que revise tu propia función gratis?",
      pt: "O Jason constrói recursos de IA e depois prova que eles realmente funcionam — chatbots, assistentes RAG, automações — com a avaliação e os testes que os mantêm confiáveis em produção. Quer ver ao vivo ou que ele avalie o seu próprio recurso de graça?" },
    howItWorks: { clip: 'howItWorks', next: ['cost', 'timeline', 'book'],
      en: "It's a simple path. First a short, low-risk audit — about a week — where Jason maps your problem and hands you a plan and a real quote. Then a sprint, then the build, and an optional ongoing phase if you want him to keep it running. You're never locked in, and you own everything.",
      es: "Es un camino simple. Primero una auditoría breve y de bajo riesgo — más o menos una semana — donde Jason mapea tu problema y te entrega un plan y una cotización real. Luego un sprint, después el build, y una fase continua opcional si quieres que lo siga manteniendo. Nunca quedas atado, y todo es tuyo.",
      pt: "É um caminho simples. Primeiro uma auditoria curta e de baixo risco — mais ou menos uma semana — onde o Jason mapeia o seu problema e te entrega um plano e um orçamento real. Depois um sprint, depois o build, e uma fase contínua opcional se você quiser que ele continue mantendo. Você nunca fica preso, e tudo é seu." },
    useCases: { clip: 'useCases', next: ['eval', 'whyYou', 'book'],
      en: "Quite a range. AI chatbots and RAG assistants, voice agents, document intake, workflow automation with tools like n8n and Make, plus the whole testing and evaluation side — eval harnesses, safety red-teaming, and CI quality gates. What are you trying to build?",
      es: "Bastante variado. Chatbots de IA y asistentes RAG, agentes de voz, procesamiento de documentos, automatización de flujos con herramientas como n8n y Make, y todo el lado de pruebas y evaluación — arneses de evaluación, red-teaming de seguridad y controles de calidad en CI. ¿Qué estás intentando construir?",
      pt: "Bastante coisa. Chatbots de IA e assistentes RAG, agentes de voz, leitura de documentos, automação de fluxos com ferramentas como n8n e Make, e todo o lado de testes e avaliação — arneses de avaliação, red-teaming de segurança e portões de qualidade no CI. O que você está tentando construir?" },
    eval: { clip: 'eval', act: 'minieval',
      en: "Here's the easiest first step, and it's free. Jason points his evaluation engine at your live AI feature, runs real adversarial probes, and sends you the findings. No call needed — just drop your email and the link.",
      es: "Este es el primer paso más fácil, y es gratis. Jason apunta su motor de evaluación a tu función de IA en vivo, corre pruebas adversarias reales y te envía los hallazgos. Sin llamada — solo deja tu correo y el enlace.",
      pt: "Esse é o primeiro passo mais fácil, e é grátis. O Jason aponta o motor de avaliação dele para o seu recurso de IA ao vivo, roda testes adversariais reais e te envia os resultados. Sem ligação — é só deixar seu e-mail e o link." },
    cost: { clip: 'cost', next: ['howItWorks', 'eval', 'book'],
      en: "There's no fixed price list. Every engagement is scoped and quoted after a short call, so you only pay for your actual problem. The lowest-risk start is that free mini-evaluation. Want it?",
      es: "No hay lista de precios fija. Cada proyecto se define y cotiza tras una breve llamada, así pagas por tu problema real, no por un paquete. El punto de partida con menos riesgo es esa mini-evaluación gratuita. ¿La quieres?",
      pt: "Não existe tabela de preços fixa. Cada projeto é definido e orçado depois de uma conversa rápida, então você paga pelo seu problema real, não por um pacote. O ponto de partida de menor risco é aquela mini-avaliação gratuita. Quer?" },
    timeline: { clip: 'timeline', next: ['howItWorks', 'book'],
      en: "It depends on scope, but roughly: the audit is about a week, a sprint two, and a full build usually four to eight weeks. You'll get a real timeline in your plan, not a guess. Want to book a quick call to scope yours?",
      es: "Depende del alcance, pero a grandes rasgos: la auditoría es como una semana, un sprint dos, y un build completo normalmente de cuatro a ocho semanas. Tendrás un cronograma real en tu plan, no una adivinanza. ¿Agendamos una llamada rápida para definir el tuyo?",
      pt: "Depende do escopo, mas por alto: a auditoria é cerca de uma semana, um sprint duas, e um build completo normalmente de quatro a oito semanas. Você vai ter um cronograma real no seu plano, não um chute. Quer marcar uma conversa rápida pra definir o seu?" },
    reliability: { clip: 'reliability', next: ['eval', 'whyYou', 'book'],
      en: "That's exactly the problem Jason solves. Most people build the AI and hope it behaves. He puts a gate in front of it — evaluations and adversarial tests that catch a wrong answer, a bad price, or an off-the-rails reply before your customer ever sees it. That reliability is the whole point.",
      es: "Ese es justo el problema que Jason resuelve. La mayoría construye la IA y espera que se porte bien. Él pone una compuerta delante — evaluaciones y pruebas adversarias que atrapan una respuesta equivocada, un precio malo o una salida fuera de control antes de que tu cliente la vea. Esa confiabilidad es todo el punto.",
      pt: "Esse é exatamente o problema que o Jason resolve. A maioria constrói a IA e torce pra ela se comportar. Ele coloca um portão na frente — avaliações e testes adversariais que pegam uma resposta errada, um preço ruim ou uma saída fora de controle antes do seu cliente ver. Essa confiabilidade é o ponto todo." },
    whyYou: { clip: 'whyYou', next: ['reliability', 'proof', 'book'],
      en: "Fair question. A cheap builder ships you a demo and a prayer. Jason ships the feature and the proof it works — the tests, the evals, the gate — and hands you code you own. If your AI talks to customers and has to be right, that's the difference.",
      es: "Buena pregunta. Un desarrollador barato te entrega una demo y una plegaria. Jason entrega la función y la prueba de que funciona — las pruebas, las evaluaciones, la compuerta — y te da el código, que es tuyo. Si tu IA habla con clientes y tiene que estar bien, esa es la diferencia.",
      pt: "Pergunta justa. Um desenvolvedor barato te entrega uma demo e uma reza. O Jason entrega o recurso e a prova de que funciona — os testes, as avaliações, o portão — e te dá o código, que é seu. Se a sua IA fala com clientes e precisa estar certa, essa é a diferença." },
    proof: { clip: 'proof', next: ['cases', 'experience', 'book'],
      en: "Everything is public and clickable. Two live products, open-source code, real run captures, and this very site runs its own quality checks on every deploy. Want me to open the case studies?",
      es: "Todo es público y se puede abrir. Dos productos en vivo, código abierto, capturas reales de ejecución, y este mismo sitio corre sus propios controles de calidad en cada despliegue. ¿Te abro los casos de estudio?",
      pt: "Tudo é público e dá pra abrir. Dois produtos ao vivo, código aberto, capturas reais de execução, e este próprio site roda os seus próprios controles de qualidade a cada deploy. Quer que eu abra os estudos de caso?" },
    experience: { clip: 'experience', next: ['proof', 'book'],
      en: "Thirteen years in software quality — nine at a Fortune 50, then fintech, and now his own AI studio. He's a certified test engineer who now builds and proves AI systems. It's all on the proof page, with links you can click. Want to see it?",
      es: "Trece años en calidad de software — nueve en una empresa Fortune 50, luego fintech, y ahora su propio estudio de IA. Es un ingeniero de pruebas certificado que ahora construye y prueba sistemas de IA. Todo está en la página de pruebas, con enlaces que puedes abrir. ¿Quieres verla?",
      pt: "Treze anos em qualidade de software — nove numa empresa Fortune 50, depois fintech, e agora o próprio estúdio de IA. Ele é um engenheiro de testes certificado que hoje constrói e prova sistemas de IA. Está tudo na página de provas, com links pra você abrir. Quer ver?" },
    burned: { clip: 'burned', act: 'minieval',
      en: "You've probably seen an AI solution that was a great demo and fell apart in production. Fair — that's most of them. Jason works the opposite way: he assumes it'll break, tests for it, and puts a gate in front so it can't embarrass you. Let him prove it on your own feature, for free. Want that?",
      es: "Probablemente ya viste una solución de IA que era una gran demo y se cayó en producción. Es justo — así son la mayoría. Jason trabaja al revés: asume que se va a romper, lo prueba, y pone una compuerta delante para que no te haga quedar mal. Deja que lo demuestre en tu propia función, gratis. ¿Lo hacemos?",
      pt: "Você provavelmente já viu uma solução de IA que era uma ótima demo e desmoronou em produção. É justo — são a maioria. O Jason trabalha ao contrário: ele assume que vai quebrar, testa pra isso, e coloca um portão na frente pra não te deixar mal. Deixa ele provar no seu próprio recurso, de graça. Topa?" },
    dataSafe: { clip: 'dataSafe', next: ['book', 'eval'],
      en: "Good thing to ask. Jason builds on your own infrastructure and keys wherever possible, doesn't train on your data, and the evaluation work is designed to keep sensitive data in your control. He'll walk you through the specifics on a call. Want to set one up?",
      es: "Buena pregunta. Jason construye sobre tu propia infraestructura y tus claves siempre que se pueda, no entrena con tus datos, y el trabajo de evaluación está diseñado para mantener los datos sensibles bajo tu control. Te explicará los detalles en una llamada. ¿La agendamos?",
      pt: "Boa pergunta. O Jason constrói na sua própria infraestrutura e nas suas chaves sempre que possível, não treina com os seus dados, e o trabalho de avaliação é feito pra manter os dados sensíveis sob o seu controle. Ele te explica os detalhes numa ligação. Vamos marcar?" },
    hiring: { clip: 'hiring', next: ['experience', 'proof'],
      en: "Great — Jason's open to the right full-time role. There's a résumé you can download up top, and the proof page shows exactly what he's built. Want me to point you to those?",
      es: "Genial — Jason está abierto al puesto de tiempo completo correcto. Hay un currículum que puedes descargar arriba, y la página de pruebas muestra exactamente lo que ha construido. ¿Te llevo a eso?",
      pt: "Ótimo — o Jason está aberto à vaga de tempo integral certa. Tem um currículo que você pode baixar no topo, e a página de provas mostra exatamente o que ele construiu. Quer que eu te leve até lá?" },
    demos: { clip: 'demos', next: ['eval', 'book'],
      en: "Two live things worth trying: an AI receptionist you can actually chat with, and an evaluation engine that grades an AI in real time — you press run and watch it catch failures. Want me to open one?",
      es: "Dos cosas en vivo que vale la pena probar: un recepcionista de IA con el que puedes chatear, y un motor de evaluación que califica una IA en tiempo real — presionas ejecutar y ves cómo atrapa las fallas. ¿Te abro una?",
      pt: "Duas coisas ao vivo que valem a pena testar: um recepcionista de IA com quem você pode conversar, e um motor de avaliação que avalia uma IA em tempo real — você aperta executar e vê ele pegar as falhas. Quer que eu abra uma?" },
    book: { clip: 'book', cta: 'book.html',
      en: "Easiest is a quick fifteen-minute call. You tell Jason the problem, and he tells you honestly what it takes and what it costs. I can open his calendar for you right now.",
      es: "Lo más fácil es una llamada rápida de quince minutos. Le cuentas el problema a Jason y él te dice con honestidad qué implica y cuánto cuesta. Puedo abrir su calendario ahora mismo.",
      pt: "O mais fácil é uma conversa rápida de quinze minutos. Você conta o problema pro Jason e ele te diz com honestidade o que envolve e quanto custa. Posso abrir a agenda dele agora mesmo." }
  };

  var GUIDE_LABEL = {
    build: L({ en: 'What does Jason do?', es: '¿Qué hace Jason?', pt: 'O que o Jason faz?' }),
    howItWorks: L({ en: 'How does it work?', es: '¿Cómo funciona?', pt: 'Como funciona?' }),
    useCases: L({ en: 'What can he build?', es: '¿Qué puede construir?', pt: 'O que ele constrói?' }),
    eval: L({ en: 'Check my AI (free)', es: 'Revisa mi IA (gratis)', pt: 'Avaliar minha IA (grátis)' }),
    cost: L({ en: 'How much does it cost?', es: '¿Cuánto cuesta?', pt: 'Quanto custa?' }),
    timeline: L({ en: 'How long does it take?', es: '¿Cuánto tarda?', pt: 'Quanto tempo leva?' }),
    reliability: L({ en: 'Will the AI be reliable?', es: '¿Será confiable la IA?', pt: 'A IA será confiável?' }),
    whyYou: L({ en: 'Why you vs cheaper?', es: '¿Por qué tú y no algo más barato?', pt: 'Por que você e não algo mais barato?' }),
    proof: L({ en: 'See the proof', es: 'Ver las pruebas', pt: 'Ver as provas' }),
    experience: L({ en: 'Background & credentials', es: 'Experiencia y credenciales', pt: 'Experiência e credenciais' }),
    burned: L({ en: "I've been burned by AI", es: 'Me ha fallado la IA antes', pt: 'Já me decepcionei com IA' }),
    dataSafe: L({ en: 'Is my data safe?', es: '¿Mis datos están seguros?', pt: 'Meus dados estão seguros?' }),
    hiring: L({ en: "I'm hiring for a role", es: 'Estoy contratando', pt: 'Estou contratando' }),
    demos: L({ en: 'See it live', es: 'Verlo en vivo', pt: 'Ver ao vivo' }),
    book: L({ en: 'Book a call', es: 'Agendar una llamada', pt: 'Agendar uma conversa' }),
    cases: L({ en: 'Case studies', es: 'Casos de estudio', pt: 'Estudos de caso' })
  };

  var START = [
    { label: GUIDE_LABEL.build, guide: 'build' },
    { label: GUIDE_LABEL.howItWorks, guide: 'howItWorks' },
    { label: GUIDE_LABEL.reliability, guide: 'reliability' },
    { label: GUIDE_LABEL.eval, guide: 'eval' },
    { label: GUIDE_LABEL.book, guide: 'book' }
  ];

  // Scripted fallback brain — quote-first, used only when /api/chat is offline. Localized (en/es/pt);
  // the regexes include es/pt keywords so a Spanish/Portuguese query still matches the right answer.
  var FALLBACK = [
    { re: /price|cost|\$|how much|pay|budget|rate|quote|precio|cu[aá]nto|cuesta|presupuesto|tarifa|pre[çc]o|quanto|or[çc]amento/i,
      en: "There's no fixed price list: every engagement is scoped and quoted after a short call, so you pay for your problem, not a package. The lowest-risk start is free: Jason runs a real eval on your live AI feature and sends the findings. Want that?",
      es: "No hay lista de precios fija: cada proyecto se define y cotiza tras una breve llamada, así pagas por tu problema, no por un paquete. El inicio con menos riesgo es gratis: Jason corre una evaluación real sobre tu función de IA en vivo y te envía los hallazgos. ¿La quieres?",
      pt: "Não existe tabela de preços fixa: cada projeto é definido e orçado depois de uma conversa rápida, então você paga pelo seu problema, não por um pacote. O começo de menor risco é grátis: o Jason roda uma avaliação real no seu recurso de IA ao vivo e te envia os resultados. Quer?" },
    { re: /what.*(do|does|build|offer)|who is|services?|help with|qu[eé] hac|qu[eé] construy|servicios?|o que.*faz|constr[oó]i|servi[çc]os?/i,
      en: "Jason ships AI features and then proves they work: LLM evaluation harnesses, adversarial safety testing, CI quality gates, plus test automation and AI workflow automation. His whole thing is 'proof, not vibes.' Want to see it run live, or have your own feature checked?",
      es: "Jason lanza funciones de IA y luego demuestra que funcionan: arneses de evaluación de LLM, pruebas de seguridad adversarias, controles de calidad en CI, más automatización de pruebas y de flujos con IA. Su lema es 'pruebas, no promesas'. ¿Quieres verlo en vivo o que revise tu propia función?",
      pt: "O Jason entrega recursos de IA e depois prova que funcionam: arneses de avaliação de LLM, testes de segurança adversariais, portões de qualidade no CI, além de automação de testes e de fluxos com IA. O lema dele é 'provas, não promessas'. Quer ver ao vivo ou que ele avalie o seu próprio recurso?" },
    { re: /eval|test|prove|check|feature|bot|assistant|chatbot|agent|rag|hallucinat|safety|injection|prueba|evalua|revisa|alucina|seguridad|inye|avalia|teste|alucina[çc]|seguran[çc]a|inje[çc]/i,
      en: "The fastest path: a free mini-eval. Jason points his eval engine at your live AI feature, runs adversarial probes (injection, jailbreak, hallucination, PII…), and sends you the verbatim findings, no call required. Drop your feature URL and I'll set it up.",
      es: "El camino más rápido: una mini-evaluación gratis. Jason apunta su motor de evaluación a tu función de IA en vivo, corre pruebas adversarias (inyección, jailbreak, alucinación, PII…) y te envía los hallazgos textuales, sin llamada. Deja la URL de tu función y la preparo.",
      pt: "O caminho mais rápido: uma mini-avaliação grátis. O Jason aponta o motor de avaliação dele para o seu recurso de IA ao vivo, roda testes adversariais (injeção, jailbreak, alucinação, PII…) e te envia os resultados na íntegra, sem ligação. Deixe o link do seu recurso e eu preparo." },
    { re: /book|call|talk|meet|hire|start|contact|email|reach|agend|llamada|hablar|contact|reserv|marcar|conversa|ligar|falar|contat/i,
      en: "Easiest is a 15-minute call: you describe the problem, Jason tells you honestly what it takes and what it'd cost. Want me to open the booking page, or should I take your email so he reaches out?",
      es: "Lo más fácil es una llamada de 15 minutos: describes el problema y Jason te dice con honestidad qué implica y cuánto cuesta. ¿Te abro la página de reserva o tomo tu correo para que te contacte?",
      pt: "O mais fácil é uma conversa de 15 minutos: você descreve o problema e o Jason te diz com honestidade o que envolve e quanto custa. Quer que eu abra a página de agendamento ou pego seu e-mail pra ele entrar em contato?" },
    { re: /demo|see|show|work|voice|live|example|ver|mostr|ejemplo|en vivo|ao vivo|exemplo/i,
      en: "Two live things worth seeing: the Demos page has an AI receptionist you can chat or talk to, and the Eval page grades an AI in real time, press run and watch it fail probes. Want me to open one?",
      es: "Dos cosas en vivo que vale la pena ver: la página de Demos tiene un recepcionista de IA con el que puedes chatear o hablar, y la página de Eval califica una IA en tiempo real; presionas ejecutar y ves cómo falla las pruebas. ¿Te abro una?",
      pt: "Duas coisas ao vivo que valem a pena ver: a página de Demos tem um recepcionista de IA com quem você pode conversar, e a página de Eval avalia uma IA em tempo real; você aperta executar e vê ele falhar nos testes. Quer que eu abra uma?" },
    { re: /proof|case|experience|done before|track record|result|metric|client|prueba|caso|experiencia|resultado|cliente|prova|caso|experi[êe]ncia|resultado/i,
      en: "Real proof, all public: an open-source eval gate (green in ~10 min), a QA platform with 85 runners and a documented red→green security fix, a 37/37 Playwright suite, plus Fortune-50 test infra and a live suite taken from 10% flake to under 1%. Want the case studies?",
      es: "Pruebas reales, todas públicas: un eval-gate de código abierto (verde en ~10 min), una plataforma de QA con 85 runners y un arreglo de seguridad rojo→verde documentado, una suite Playwright 37/37, más infraestructura de pruebas Fortune-50 y una suite en vivo llevada del 10% de inestabilidad a menos del 1%. ¿Quieres los casos de estudio?",
      pt: "Provas reais, todas públicas: um eval-gate de código aberto (verde em ~10 min), uma plataforma de QA com 85 runners e uma correção de segurança vermelho→verde documentada, uma suíte Playwright 37/37, além de infraestrutura de testes Fortune-50 e uma suíte ao vivo levada de 10% de instabilidade para menos de 1%. Quer os estudos de caso?" },
    { re: /human|real person|are you (a )?(ai|bot|real)|atlas|humano|persona real|eres.*(ia|bot)|voc[êe].*(ia|rob[ôo])|pessoa real/i,
      en: "Honest answer: I'm Atlas, Jason's AI associate, real AI, and a real person reads everything at hello@sageideas.dev. I can answer most things about the work and set up the next step. What do you need?",
      es: "Respuesta honesta: soy Atlas, la IA de Jason. Soy IA real, y una persona real lee todo en hello@sageideas.dev. Puedo responder casi todo sobre el trabajo y preparar el siguiente paso. ¿Qué necesitas?",
      pt: "Resposta honesta: sou a Atlas, a IA do Jason. Sou IA de verdade, e uma pessoa real lê tudo em hello@sageideas.dev. Posso responder quase tudo sobre o trabalho e organizar o próximo passo. O que você precisa?" }
  ];
  var FB_DEFAULT = {
    en: "Good question. For anything specific, the fastest paths are a free mini-eval on your feature or a 15-minute call. Meanwhile I can walk you through what Jason builds, the proof behind it, or how engagements work. What's most useful?",
    es: "Buena pregunta. Para algo específico, los caminos más rápidos son una mini-evaluación gratis de tu función o una llamada de 15 minutos. Mientras tanto puedo mostrarte qué construye Jason, las pruebas detrás o cómo funcionan los proyectos. ¿Qué te sirve más?",
    pt: "Boa pergunta. Para algo específico, os caminhos mais rápidos são uma mini-avaliação grátis do seu recurso ou uma conversa de 15 minutos. Enquanto isso posso te mostrar o que o Jason constrói, as provas por trás ou como funcionam os projetos. O que te ajuda mais?"
  };

  var open = false, mode = null, hist = [], panel, msgsEl, chipsEl, input, typingEl;

  function css(el, s) { for (var k in s) el.style[k] = s[k]; }
  function el(tag, style, html) { var n = document.createElement(tag); if (style) css(n, style); if (html != null) n.innerHTML = html; return n; }
  function track(n) { try { if (typeof window.va === 'function') window.va('event', { name: n }); } catch (e) {} }

  function bubble(who) {
    var d = el('div', {
      maxWidth: '88%', padding: '10px 13px', fontSize: '13.5px', lineHeight: '1.55',
      borderRadius: who === 'me' ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
      alignSelf: who === 'me' ? 'flex-end' : 'flex-start',
      background: who === 'me' ? 'linear-gradient(135deg,#22d3ee,#0ea5b7)' : '#17161a',
      color: who === 'me' ? '#04242a' : '#E7E5E1',
      boxShadow: who === 'me' ? '0 6px 18px -8px rgba(34,211,238,0.5)' : 'none',
      opacity: '0', transform: 'translateY(6px)', transition: 'opacity .25s, transform .25s'
    });
    msgsEl.appendChild(d);
    requestAnimationFrame(function () { d.style.opacity = '1'; d.style.transform = 'none'; });
    scroll();
    return d;
  }
  function scroll() { msgsEl.scrollTop = msgsEl.scrollHeight; }

  // typewriter reveal for the wow factor (respects reduced-motion)
  function typeInto(node, text, done) {
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce || text.length > 320) { node.textContent = text; scroll(); done && done(); return; }
    var i = 0;
    (function step() {
      node.textContent = text.slice(0, i);
      scroll();
      if (i++ < text.length) { setTimeout(step, 12); } else { done && done(); }
    })();
  }

  function showTyping() {
    typingEl = el('div', { alignSelf: 'flex-start', display: 'flex', gap: '4px', padding: '12px 14px', background: '#17161a', borderRadius: '14px 14px 14px 4px' });
    for (var i = 0; i < 3; i++) {
      var dot = el('span', { width: '6px', height: '6px', borderRadius: '50%', background: C.faint, animation: 'atlasdot 1s ' + (i * 0.15) + 's infinite ease-in-out' });
      typingEl.appendChild(dot);
    }
    msgsEl.appendChild(typingEl); scroll();
  }
  function hideTyping() { if (typingEl && typingEl.parentNode) typingEl.parentNode.removeChild(typingEl); typingEl = null; }

  function scripted(q) { for (var i = 0; i < FALLBACK.length; i++) if (FALLBACK[i].re.test(q)) return L(FALLBACK[i]); return L(FB_DEFAULT); }

  function ask(history) {
    return fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode: 'associate', locale: LOC, messages: history }) })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) { return d && d.ok && d.reply ? d.reply : null; })
      .catch(function () { return null; });
  }

  // small inline stroke-icon for chip labels (inherits the chip's text color)
  function chipIco(inner) { return '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:7px">' + inner + '</svg>'; }
  var CHIP_IC = {
    cost: chipIco('<path d="M12 4v17"/><path d="M7 21h10"/><path d="M12 4l-6 2m6-2l6 2"/><path d="M6 6l-3 6a3 3 0 0 0 6 0z"/><path d="M18 6l-3 6a3 3 0 0 0 6 0z"/>'),
    eval: chipIco('<path d="M13 2 4 14h7l-1 8 10-13h-7z"/>'),
    cases: chipIco('<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="14" y2="17"/>'),
    live: chipIco('<circle cx="12" cy="12" r="3"/><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/>'),
    book: chipIco('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/>'),
    all: chipIco('<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/><path d="M6.5 10v4a3 3 0 0 0 3 3H14"/>')
  };
  // contextual action chips based on the running conversation
  function actionsFor(text) {
    var t = (text || '').toLowerCase(), acts = [];
    if (/price|cost|budget|roi|worth|expensive|value|precio|cost|presupuesto|pre[çc]o|custo/.test(t))
      acts.push({ label: CHIP_IC.cost + L({ en: 'Cost calculator', es: 'Calculadora de costos', pt: 'Calculadora de custos' }), nav: 'roi.html' });
    if (/eval|test|prove|check|feature|bot|assistant|chatbot|agent|rag|hallucinat|safety|injection|price|cost|evalua|prueba|revisa|avalia|teste/.test(t))
      acts.push({ label: CHIP_IC.eval + L({ en: 'Free mini-eval', es: 'Mini-evaluación gratis', pt: 'Mini-avaliação grátis' }), act: 'minieval' });
    if (/proof|case|experience|result|metric|client|track record|done before|prueba|caso|resultado|cliente|prova|caso/.test(t))
      acts.push({ label: CHIP_IC.cases + GUIDE_LABEL.cases, nav: 'case-studies.html' });
    if (/demo|see|show|live|watch|example|ver|mostr|vivo|exemplo/.test(t))
      acts.push({ label: CHIP_IC.live + GUIDE_LABEL.demos, nav: 'eval.html' });
    acts.push({ label: CHIP_IC.book + GUIDE_LABEL.book, nav: 'book.html' });
    if (acts.length < 3) acts.push({ label: CHIP_IC.all + L({ en: 'All services', es: 'Todos los servicios', pt: 'Todos os serviços' }), nav: 'services.html' });
    // de-dupe by label, cap 3
    var seen = {}, out = [];
    acts.forEach(function (a) { if (!seen[a.label] && out.length < 3) { seen[a.label] = 1; out.push(a); } });
    return out;
  }

  function renderChips(list) {
    chipsEl.innerHTML = '';
    (list || []).forEach(function (c) {
      var b = el('button', {
        border: '1px solid ' + C.line, background: 'rgba(255,255,255,0.02)', borderRadius: '15px',
        padding: '7px 12px', fontSize: '11.5px', color: C.ink, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap'
      }, c.label);
      b.onmouseenter = function () { b.style.borderColor = C.cyan; b.style.color = C.cyan; };
      b.onmouseleave = function () { b.style.borderColor = C.line; b.style.color = C.ink; };
      b.onclick = function () {
        if (c.guide) { showGuided(c.guide); return; }
        if (c.nav) { track('atlas-nav'); location.href = c.nav; return; }
        if (c.act === 'minieval') { captureFlow('minieval'); return; }
        if (c.act === 'followup') { captureFlow('followup'); return; }
        if (c.q) { send(c.q); }
      };
      chipsEl.appendChild(b);
    });
  }

  // inline lead capture — the conversion payoff, posts to /api/lead
  function captureFlow(kind) {
    chipsEl.innerHTML = '';
    var intro = kind === 'minieval'
      ? L({ en: "Perfect. Drop your work email and the link to your live AI feature, and Jason will run the evaluation and send you the findings personally.",
            es: "Perfecto. Deja tu correo de trabajo y el enlace a tu función de IA en vivo, y Jason correrá la evaluación y te enviará los hallazgos personalmente.",
            pt: "Perfeito. Deixe seu e-mail de trabalho e o link do seu recurso de IA ao vivo, e o Jason vai rodar a avaliação e te enviar os resultados pessoalmente." })
      : L({ en: "Great — leave your email and Jason will personally follow up, usually same day.",
            es: "Genial — deja tu correo y Jason te contactará personalmente, normalmente el mismo día.",
            pt: "Ótimo — deixe seu e-mail e o Jason vai te responder pessoalmente, normalmente no mesmo dia." });
    var b = bubble('bot'); b.textContent = intro; speak(kind === 'minieval' ? 'captureIntro' : null); hist.push({ role: 'assistant', content: intro });

    var wrap = el('div', { alignSelf: 'stretch', display: 'flex', flexDirection: 'column', gap: '8px', padding: '4px 2px' });
    var email = el('input'); email.type = 'email'; email.placeholder = 'you@company.com';
    var url = el('input'); url.type = 'text'; url.placeholder = 'https://yourapp.com/chat  (optional)';
    [email, url].forEach(function (inp) {
      css(inp, { background: '#0F0F13', border: '1px solid ' + C.line, borderRadius: '9px', padding: '10px 12px', fontSize: '13px', color: C.ink, fontFamily: 'inherit', outline: 'none' });
      inp.onfocus = function () { inp.style.borderColor = 'rgba(16,185,129,0.5)'; };
      inp.onblur = function () { inp.style.borderColor = C.line; };
    });
    if (kind !== 'minieval') url.style.display = 'none';
    var go = el('button', { background: C.green, color: '#052e22', border: 'none', borderRadius: '10px', padding: '10px', fontSize: '13px', fontWeight: '700', cursor: 'pointer', fontFamily: 'inherit' }, kind === 'minieval'
      ? L({ en: 'Send me the findings →', es: 'Envíame los hallazgos →', pt: 'Me envie os resultados →' })
      : L({ en: 'Have Jason reach out →', es: 'Que Jason me contacte →', pt: 'Que o Jason entre em contato →' }));
    wrap.appendChild(email); wrap.appendChild(url); wrap.appendChild(go);
    msgsEl.appendChild(wrap); scroll();

    go.onclick = function () {
      var e = (email.value || '').trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) { email.style.borderColor = '#f43f5e'; email.focus(); return; }
      go.disabled = true; go.textContent = 'sending…';
      track('atlas-lead-' + kind);
      fetch('/api/lead', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: e, feature: (url.value || '').trim(), name: '', source: 'atlas-' + kind }) })
        .then(function () { return true; }).catch(function () { return true; })
        .then(function () {
          if (wrap.parentNode) wrap.parentNode.removeChild(wrap);
          var ok = bubble('bot');
          ok.textContent = kind === 'minieval'
            ? L({ en: "You're all set — Jason has it and will email your findings. Is there anything else I can line up for you while you're here?",
                  es: "Listo — Jason lo tiene y te enviará tus hallazgos. ¿Hay algo más que pueda preparar para ti mientras estás aquí?",
                  pt: "Pronto — o Jason já tem e vai te enviar os resultados. Tem mais alguma coisa que eu possa organizar pra você enquanto está aqui?" })
            : L({ en: "Done — Jason has it and will reach out shortly. Anything else I can help with?",
                  es: "Listo — Jason lo tiene y te contactará pronto. ¿Algo más en lo que pueda ayudar?",
                  pt: "Pronto — o Jason já tem e vai entrar em contato em breve. Mais alguma coisa em que eu possa ajudar?" });
          speak(kind === 'minieval' ? 'captureOk' : null);
          hist.push({ role: 'assistant', content: ok.textContent });
          renderChips(actionsFor('proof demo services'));
        });
    };
  }

  // Build the next-step chips after a guided answer (always keep a path to the booking).
  function guideChips(keys) {
    var list = (keys || []).map(function (k) {
      if (k === 'cases') return { label: GUIDE_LABEL.cases, nav: 'case-studies.html' };
      if (k === 'live') return { label: GUIDE_LABEL.demos, nav: 'eval.html' };
      return { label: GUIDE_LABEL[k] || k, guide: k };
    });
    if (!list.some(function (c) { return c.guide === 'book'; })) list.push({ label: GUIDE_LABEL.book, guide: 'book' });
    return list;
  }
  // A tapped guided intent: show the fixed answer, speak it in Nadine's real voice, then
  // offer the next steps — always frictionless toward the mini-eval or the booking.
  function showGuided(key) {
    var g = GUIDED[key]; if (!g) { send(GUIDE_LABEL[key] || key); return; }
    chipsEl.innerHTML = ''; stopSpeak();
    var txt = L(g);
    var b = bubble('bot'); speak(g.clip);
    typeInto(b, txt, function () {
      hist.push({ role: 'assistant', content: txt });
      track('atlas-guide-' + key);
      if (g.act) { captureFlow(g.act); return; }
      var chips = guideChips(g.next);
      if (g.cta) chips.unshift({ label: 'Open the calendar →', nav: g.cta });
      renderChips(chips);
    });
  }

  function send(v) {
    v = (v || '').trim(); if (!v) return;
    stopSpeak(); // never talk over the visitor
    bubble('me').textContent = v; input.value = ''; hist.push({ role: 'user', content: v });
    chipsEl.innerHTML = ''; track('atlas-msg');
    showTyping();
    function finish(txt) {
      hideTyping();
      var b = bubble('bot');
      // Free-text answers are generated live — text only, never a robotic synth voice.
      typeInto(b, txt, function () { hist.push({ role: 'assistant', content: txt }); renderChips(actionsFor(v + ' ' + txt)); });
    }
    if (mode === 'script') { setTimeout(function () { finish(scripted(v)); }, 420); return; }
    ask(hist).then(function (reply) {
      if (reply) { mode = 'ai'; finish(reply); }
      else if (mode === 'ai') { finish("One sec — mind saying that once more?"); }
      else { mode = 'script'; setTimeout(function () { finish(scripted(v)); }, 320); }
    });
  }

  // ── voice OUTPUT — the real assistant voice (pre-rendered clips), NOT a robotic browser
  // synth. The guided journey — the greeting, the fixed answer paths, and the capture
  // prompts — is voiced in Nadine so it feels like a real assistant. Free-text answers are
  // generated live and can't be pre-recorded, so those stay text (no robot voice, ever).
  // speak(key) plays /assets/concierge/en/<key>.mp3. On/off persists per visitor.
  var VLANG = LOC;
  var speakOn = true; try { speakOn = localStorage.getItem('atlas-voice') !== 'off'; } catch (e) {}
  var CLIP_BASE = '/assets/concierge/' + VLANG + '/', CLIP_V = '?v=3';
  var canVoice = true; // Nadine clips exist for en / es / pt
  var curAudio = null;
  function stopSpeak() { try { if (curAudio) { curAudio.pause(); curAudio = null; } } catch (e) {} }
  function speak(key) {
    if (!speakOn || !canVoice || !key) return;
    stopSpeak();
    try { var a = new window.Audio(CLIP_BASE + key + '.mp3' + CLIP_V); curAudio = a; a.play().catch(function () {}); } catch (e) {}
  }

  // ── voice input (Web Speech, feature-detected) ──
  var recog = null, listening = false;
  function setupVoice(micBtn) {
    var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { micBtn.style.display = 'none'; return; }
    recog = new SR(); recog.lang = VLANG === 'es' ? 'es-ES' : VLANG === 'pt' ? 'pt-BR' : 'en-US'; recog.interimResults = false; recog.maxAlternatives = 1;
    recog.onresult = function (e) { var t = e.results[0][0].transcript; input.value = t; send(t); };
    recog.onend = function () { listening = false; micBtn.style.color = C.faint; micBtn.style.background = 'transparent'; };
    micBtn.onclick = function () {
      if (listening) { recog.stop(); return; }
      try { recog.start(); listening = true; micBtn.style.color = '#04242a'; micBtn.style.background = C.cyan; track('atlas-voice'); } catch (e) {}
    };
  }

  // openPanel(intent?) — opening with a guided-intent key (from the full-screen gateway) skips
  // the greeting and takes the visitor straight into that assistant-voiced answer.
  function openPanel(intent) {
    open = true; panel.style.display = 'flex';
    requestAnimationFrame(function () { panel.style.opacity = '1'; panel.style.transform = 'none'; });
    var hasIntent = intent && typeof intent === 'string' && GUIDED[intent];
    if (!msgsEl.children.length) {
      if (hasIntent) { showGuided(intent); }
      else { var g = bubble('bot'); speak('greet'); typeInto(g, GREET, function () { hist.push({ role: 'assistant', content: GREET }); renderChips(START); }); }
      track('atlas-open');
    } else if (hasIntent) { showGuided(intent); }
    setTimeout(function () { input && input.focus(); }, 300);
  }
  function closePanel() { open = false; stopSpeak(); panel.style.opacity = '0'; panel.style.transform = 'translateY(10px) scale(0.98)'; setTimeout(function () { panel.style.display = 'none'; }, 200); }
  function toggle() { open ? closePanel() : openPanel(); }
  window.openAtlas = openPanel;

  function build() {
    // keyframes (typing dots + FAB pulse)
    var st = document.createElement('style');
    st.textContent = '@keyframes atlasdot{0%,80%,100%{opacity:.3;transform:translateY(0)}40%{opacity:1;transform:translateY(-3px)}}@keyframes atlaspulse{0%{box-shadow:0 0 0 0 rgba(16,185,129,.45)}70%{box-shadow:0 0 0 14px rgba(16,185,129,0)}100%{box-shadow:0 0 0 0 rgba(16,185,129,0)}}@media (prefers-reduced-motion:reduce){.atlas-fab{animation:none!important}}';
    document.head.appendChild(st);

    var fab = document.createElement('button');
    fab.className = 'atlas-fab';
    fab.setAttribute('aria-label', 'Ask about working with Jason');
    fab.innerHTML = '<span style="font-size:19px">✦</span>';
    css(fab, { position: 'fixed', right: '20px', bottom: '20px', width: '56px', height: '56px', borderRadius: '50%', background: 'linear-gradient(135deg,#10b981,#0ea5b7)', color: '#03231b', border: 'none', cursor: 'pointer', display: 'grid', placeItems: 'center', boxShadow: '0 10px 30px -8px rgba(0,0,0,0.7)', zIndex: '95', animation: 'atlaspulse 3.2s infinite' });
    fab.onclick = toggle;

    panel = el('div', {
      position: 'fixed', right: '20px', bottom: '88px', width: 'min(384px, calc(100vw - 32px))',
      height: 'min(600px, calc(100vh - 120px))', background: C.panel, border: '1px solid ' + C.line,
      borderRadius: '18px', boxShadow: '0 40px 90px -24px rgba(0,0,0,0.92)', zIndex: '96', display: 'none',
      flexDirection: 'column', overflow: 'hidden', fontFamily: "'Plus Jakarta Sans',system-ui,sans-serif",
      opacity: '0', transform: 'translateY(10px) scale(0.98)', transition: 'opacity .2s, transform .2s'
    });
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', "Atlas — Jason's AI associate");

    // header
    var head = el('div', { display: 'flex', alignItems: 'center', gap: '11px', padding: '14px 16px', borderBottom: '1px solid ' + C.line, background: 'linear-gradient(180deg,rgba(16,185,129,0.06),transparent)' });
    var av = el('div', { position: 'relative', width: '38px', height: '38px', borderRadius: '11px', background: 'linear-gradient(135deg,#10b981,#22d3ee)', display: 'grid', placeItems: 'center', fontFamily: MONO, fontSize: '15px', fontWeight: '700', color: '#03231b', flexShrink: '0' }, '✦');
    var pulseDot = el('span', { position: 'absolute', right: '-2px', bottom: '-2px', width: '11px', height: '11px', borderRadius: '50%', background: C.green, border: '2px solid ' + C.panel });
    av.appendChild(pulseDot);
    var htext = el('div', { flex: '1', minWidth: '0' }, '<div style="font-size:14px;font-weight:700;color:' + C.ink + '">Atlas</div><div style="font-family:' + MONO + ';font-size:9.5px;color:' + C.green + '">● Jason’s AI associate · online</div>');
    // Voice on/off — the concierge speaks by default; this mutes/unmutes her (persists).
    var vbtn = el('button', { background: 'none', border: '1px solid ' + C.line, borderRadius: '9px', width: '31px', height: '31px', cursor: 'pointer', fontSize: '14px', lineHeight: '1', flexShrink: '0', color: speakOn ? C.cyan : C.faint }, speakOn ? '🔊' : '🔇');
    vbtn.setAttribute('aria-label', speakOn ? 'Voice on — click to mute' : 'Voice off — click to unmute');
    vbtn.setAttribute('title', vbtn.getAttribute('aria-label'));
    vbtn.onclick = function () {
      speakOn = !speakOn;
      try { localStorage.setItem('atlas-voice', speakOn ? 'on' : 'off'); } catch (e) {}
      if (!speakOn) stopSpeak();
      vbtn.textContent = speakOn ? '🔊' : '🔇';
      vbtn.style.color = speakOn ? C.cyan : C.faint;
      var lbl = speakOn ? 'Voice on — click to mute' : 'Voice off — click to unmute';
      vbtn.setAttribute('aria-label', lbl); vbtn.setAttribute('title', lbl);
      track('atlas-voice-toggle');
    };
    var x = el('button', { background: 'none', border: 'none', color: C.faint, fontSize: '20px', cursor: 'pointer', lineHeight: '1', flexShrink: '0' }, '×');
    x.setAttribute('aria-label', 'Close'); x.onclick = closePanel;
    head.appendChild(av); head.appendChild(htext); head.appendChild(vbtn); head.appendChild(x);

    msgsEl = el('div', { flex: '1', overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' });

    chipsEl = el('div', { display: 'flex', flexWrap: 'wrap', gap: '7px', padding: '0 16px 10px' });

    var row = el('div', { display: 'flex', gap: '8px', alignItems: 'center', padding: '11px 14px', borderTop: '1px solid ' + C.line });
    input = document.createElement('input'); input.placeholder = L({ en: 'Ask me anything…', es: 'Pregúntame lo que sea…', pt: 'Pergunte o que quiser…' }); input.setAttribute('aria-label', 'Message Atlas');
    css(input, { flex: '1', minWidth: '0', background: '#0F0F13', border: '1px solid ' + C.line, borderRadius: '11px', padding: '10px 13px', fontSize: '13.5px', color: C.ink, fontFamily: 'inherit', outline: 'none' });
    input.onfocus = function () { input.style.borderColor = 'rgba(34,211,238,0.5)'; };
    input.onblur = function () { input.style.borderColor = C.line; };
    input.addEventListener('keydown', function (e) { if (e.key === 'Enter') send(input.value); });
    var mic = el('button', { background: 'transparent', border: '1px solid ' + C.line, color: C.faint, borderRadius: '11px', width: '38px', height: '38px', cursor: 'pointer', flexShrink: '0', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }, '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0 0 14 0"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="9" y1="22" x2="15" y2="22"/></svg>');
    mic.setAttribute('aria-label', 'Talk to Atlas');
    var sendBtn = el('button', { background: 'linear-gradient(135deg,#10b981,#0ea5b7)', color: '#03231b', border: 'none', borderRadius: '11px', width: '40px', height: '38px', fontSize: '15px', fontWeight: '700', cursor: 'pointer', flexShrink: '0' }, '→');
    sendBtn.setAttribute('aria-label', 'Send'); sendBtn.onclick = function () { send(input.value); };
    row.appendChild(input); row.appendChild(mic); row.appendChild(sendBtn);

    var trust = el('div', { padding: '0 16px 12px', fontFamily: MONO, fontSize: '9.5px', color: C.faint, textAlign: 'center' }, 'real AI · a real person reads everything at hello@sageideas.dev');

    panel.appendChild(head); panel.appendChild(msgsEl); panel.appendChild(chipsEl); panel.appendChild(row); panel.appendChild(trust);
    document.body.appendChild(fab); document.body.appendChild(panel);
    setupVoice(mic);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build);
  else build();
})();
