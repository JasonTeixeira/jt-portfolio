// Display-only localization for the Scope Studio content (questions + rate-card).
// scope-core.mjs stays the English source of truth for PRICING and keys — this
// layer only translates what the visitor SEES on /es/ and /pt/. Operator emails
// and /api telemetry keep the English capability names as canonical identifiers.
//
// Fallback is always the English source, so `en` (and any missing key) is a no-op.
// Question/segment/phase CONTENT is translated here; effort strings reduce to a
// unit swap ("wks" -> localized) so the numbers stay in one place.

export const SCOPE_I18N = {
  es: {
    effortUnit: 'sem',
    disclaimer: 'Rangos indicativos, no un presupuesto. El alcance y el precio exactos se definen en una llamada breve.',
    phases: { audit: 'Auditoría', build: 'Construcción', gate: 'Comprobación', operate: 'Operación' },
    segments: {
      'service-business': 'Negocio de servicios',
      'ai-product': 'Producto / función de IA',
      'ops-automation': 'Operaciones / back-office',
      'product-build': 'Producto / plataforma',
    },
    questions: {
      segment: {
        prompt: '¿Qué te describe mejor?',
        options: {
          'seg-service': 'Un negocio de servicios',
          'seg-aiproduct': 'Lanzando un producto/función de IA',
          'seg-ops': 'Ahogado en tareas operativas/administrativas',
          'seg-product': 'Necesito construir un producto o plataforma',
        },
      },
      needs: {
        prompt: '¿Qué quieres lograr?',
        options: {
          'opt-eval': 'Demostrar que nuestra función de IA funciona',
          'opt-safety': 'Evitar que alucine o filtre datos',
          'opt-e2e': 'Evitar que los lanzamientos se rompan',
          'opt-build-ai': 'Construir un asistente/agente de IA',
          'opt-voice': 'Atender cada llamada automáticamente',
          'opt-automate': 'Automatizar un flujo de trabajo manual',
          'opt-leads': 'No perder ningún prospecto',
          'opt-product': 'Construir una app web / herramienta interna',
          'opt-data': 'Dar sentido a nuestros datos',
        },
      },
      maturity: {
        prompt: '¿En qué punto estás hoy?',
        options: {
          'mat-idea': 'Solo una idea',
          'mat-demo': 'Un demo en el que aún no se puede confiar',
          'mat-prod': 'En producción, necesita fortalecerse',
        },
      },
    },
    cards: {
      chatbot: { name: 'Asistente conversacional', why: 'Chatbot de soporte/producto basado en tus documentos.' },
      'voice-agent': { name: 'Agente de voz con IA', why: 'Responde 24/7, califica, agenda y envía un resumen por SMS.' },
      'doc-intake': { name: 'Ingesta y extracción de documentos', why: 'Documentos desordenados convertidos en datos estructurados y validados.' },
      copilot: { name: 'Copiloto interno', why: 'Un asistente privado que sabe cómo funciona tu empresa.' },
      rag: { name: 'Ingeniería de pipeline RAG', why: 'Recuperación que devuelve lo correcto, con citas.' },
      orchestration: { name: 'Orquestación multiagente', why: 'Agentes que planifican, usan herramientas y traspasan tareas, de forma auditable.' },
      'structured-out': { name: 'Salida estructurada / funciones', why: 'Convierte al LLM en una parte confiable de tu backend.' },
      'llm-eval': { name: 'Marco de evaluación de LLM', why: 'Conjunto de referencia (golden set) + puntuación con LLM como juez para tu función.' },
      redteam: { name: 'Red-team de IA y batería de pruebas de seguridad', why: 'Pruebas de inyección, jailbreak, PII y toxicidad.' },
      'ci-gate': { name: 'Compuerta de calidad de IA en CI', why: 'Un cambio de IA defectuoso bloquea el merge, no la retro.' },
      grounding: { name: 'Compuerta de alucinación / grounding', why: 'Evita que invente hechos y políticas.' },
      regression: { name: 'Pruebas de regresión de prompts y modelos', why: 'Sabrás exactamente qué rompió la actualización del modelo.' },
      'agent-eval': { name: 'Evaluación de agentes', why: '¿Usó el agente la herramienta correcta y completó la tarea?' },
      observability: { name: 'Observabilidad y costo de LLM', why: 'Observa calidad, deriva y gasto en producción.' },
      e2e: { name: 'Automatización de pruebas E2E', why: 'Tus flujos críticos, cubiertos y en verde en CI.' },
      'api-testing': { name: 'Pruebas de API y de contrato', why: 'Detecta el endpoint roto antes que el frontend.' },
      'mobile-cert': { name: 'Certificación móvil en dispositivos reales', why: 'Lanza iOS/Android con pruebas, no con esperanza.' },
      cicd: { name: 'Pipeline CI/CD + integración de pruebas', why: 'Un badge verde en el que puedes confiar.' },
      flaky: { name: 'Estabilización de pruebas inestables', why: 'Haz que el rojo vuelva a significar algo.' },
      perf: { name: 'Líneas base de rendimiento y carga', why: 'Conoce el punto de quiebre de tu ruta crítica.' },
      visual: { name: 'Pruebas de regresión visual', why: 'Detecta el fallo de layout que una prueba unitaria no ve.' },
      a11y: { name: 'Auditorías de accesibilidad (a11y)', why: 'WCAG 2.2: teclado, contraste, movimiento reducido.' },
      workflow: { name: 'Automatización de flujos de trabajo', why: 'El flujo administrativo repetitivo, automatizado de principio a fin.' },
      'lead-capture': { name: 'Captura de prospectos → calificar → derivar', why: 'Cada prospecto captado, calificado y contactado en minutos.' },
      etl: { name: 'Pipelines de datos / ETL', why: 'Mueve y transforma datos de forma confiable y programada.' },
      integrations: { name: 'Integraciones (CRM, herramientas, APIs)', why: 'Haz que tus herramientas por fin se comuniquen entre sí.' },
      monitoring: { name: 'Monitoreo / scraping / alertas', why: 'Vigila una fuente y actúa cuando algo cambia.' },
      scheduled: { name: 'Tareas programadas y back-office', why: 'La tarea recurrente que nadie quiere recordar.' },
      'web-app': { name: 'Apps web y portales de clientes', why: 'Autenticación, pagos, dashboards, listos para producción.' },
      'internal-tools': { name: 'Herramientas internas / paneles de administración', why: 'Reemplaza la hoja de cálculo que tu equipo maneja a mano.' },
      backend: { name: 'APIs y backends', why: 'La capa de servicios de la que depende todo lo demás.' },
      dashboards: { name: 'Dashboards y visualización de datos', why: 'Convierte tus datos en una decisión, no en un CSV.' },
    },
  },
  pt: {
    effortUnit: 'sem',
    disclaimer: 'Faixas indicativas, não um orçamento. O escopo e o preço exatos são definidos em uma conversa rápida.',
    phases: { audit: 'Auditoria', build: 'Construção', gate: 'Comprovação', operate: 'Operação' },
    segments: {
      'service-business': 'Empresa de serviços',
      'ai-product': 'Produto / recurso de IA',
      'ops-automation': 'Operações / back-office',
      'product-build': 'Produto / plataforma',
    },
    questions: {
      segment: {
        prompt: 'O que melhor descreve você?',
        options: {
          'seg-service': 'Uma empresa de serviços',
          'seg-aiproduct': 'Lançando um produto/recurso de IA',
          'seg-ops': 'Afogado em trabalho operacional/administrativo',
          'seg-product': 'Preciso construir um produto ou plataforma',
        },
      },
      needs: {
        prompt: 'O que você quer que aconteça?',
        options: {
          'opt-eval': 'Provar que nosso recurso de IA funciona',
          'opt-safety': 'Impedir que ele alucine ou vaze dados',
          'opt-e2e': 'Impedir que os lançamentos quebrem',
          'opt-build-ai': 'Construir um assistente/agente de IA',
          'opt-voice': 'Atender todas as chamadas automaticamente',
          'opt-automate': 'Automatizar um fluxo de trabalho manual',
          'opt-leads': 'Nunca perder um lead',
          'opt-product': 'Construir um app web / ferramenta interna',
          'opt-data': 'Dar sentido aos nossos dados',
        },
      },
      maturity: {
        prompt: 'Onde você está hoje?',
        options: {
          'mat-idea': 'Apenas uma ideia',
          'mat-demo': 'Uma demo que ainda não é confiável',
          'mat-prod': 'Em produção, precisa de robustez',
        },
      },
    },
    cards: {
      chatbot: { name: 'Assistente conversacional', why: 'Chatbot de suporte/produto fundamentado nos seus documentos.' },
      'voice-agent': { name: 'Agente de voz com IA', why: 'Atende 24/7, qualifica, agenda e envia um resumo por SMS.' },
      'doc-intake': { name: 'Ingestão e extração de documentos', why: 'Documentos bagunçados convertidos em dados estruturados e validados.' },
      copilot: { name: 'Copiloto interno', why: 'Um assistente privado que sabe como sua empresa funciona.' },
      rag: { name: 'Engenharia de pipeline RAG', why: 'Recuperação que retorna o resultado certo, com citações.' },
      orchestration: { name: 'Orquestração multiagente', why: 'Agentes que planejam, usam ferramentas e repassam tarefas, de forma auditável.' },
      'structured-out': { name: 'Saída estruturada / funções', why: 'Torne o LLM uma parte confiável do seu backend.' },
      'llm-eval': { name: 'Suíte de avaliação de LLM', why: 'Conjunto de referência (golden set) + pontuação com LLM como juiz para o seu recurso.' },
      redteam: { name: 'Red-team de IA e bateria de segurança', why: 'Testes de injeção, jailbreak, PII e toxicidade.' },
      'ci-gate': { name: 'Gate de qualidade de IA no CI', why: 'Uma mudança de IA ruim bloqueia o merge, não a retrospectiva.' },
      grounding: { name: 'Gate de alucinação / grounding', why: 'Impede que invente fatos e políticas.' },
      regression: { name: 'Testes de regressão de prompt e modelo', why: 'Saiba exatamente o que a atualização do modelo quebrou.' },
      'agent-eval': { name: 'Avaliação de agentes', why: 'O agente usou a ferramenta certa e concluiu a tarefa?' },
      observability: { name: 'Observabilidade e custo de LLM', why: 'Veja qualidade, desvio e gasto em produção.' },
      e2e: { name: 'Automação de testes E2E', why: 'Seus fluxos críticos, cobertos e verdes no CI.' },
      'api-testing': { name: 'Testes de API e de contrato', why: 'Pegue o endpoint quebrado antes do frontend.' },
      'mobile-cert': { name: 'Certificação móvel em dispositivos reais', why: 'Publique iOS/Android com provas, não com esperança.' },
      cicd: { name: 'Pipeline CI/CD + integração de testes', why: 'Um badge verde em que você pode confiar.' },
      flaky: { name: 'Estabilização de testes instáveis', why: 'Faça o vermelho voltar a significar algo.' },
      perf: { name: 'Linhas de base de desempenho e carga', why: 'Conheça o ponto de ruptura do seu caminho crítico.' },
      visual: { name: 'Testes de regressão visual', why: 'Pegue a quebra de layout que um teste unitário não vê.' },
      a11y: { name: 'Auditorias de acessibilidade (a11y)', why: 'WCAG 2.2: teclado, contraste, movimento reduzido.' },
      workflow: { name: 'Automação de fluxos de trabalho', why: 'O fluxo administrativo repetitivo, automatizado de ponta a ponta.' },
      'lead-capture': { name: 'Captura de leads → qualificar → encaminhar', why: 'Cada lead captado, qualificado e contatado em minutos.' },
      etl: { name: 'Pipelines de dados / ETL', why: 'Mova e transforme dados de forma confiável e agendada.' },
      integrations: { name: 'Integrações (CRM, ferramentas, APIs)', why: 'Faça suas ferramentas finalmente conversarem entre si.' },
      monitoring: { name: 'Monitoramento / scraping / alertas', why: 'Observe uma fonte e aja quando algo muda.' },
      scheduled: { name: 'Tarefas agendadas e back-office', why: 'A tarefa recorrente que ninguém quer lembrar.' },
      'web-app': { name: 'Apps web e portais de clientes', why: 'Autenticação, pagamentos, dashboards, prontos para produção.' },
      'internal-tools': { name: 'Ferramentas internas / painéis de administração', why: 'Substitua a planilha que sua equipe gerencia à mão.' },
      backend: { name: 'APIs e backends', why: 'A camada de serviços da qual todo o resto depende.' },
      dashboards: { name: 'Dashboards e visualização de dados', why: 'Transforme seus dados em uma decisão, não em um CSV.' },
    },
  },
};

function pack(lang) { return SCOPE_I18N[lang] || null; }

export function locPhase(phaseKey, fallbackLabel, lang) {
  const t = pack(lang);
  return (t && t.phases && t.phases[phaseKey]) || fallbackLabel;
}
export function locSegment(segKey, fallbackLabel, lang) {
  const t = pack(lang);
  return (t && t.segments && t.segments[segKey]) || fallbackLabel;
}
export function locCardName(card, lang) {
  const t = pack(lang);
  return (t && t.cards && t.cards[card.key] && t.cards[card.key].name) || card.name;
}
export function locCardWhy(card, lang) {
  const t = pack(lang);
  return (t && t.cards && t.cards[card.key] && t.cards[card.key].why) || card.why;
}
export function locEffort(effort, lang) {
  const t = pack(lang);
  if (!t || !t.effortUnit || !effort) return effort;
  return String(effort).replace(/\bwks\b/g, t.effortUnit);
}
export function locQPrompt(q, lang) {
  const t = pack(lang);
  return (t && t.questions && t.questions[q.id] && t.questions[q.id].prompt) || q.prompt;
}
export function locOptLabel(qid, opt, lang) {
  const t = pack(lang);
  return (t && t.questions && t.questions[qid] && t.questions[qid].options && t.questions[qid].options[opt.id]) || opt.label;
}
export function locDisclaimer(lang, fallback) {
  const t = pack(lang);
  return (t && t.disclaimer) || fallback;
}
