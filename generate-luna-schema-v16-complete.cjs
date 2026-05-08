/**
 * LUNA v16.0 — Schema Structure Generator (REVISADO E COMPLETO)
 * Gera toda a estrutura de pastas e arquivos JSON do schema definitivo
 * 
 * CORREÇÕES APLICADAS (13 itens faltantes):
 * ✅ 1. pendingActions do Tema 5 adicionado ao clients-registry
 * ✅ 2. Bugs do TPV adicionados ao clients-registry
 * ✅ 3. Schema de privacidade/GDPR adicionado
 * ✅ 4. Schema de NLP enrichment (sentiment, intent, entities) adicionado
 * ✅ 5. Knowledge graph adicionado
 * ✅ 6. Self-evolution adicionado
 * ✅ 7. Predictions adicionado
 * ✅ 8. Threads adicionado
 * ✅ 9. Entities adicionado
 * ✅ 10. News engine adicionado
 * ✅ 11. Email cache adicionado
 * ✅ 12. Form leads adicionado
 * ✅ 13. Commands config (15+ comandos) adicionado
 * 
 * Uso: node generate-luna-schema.js
 * Local: C:\Users\Administrator\Documents\NEXO DIGITAL\01_ATIVOS\NEXO_DASHBOARD_PRO
 */

const fs = require('fs');
const path = require('path');

const BASE_PATH = 'C:/Users/Administrator/Documents/NEXO DIGITAL/01_ATIVOS/NEXO_DASHBOARD_PRO';

const structure = {
  dirs: [
    'backend/data/schema',
    'backend/data/runtime', 
    'backend/data/config',
    'backend/data/reports',
    'frontend/dashboard-luna',
    'scripts',
    'logs',
    'temp'
  ],
  files: {}
};

// All JSON files content (8 schema + 3 config + 12 runtime = 23 total)
const files = {
  "backend/data/schema/contacts-map.json": {
    "_schema": {
      "version": "16.0.1",
      "codename": "AUTONOMOUS INTELLIGENCE CORE",
      "lastUpdated": "2026-05-04T19:50:00Z",
      "editable": true,
      "editedBy": "system",
      "editHistory": []
    },
    "_meta": {
      "company": "NEXO DIGITAL",
      "legalName": "NEXO DIGITAL S.L.",
      "location": "Barcelona, Espanha",
      "founders": [
        {
          "id": "nexo-abner-001",
          "name": "Abner Gabriel Mendes",
          "role": "CEO & Co-Founder"
        },
        {
          "id": "nexo-elias-001",
          "name": "Elias Mendes",
          "role": "Co-Founder & Fullstack Advisor"
        },
        {
          "id": "nexo-enoque-001",
          "name": "Enoque G Santos Clemente",
          "role": "Co-Founder & Fullstack Dev"
        }
      ],
      "ownership": {
        "model": "equal-partners",
        "split": [
          0.25,
          0.25,
          0.25
        ],
        "reinvestment": 0.25,
        "note": "25% cada fundador + 25% reinvestimento NEXO"
      },
      "allFullstack": true,
      "note": "Superclim = empresa pessoal Elias/Abner (limpeza). NEXO = empresa tech dos 3 sócios. Projetos pessoais (Bool, Truco, Tetris) NÃO constam aqui."
    },
    "contacts": {
      "34685093192@c.us": {
        "id": "nexo-abner-001",
        "displayName": "Abner",
        "fullName": "Abner Gabriel Mendes",
        "shortName": "Abner",
        "role": "CEO & Co-Founder",
        "department": "Direção & Tecnologia",
        "isNexo": true,
        "isAdmin": true,
        "isFounder": true,
        "ownership": 0.25,
        "phones": {
          "primary": "34685093192",
          "secondary": null,
          "whatsapp": "34685093192"
        },
        "emails": {
          "primary": "abner@nexo-digital.app",
          "secondary": null,
          "business": "abner@nexo-digital.app"
        },
        "skills": [
          "Fullstack",
          "Gestão",
          "Arquitetura",
          "Negócios",
          "IA",
          "Orquestração",
          "DevOps"
        ],
        "responsibilities": [
          "Gestão estratégica",
          "Arquitetura de sistemas",
          "Relacionamento com clientes",
          "Orquestração de IA"
        ],
        "avatar": null,
        "avatarUrl": null,
        "status": "active",
        "timezone": "Europe/Madrid",
        "language": "pt-BR",
        "notificationPriority": "P0",
        "lastSeen": null,
        "activityScore": 0,
        "editableFields": [
          "displayName",
          "role",
          "department",
          "skills",
          "responsibilities",
          "avatar",
          "avatarUrl",
          "status",
          "timezone",
          "language",
          "notificationPriority",
          "emails.secondary"
        ],
        "validation": {
          "displayName": {
            "minLength": 2,
            "maxLength": 50,
            "required": true
          },
          "role": {
            "enum": [
              "CEO & Co-Founder",
              "Co-Founder & Fullstack Dev",
              "Co-Founder & Fullstack Advisor",
              "Dev",
              "Designer",
              "Estagiário"
            ],
            "required": true
          },
          "status": {
            "enum": [
              "active",
              "inactive",
              "away",
              "busy"
            ],
            "required": true
          },
          "notificationPriority": {
            "enum": [
              "P0",
              "P1",
              "P2",
              "P3"
            ],
            "required": true
          }
        },
        "lastEdited": null,
        "editedBy": null,
        "editHistory": []
      },
      "34689135159@c.us": {
        "id": "nexo-enoque-001",
        "displayName": "Enoque",
        "fullName": "Enoque G Santos Clemente",
        "shortName": "Enoque",
        "role": "Co-Founder & Fullstack Dev",
        "department": "Tecnologia",
        "isNexo": true,
        "isAdmin": true,
        "isFounder": true,
        "ownership": 0.25,
        "phones": {
          "primary": "34689135159",
          "secondary": null,
          "whatsapp": "34689135159"
        },
        "emails": {
          "primary": "enoque009@gmail.com",
          "secondary": null,
          "business": "enoque009@gmail.com"
        },
        "skills": [
          "Fullstack",
          "React",
          "Next.js",
          "Vite",
          "Tailwind CSS",
          "Node.js",
          "TypeScript",
          "Frontend",
          "Mobile"
        ],
        "responsibilities": [
          "Desenvolvimento frontend",
          "UI/UX",
          "Implementação de features",
          "Code review"
        ],
        "avatar": null,
        "avatarUrl": null,
        "status": "active",
        "timezone": "Europe/Madrid",
        "language": "pt-BR",
        "notificationPriority": "P1",
        "lastSeen": null,
        "activityScore": 0,
        "editableFields": [
          "displayName",
          "role",
          "department",
          "skills",
          "responsibilities",
          "avatar",
          "avatarUrl",
          "status",
          "timezone",
          "language",
          "notificationPriority",
          "emails.secondary"
        ],
        "validation": {
          "displayName": {
            "minLength": 2,
            "maxLength": 50,
            "required": true
          },
          "role": {
            "enum": [
              "CEO & Co-Founder",
              "Co-Founder & Fullstack Dev",
              "Co-Founder & Fullstack Advisor",
              "Dev",
              "Designer",
              "Estagiário"
            ],
            "required": true
          },
          "status": {
            "enum": [
              "active",
              "inactive",
              "away",
              "busy"
            ],
            "required": true
          },
          "notificationPriority": {
            "enum": [
              "P0",
              "P1",
              "P2",
              "P3"
            ],
            "required": true
          }
        },
        "lastEdited": null,
        "editedBy": null,
        "editHistory": []
      },
      "34672953062@c.us": {
        "id": "nexo-elias-pessoal",
        "displayName": "Elias (Pessoal)",
        "fullName": "Elias Mendes",
        "shortName": "Elias",
        "role": "Co-Founder & Fullstack Advisor",
        "department": "Consultoria & Negócios",
        "isNexo": true,
        "isAdmin": true,
        "isFounder": true,
        "ownership": 0.25,
        "phones": {
          "primary": "34672953062",
          "secondary": null,
          "whatsapp": "34672953062",
          "label": "Pessoal"
        },
        "emails": {
          "primary": "elias@superclim.es",
          "secondary": null,
          "business": "elias@superclim.es"
        },
        "skills": [
          "Fullstack",
          "Consultoria",
          "Negócios",
          "Limpeza",
          "Impermeabilização",
          "Atendimento ao cliente"
        ],
        "responsibilities": [
          "Consultoria estratégica",
          "Relacionamento com clientes",
          "Negociação",
          "Supervisão Superclim"
        ],
        "avatar": null,
        "avatarUrl": null,
        "status": "active",
        "timezone": "Europe/Madrid",
        "language": "es-ES",
        "notificationPriority": "P1",
        "lastSeen": null,
        "activityScore": 0,
        "note": "Pai biológico do Abner. Dono da Superclim Servicios. Número pessoal.",
        "editableFields": [
          "displayName",
          "role",
          "department",
          "skills",
          "responsibilities",
          "avatar",
          "avatarUrl",
          "status",
          "timezone",
          "language",
          "notificationPriority",
          "emails.secondary",
          "note"
        ],
        "validation": {
          "displayName": {
            "minLength": 2,
            "maxLength": 50,
            "required": true
          },
          "role": {
            "enum": [
              "CEO & Co-Founder",
              "Co-Founder & Fullstack Dev",
              "Co-Founder & Fullstack Advisor",
              "Dev",
              "Designer",
              "Estagiário"
            ],
            "required": true
          },
          "status": {
            "enum": [
              "active",
              "inactive",
              "away",
              "busy"
            ],
            "required": true
          },
          "notificationPriority": {
            "enum": [
              "P0",
              "P1",
              "P2",
              "P3"
            ],
            "required": true
          }
        },
        "lastEdited": null,
        "editedBy": null,
        "editHistory": []
      },
      "34624529442@c.us": {
        "id": "nexo-elias-empresarial",
        "displayName": "Elias (Empresarial)",
        "fullName": "Elias Mendes",
        "shortName": "Elias",
        "role": "Co-Founder & Fullstack Advisor",
        "department": "Consultoria & Negócios",
        "isNexo": true,
        "isAdmin": true,
        "isFounder": true,
        "ownership": 0.25,
        "phones": {
          "primary": "34624529442",
          "secondary": null,
          "whatsapp": "34624529442",
          "label": "Empresarial"
        },
        "emails": {
          "primary": "elias@superclim.es",
          "secondary": null,
          "business": "elias@superclim.es"
        },
        "company": "Superclim Servicios",
        "companyRole": "Proprietário",
        "skills": [
          "Fullstack",
          "Consultoria",
          "Negócios",
          "Limpeza",
          "Impermeabilização",
          "Atendimento ao cliente"
        ],
        "responsibilities": [
          "Consultoria estratégica",
          "Relacionamento com clientes",
          "Negociação",
          "Gestão Superclim"
        ],
        "avatar": null,
        "avatarUrl": null,
        "status": "active",
        "timezone": "Europe/Madrid",
        "language": "es-ES",
        "notificationPriority": "P1",
        "lastSeen": null,
        "activityScore": 0,
        "note": "Número empresarial da Superclim Servicios. Mesma pessoa do Elias (Pessoal).",
        "editableFields": [
          "displayName",
          "role",
          "department",
          "skills",
          "responsibilities",
          "avatar",
          "avatarUrl",
          "status",
          "timezone",
          "language",
          "notificationPriority",
          "emails.secondary",
          "company",
          "companyRole",
          "note"
        ],
        "validation": {
          "displayName": {
            "minLength": 2,
            "maxLength": 50,
            "required": true
          },
          "role": {
            "enum": [
              "CEO & Co-Founder",
              "Co-Founder & Fullstack Dev",
              "Co-Founder & Fullstack Advisor",
              "Dev",
              "Designer",
              "Estagiário"
            ],
            "required": true
          },
          "status": {
            "enum": [
              "active",
              "inactive",
              "away",
              "busy"
            ],
            "required": true
          },
          "notificationPriority": {
            "enum": [
              "P0",
              "P1",
              "P2",
              "P3"
            ],
            "required": true
          }
        },
        "lastEdited": null,
        "editedBy": null,
        "editHistory": []
      }
    },
    "resolutionRules": {
      "priority": [
        "exactMatch",
        "normalizedMatch",
        "partialMatch",
        "fallback"
      ],
      "exactMatch": {
        "description": "Número WhatsApp idêntico ao mapeado",
        "confidence": 1.0
      },
      "normalizedMatch": {
        "description": "Número sem prefixo ou com formatação diferente",
        "confidence": 0.95,
        "example": "+34685093192 → 34685093192"
      },
      "partialMatch": {
        "description": "Últimos 8 dígitos coincidem",
        "confidence": 0.7,
        "action": "logWarning"
      },
      "fallback": {
        "description": "Número não reconhecido",
        "confidence": 0.0,
        "action": "askUser",
        "prompt": "🔍 Número {phone} não reconhecido no contacts-map.\n\nQuem é esta pessoa?\n1️⃣ Cliente novo\n2️⃣ Parceiro/fornecedor\n3️⃣ Spam\n4️⃣ Erro meu (é número de alguém da NEXO)\n5️⃣ Ignorar esta vez\n\nResponda com o número da opção ou o nome da pessoa.",
        "timeout": 300000,
        "defaultAction": "logUnknown"
      }
    },
    "unknownContacts": {
      "logFile": "backend/data/runtime/unknown-contacts.json",
      "autoExpire": 2592000000,
      "maxStored": 100
    }
  },
  "backend/data/schema/clients-registry.json": {
    "_schema": {
      "version": "16.0.1",
      "lastUpdated": "2026-05-04T19:50:00Z",
      "editable": true,
      "editedBy": "system"
    },
    "pipelineStages": [
      "novo",
      "contatado",
      "qualificado",
      "proposta-enviada",
      "negociacao",
      "contrato-assinado",
      "em-progresso",
      "concluido",
      "arquivado"
    ],
    "leadSources": [
      "referral",
      "site-form",
      "whatsapp-detectado",
      "instagram",
      "email-inbound",
      "evento",
      "indicacao",
      "outro"
    ],
    "clients": {
      "paulo-santafe": {
        "id": "paulo-santafe",
        "status": "ativo",
        "type": "cliente-externo",
        "name": "Paulo",
        "company": "SantaFe Construcciones",
        "project": "SANTAFE-CONSTRUCCIONES",
        "services": [
          "Web",
          "SEO Básico",
          "Publicação"
        ],
        "groupId": "Paulo (Web🎯🙌🏻)@g.us",
        "contactInfo": {
          "phone": null,
          "email": null,
          "whatsapp": "client-paulo@c.us"
        },
        "pipeline": {
          "currentStage": "em-progresso",
          "stageHistory": [
            {
              "stage": "contrato-assinado",
              "date": "2026-03-01",
              "note": "Projeto iniciado"
            }
          ]
        },
        "financial": {
          "budgetApproved": true,
          "contractSigned": true,
          "paymentStatus": "pendente",
          "totalValue": null,
          "paidAmount": 0,
          "currency": "EUR"
        },
        "lastMentioned": null,
        "nextAction": "Finalizar web e publicar",
        "priority": "P1",
        "editableFields": [
          "name",
          "company",
          "services",
          "nextAction",
          "priority",
          "financial",
          "contactInfo"
        ],
        "lastEdited": null,
        "editedBy": null,
        "notes": []
      },
      "tpv-sorveteria": {
        "id": "tpv-sorveteria",
        "status": "potencial",
        "type": "lead",
        "name": "TPV Sorveteria",
        "company": "Sorveteria (Nome Pendente)",
        "project": null,
        "services": [
          "TPV-Software",
          "Desenvolvimento"
        ],
        "groupId": null,
        "contactInfo": {
          "phone": null,
          "email": null,
          "whatsapp": null
        },
        "pipeline": {
          "currentStage": "novo",
          "stageHistory": []
        },
        "financial": {
          "budgetApproved": false,
          "contractSigned": false,
          "paymentStatus": null,
          "totalValue": null,
          "paidAmount": 0,
          "currency": "EUR"
        },
        "bugs": [
          {
            "id": "bug-001",
            "title": "White screen no item modal para fixed-price items",
            "severity": "critical",
            "status": "open",
            "detected": "2026-04-21"
          },
          {
            "id": "bug-002",
            "title": "Kiosk não consegue adicionar fixed-price items ao cart",
            "severity": "critical",
            "status": "open",
            "detected": "2026-04-21"
          },
          {
            "id": "bug-003",
            "title": "Kiosk modal não abre ao clicar no item",
            "severity": "critical",
            "status": "open",
            "detected": "2026-04-21"
          }
        ],
        "lastMentioned": null,
        "nextAction": "Aguardar aprovação de orçamento",
        "priority": "P0",
        "probability": 0.6,
        "source": "prospeccao-interna",
        "editableFields": [
          "name",
          "company",
          "services",
          "nextAction",
          "priority",
          "probability",
          "source",
          "contactInfo",
          "bugs"
        ],
        "lastEdited": null,
        "editedBy": null,
        "notes": [
          {
            "date": "2026-04-21",
            "text": "3 bugs críticos encontrados em demo. Orçamento ainda não aprovado.",
            "author": "Abner"
          }
        ]
      },
      "jess-onadance": {
        "id": "jess-onadance",
        "status": "potencial",
        "type": "lead",
        "name": "Jess",
        "company": "Onadance",
        "project": null,
        "services": [
          "Web",
          "SEO"
        ],
        "groupId": null,
        "contactInfo": {
          "phone": null,
          "email": null,
          "whatsapp": null
        },
        "pipeline": {
          "currentStage": "novo",
          "stageHistory": []
        },
        "financial": {
          "budgetApproved": false,
          "contractSigned": false,
          "paymentStatus": null,
          "totalValue": null,
          "paidAmount": 0,
          "currency": "EUR"
        },
        "lastMentioned": null,
        "nextAction": "Preparar oferta",
        "priority": "P2",
        "probability": 0.6,
        "source": "referral",
        "editableFields": [
          "name",
          "company",
          "services",
          "nextAction",
          "priority",
          "probability",
          "source",
          "contactInfo"
        ],
        "lastEdited": null,
        "editedBy": null,
        "notes": []
      },
      "gesse-reformasmachado": {
        "id": "gesse-reformasmachado",
        "status": "potencial",
        "type": "lead",
        "name": "Gesse",
        "company": "ReformasMachado.com",
        "project": null,
        "services": [
          "Web",
          "SEO"
        ],
        "groupId": null,
        "contactInfo": {
          "phone": null,
          "email": null,
          "whatsapp": null
        },
        "pipeline": {
          "currentStage": "novo",
          "stageHistory": []
        },
        "financial": {
          "budgetApproved": false,
          "contractSigned": false,
          "paymentStatus": null,
          "totalValue": null,
          "paidAmount": 0,
          "currency": "EUR"
        },
        "lastMentioned": null,
        "nextAction": "Preparar oferta de web/SEO",
        "priority": "P2",
        "probability": 0.7,
        "source": "lead-detectado",
        "editableFields": [
          "name",
          "company",
          "services",
          "nextAction",
          "priority",
          "probability",
          "source",
          "contactInfo"
        ],
        "lastEdited": null,
        "editedBy": null,
        "notes": []
      },
      "lucas-mapio": {
        "id": "lucas-mapio",
        "status": "potencial",
        "type": "lead",
        "name": "Lucas",
        "company": "Mapio",
        "project": null,
        "services": [
          "Web",
          "App"
        ],
        "groupId": null,
        "contactInfo": {
          "phone": null,
          "email": null,
          "whatsapp": null
        },
        "pipeline": {
          "currentStage": "novo",
          "stageHistory": []
        },
        "financial": {
          "budgetApproved": false,
          "contractSigned": false,
          "paymentStatus": null,
          "totalValue": null,
          "paidAmount": 0,
          "currency": "EUR"
        },
        "lastMentioned": null,
        "nextAction": "Entender projetos",
        "priority": "P3",
        "probability": 0.5,
        "source": "referral",
        "editableFields": [
          "name",
          "company",
          "services",
          "nextAction",
          "priority",
          "probability",
          "source",
          "contactInfo"
        ],
        "lastEdited": null,
        "editedBy": null,
        "notes": []
      },
      "irmaos-ccb": {
        "id": "irmaos-ccb",
        "status": "potencial",
        "type": "lead",
        "name": "Irmãos CCB",
        "company": "CCB",
        "project": null,
        "services": [
          "Faturação",
          "Software"
        ],
        "groupId": null,
        "contactInfo": {
          "phone": null,
          "email": null,
          "whatsapp": null
        },
        "pipeline": {
          "currentStage": "novo",
          "stageHistory": []
        },
        "financial": {
          "budgetApproved": false,
          "contractSigned": false,
          "paymentStatus": null,
          "totalValue": null,
          "paidAmount": 0,
          "currency": "EUR"
        },
        "lastMentioned": null,
        "nextAction": "Preparar oferta de faturação",
        "priority": "P3",
        "probability": 0.4,
        "source": "lead-detectado",
        "editableFields": [
          "name",
          "company",
          "services",
          "nextAction",
          "priority",
          "probability",
          "source",
          "contactInfo"
        ],
        "lastEdited": null,
        "editedBy": null,
        "notes": []
      }
    },
    "pendingActions": {
      "_meta": {
        "source": "Tema 5 - Reunião NEXO",
        "dateAdded": "2026-05-04",
        "addedBy": "Abner"
      },
      "actions": [
        {
          "id": "pa-001",
          "text": "Acabar de arrumar nexo",
          "status": "pendente",
          "priority": "P0",
          "assignedTo": "nexo-abner-001",
          "deadline": null
        },
        {
          "id": "pa-002",
          "text": "Web Paulo Plan no grupo dele",
          "status": "pendente",
          "priority": "P1",
          "assignedTo": "nexo-abner-001",
          "deadline": null
        },
        {
          "id": "pa-003",
          "text": "Divulgar nexo / postar no perfil",
          "status": "pendente",
          "priority": "P2",
          "assignedTo": null,
          "deadline": null
        },
        {
          "id": "pa-004",
          "text": "Faturas em progresso",
          "status": "pendente",
          "priority": "P1",
          "assignedTo": "nexo-elias-001",
          "deadline": null
        },
        {
          "id": "pa-005",
          "text": "Dashboard/tools nexo em progresso",
          "status": "em-progresso",
          "priority": "P0",
          "assignedTo": "nexo-abner-001",
          "deadline": null
        },
        {
          "id": "pa-006",
          "text": "PC Abner",
          "status": "pendente",
          "priority": "P2",
          "assignedTo": "nexo-abner-001",
          "deadline": null
        },
        {
          "id": "pa-007",
          "text": "Renovar IAs e revisar gastos",
          "status": "pendente",
          "priority": "P1",
          "assignedTo": "nexo-abner-001",
          "deadline": null
        }
      ]
    },
    "autoDetect": {
      "enabled": true,
      "keywords": {
        "budget": [
          "orçamento",
          "presupuesto",
          "quanto custa",
          "valor",
          "preço",
          "budget",
          "price"
        ],
        "interest": [
          "interessado",
          "queremos",
          "precisamos",
          "gostaria",
          "interesa",
          "me gustaria"
        ],
        "timeline": [
          "prazo",
          "quando",
          "urgente",
          "esta semana",
          "proximo mes",
          "timeline",
          "deadline"
        ]
      },
      "scoring": {
        "budgetMentioned": 10,
        "timelineMentioned": 10,
        "contactInfoComplete": 15,
        "projectTypeClear": 10,
        "referral": 20,
        "websiteVisit": 5
      }
    }
  },
  "backend/data/schema/projects-registry.json": {
    "_schema": {
      "version": "16.0.1",
      "lastUpdated": "2026-05-04T19:50:00Z",
      "editable": true,
      "editedBy": "system"
    },
    "projectTypes": [
      "cliente-externo",
      "produto-nexo",
      "infraestrutura-nexo",
      "empresa-pessoal"
    ],
    "statuses": [
      "planejamento",
      "em-progresso",
      "em-teste",
      "concluido",
      "arquivado",
      "pausado"
    ],
    "projects": {
      "SANTAFE-CONSTRUCCIONES": {
        "id": "SANTAFE-CONSTRUCCIONES",
        "codename": "SANTAFE",
        "name": "SantaFe Construcciones",
        "type": "cliente-externo",
        "status": "em-progresso",
        "priority": "P1",
        "team": [
          "nexo-abner-001",
          "nexo-enoque-001",
          "nexo-elias-001"
        ],
        "clientId": "paulo-santafe",
        "services": [
          "Web",
          "SEO Básico",
          "Publicação"
        ],
        "financial": {
          "budgetApproved": true,
          "contractSigned": true,
          "paymentStatus": "pendente",
          "totalValue": null,
          "currency": "EUR"
        },
        "milestones": [
          {
            "name": "Design aprovado",
            "done": true,
            "date": "2026-03-15"
          },
          {
            "name": "Desenvolvimento",
            "done": true,
            "date": "2026-04-20"
          },
          {
            "name": "SEO básico",
            "done": false,
            "date": null
          },
          {
            "name": "Publicação",
            "done": false,
            "date": null
          }
        ],
        "bugs": [],
        "demoReady": false,
        "deployed": false,
        "repo": null,
        "editableFields": [
          "name",
          "status",
          "priority",
          "services",
          "milestones",
          "repo"
        ],
        "lastEdited": null,
        "editedBy": null
      },
      "NEXO-DASHBOARD": {
        "id": "NEXO-DASHBOARD",
        "codename": "DASHBOARD",
        "name": "NEXO Dashboard Pro",
        "type": "infraestrutura-nexo",
        "status": "em-progresso",
        "priority": "P0",
        "team": [
          "nexo-abner-001",
          "nexo-enoque-001",
          "nexo-elias-001"
        ],
        "clientId": null,
        "services": [
          "Dashboard",
          "Automação",
          "IA"
        ],
        "financial": {
          "budgetApproved": true,
          "contractSigned": false,
          "paymentStatus": "interno",
          "totalValue": 0,
          "currency": "EUR"
        },
        "milestones": [
          {
            "name": "Schema de dados",
            "done": true,
            "date": "2026-05-04"
          },
          {
            "name": "Extração WhatsApp",
            "done": false,
            "date": null
          },
          {
            "name": "Dashboard visual",
            "done": false,
            "date": null
          },
          {
            "name": "Email integration",
            "done": false,
            "date": null
          },
          {
            "name": "Form leads",
            "done": false,
            "date": null
          }
        ],
        "bugs": [],
        "demoReady": false,
        "deployed": false,
        "repo": "Jhin1v9/nexo-dashboard-pro",
        "editableFields": [
          "name",
          "status",
          "priority",
          "services",
          "milestones",
          "repo"
        ],
        "lastEdited": null,
        "editedBy": null,
        "note": "Ferramenta interna da NEXO. Não é projeto para cliente externo."
      }
    }
  },
  "backend/data/schema/groups-config.json": {
    "_schema": {
      "version": "16.0.1",
      "lastUpdated": "2026-05-04T19:50:00Z"
    },
    "groups": {
      "🏆Production - 2026🙏🏻@g.us": {
        "id": "nexo-production-2026",
        "displayName": "Nexo Pro - 2026",
        "originalName": "🏆Production - 2026🙏🏻",
        "type": "internal",
        "isNexoOnly": true,
        "memberIds": [
          "nexo-abner-001",
          "nexo-enoque-001",
          "nexo-elias-pessoal",
          "nexo-elias-empresarial"
        ],
        "purpose": "Coordenação projetos NEXO DIGITAL",
        "monitoring": {
          "enabled": true,
          "scanInterval": 600000,
          "reportInterval": 1800000,
          "autoReport": true,
          "dashboardSendEnabled": true,
          "dashboardSendCooldown": "daily",
          "classifyMessages": true,
          "detectLeads": true,
          "detectTasks": true
        },
        "classificationDefaults": {
          "defaultCategory": "internal",
          "autoTagNexoMentions": true,
          "autoTagSuperclimMentions": false
        }
      },
      "Paulo (Web🎯🙌🏻)@g.us": {
        "id": "nexo-cliente-paulo",
        "displayName": "Paulo (Web)",
        "originalName": "Paulo (Web🎯🙌🏻)",
        "type": "client",
        "isNexoOnly": false,
        "clientId": "paulo-santafe",
        "projectId": "SANTAFE-CONSTRUCCIONES",
        "memberIds": [
          "nexo-abner-001",
          "nexo-enoque-001",
          "nexo-elias-pessoal",
          "nexo-elias-empresarial",
          "client-paulo"
        ],
        "monitoring": {
          "enabled": true,
          "scanInterval": 600000,
          "reportInterval": 3600000,
          "autoReport": false,
          "dashboardSendEnabled": false,
          "classifyMessages": true,
          "detectLeads": false,
          "detectTasks": true
        },
        "classificationDefaults": {
          "defaultCategory": "cliente",
          "autoTagNexoMentions": false,
          "autoTagSuperclimMentions": false
        }
      }
    }
  },
  "backend/data/schema/schema-version.json": {
    "currentVersion": "16.0.1",
    "versionHistory": [
      {
        "version": "16.0.1",
        "date": "2026-05-04T19:50:00Z",
        "changes": [
          "Schema inicial definitivo",
          "Estrutura editável via dashboard",
          "Slots para email/forms/notion"
        ],
        "author": "system",
        "rollbackAvailable": false
      }
    ],
    "migration": {
      "autoMigrate": true,
      "backupBeforeMigrate": true,
      "migrationLog": []
    }
  },
  "backend/data/schema/nlp-enrichment-schema.json": {
    "_schema": {
      "version": "16.0.1",
      "lastUpdated": "2026-05-04T19:50:00Z",
      "description": "Schema de enriquecimento NLP para cada mensagem processada"
    },
    "sentiment": {
      "score": {
        "type": "number",
        "min": -1.0,
        "max": 1.0,
        "description": "Score de sentimento (-1 negativo, 1 positivo)"
      },
      "label": {
        "type": "string",
        "enum": [
          "positive",
          "neutral",
          "negative",
          "mixed"
        ]
      },
      "intensity": {
        "type": "string",
        "enum": [
          "high",
          "medium",
          "low"
        ]
      },
      "aspects": {
        "product": {
          "type": "number",
          "min": -1.0,
          "max": 1.0
        },
        "service": {
          "type": "number",
          "min": -1.0,
          "max": 1.0
        },
        "price": {
          "type": "number",
          "min": -1.0,
          "max": 1.0
        }
      }
    },
    "intent": {
      "primary": {
        "type": "string",
        "enum": [
          "request",
          "inform",
          "question",
          "complaint",
          "suggestion",
          "command",
          "greeting",
          "farewell"
        ]
      },
      "secondary": {
        "type": "string",
        "enum": [
          "create-task",
          "ask-status",
          "share-link",
          "request-help",
          "give-feedback",
          "schedule-meeting",
          "make-decision"
        ]
      },
      "confidence": {
        "type": "number",
        "min": 0.0,
        "max": 1.0
      }
    },
    "entities": {
      "people": [
        {
          "name": "string",
          "role": "string",
          "confidence": "number"
        }
      ],
      "organizations": [
        {
          "name": "string",
          "type": "string",
          "isNexo": "boolean"
        }
      ],
      "locations": [
        {
          "name": "string",
          "type": "string"
        }
      ],
      "dates": [
        {
          "text": "string",
          "resolved": "string",
          "type": "string"
        }
      ],
      "products": [
        {
          "name": "string",
          "category": "string"
        }
      ],
      "technologies": [
        {
          "name": "string",
          "type": "string"
        }
      ],
      "amounts": [
        {
          "value": "number",
          "currency": "string",
          "context": "string"
        }
      ]
    },
    "keywords": {
      "type": "array",
      "items": "string"
    },
    "topics": {
      "type": "array",
      "items": "string"
    },
    "summary": {
      "type": "string",
      "maxLength": 200,
      "description": "Resumo de 1 linha gerado por LLM"
    },
    "language": {
      "type": "string",
      "enum": [
        "pt-BR",
        "es-ES",
        "en-US",
        "ca-ES"
      ]
    },
    "readability": {
      "wordCount": "number",
      "readTimeSeconds": "number",
      "complexity": {
        "type": "string",
        "enum": [
          "simple",
          "medium",
          "complex"
        ]
      }
    }
  },
  "backend/data/schema/message-privacy-schema.json": {
    "_schema": {
      "version": "16.0.1",
      "lastUpdated": "2026-05-04T19:50:00Z"
    },
    "privacy": {
      "containsSensitiveData": {
        "type": "boolean",
        "default": false
      },
      "sensitiveType": {
        "type": "string",
        "enum": [
          "financial",
          "personal",
          "health",
          "legal",
          "none"
        ],
        "default": "none"
      },
      "encryptionLevel": {
        "type": "string",
        "enum": [
          "none",
          "partial",
          "full"
        ],
        "default": "none"
      },
      "retentionDays": {
        "type": "number",
        "default": 365
      },
      "gdprCompliant": {
        "type": "boolean",
        "default": true
      },
      "canShareExternally": {
        "type": "boolean",
        "default": false
      },
      "allowedViewers": {
        "type": "array",
        "items": "string",
        "default": [
          "nexo-abner-001",
          "nexo-enoque-001",
          "nexo-elias-001"
        ]
      }
    }
  },
  "backend/data/config/integrations-config.json": {
    "_schema": {
      "version": "16.0.1",
      "lastUpdated": "2026-05-04T19:50:00Z",
      "editable": true
    },
    "email": {
      "enabled": false,
      "provider": null,
      "config": {
        "imapHost": null,
        "imapPort": 993,
        "smtpHost": null,
        "smtpPort": 587,
        "username": null,
        "password": null,
        "oauth2": false
      },
      "monitoring": {
        "checkInterval": 300000,
        "folders": [
          "INBOX",
          "CLIENTES"
        ],
        "filters": {
          "clientDomains": [],
          "formSubmissions": [
            "formulario@nexo-digital.app",
            "no-reply@formspree.io"
          ],
          "autoReplyEnabled": false
        }
      },
      "aiProcessing": {
        "enabled": false,
        "suggestionEngine": "ollama-local",
        "requiresApproval": true,
        "autoSend": false
      },
      "editableFields": [
        "enabled",
        "provider",
        "config",
        "monitoring",
        "aiProcessing"
      ]
    },
    "siteForms": {
      "enabled": false,
      "endpoint": null,
      "emailDestination": null,
      "autoClassify": true,
      "leadScoring": {
        "enabled": true,
        "rules": {
          "budgetMentioned": {
            "points": 10,
            "keywords": [
              "orçamento",
              "presupuesto",
              "budget",
              "valor"
            ]
          },
          "timelineMentioned": {
            "points": 10,
            "keywords": [
              "prazo",
              "quando",
              "urgente",
              "timeline"
            ]
          },
          "contactInfoComplete": {
            "points": 15,
            "fields": [
              "name",
              "email",
              "phone"
            ]
          },
          "projectTypeClear": {
            "points": 10,
            "keywords": [
              "web",
              "app",
              "site",
              "sistema",
              "tpv"
            ]
          }
        },
        "thresholds": {
          "hot": 70,
          "warm": 40,
          "cold": 0
        }
      },
      "autoResponse": {
        "enabled": false,
        "template": "Obrigado pelo contato! Analisaremos sua solicitação e retornaremos em breve.",
        "responseTime": "24h"
      },
      "editableFields": [
        "enabled",
        "endpoint",
        "autoClassify",
        "leadScoring",
        "autoResponse"
      ]
    },
    "notion": {
      "enabled": false,
      "accessMethod": "playwright",
      "workspaceUrl": null,
      "pages": [],
      "sync": {
        "enabled": false,
        "interval": 3600000,
        "lastSynced": null
      },
      "editableFields": [
        "enabled",
        "workspaceUrl",
        "pages",
        "sync"
      ]
    },
    "github": {
      "enabled": true,
      "repos": [
        {
          "owner": "Jhin1v9",
          "repo": "nexo-dashboard-pro",
          "trackIssues": true,
          "trackCommits": true
        },
        {
          "owner": "Jhin1v9",
          "repo": "TPV-SORVETERIA-DEMO",
          "trackIssues": true,
          "trackCommits": true
        }
      ],
      "sync": {
        "enabled": false,
        "interval": 1800000,
        "lastSynced": null
      },
      "editableFields": [
        "enabled",
        "repos",
        "sync"
      ]
    },
    "ollama": {
      "enabled": true,
      "model": "qwen2.5-coder:3b",
      "host": "http://localhost:11434",
      "timeout": 30000,
      "editableFields": [
        "enabled",
        "model",
        "host"
      ]
    }
  },
  "backend/data/config/luna-dashboard-config.json": {
    "_schema": {
      "version": "16.0.1",
      "lastUpdated": "2026-05-04T19:50:00Z"
    },
    "screenshot": {
      "resolution": {
        "width": 1920,
        "height": 1080,
        "deviceScaleFactor": 1.5,
        "type": "desktop"
      },
      "quality": 90,
      "format": "png",
      "fullPage": false,
      "darkMode": true
    },
    "sendControl": {
      "enabled": true,
      "autoSend": true,
      "autoSendInterval": 1800000,
      "cooldownAfterSend": 86400000,
      "lastSent": null,
      "nextScheduled": null,
      "manualOverride": false,
      "commands": {
        "sendNow": "/dashboard",
        "disableAuto": "/dashboard-off",
        "enableAuto": "/dashboard-on",
        "status": "/dashboard-status"
      }
    },
    "theme": {
      "name": "NEXO Dark",
      "primary": "#00D4FF",
      "secondary": "#0A1628",
      "accent": "#FF6B35",
      "success": "#00C853",
      "warning": "#FFB300",
      "danger": "#FF1744",
      "info": "#2979FF",
      "background": "#0D1117",
      "surface": "#161B22",
      "textPrimary": "#E6EDF3",
      "textSecondary": "#8B949E",
      "border": "#30363D",
      "gradient": "linear-gradient(135deg, #00D4FF 0%, #0A1628 100%)"
    },
    "sections": {
      "kpis": {
        "enabled": true,
        "order": 1
      },
      "teamRadar": {
        "enabled": true,
        "order": 2
      },
      "tasksBoard": {
        "enabled": true,
        "order": 3
      },
      "leadsPipeline": {
        "enabled": true,
        "order": 4
      },
      "linksIntelligence": {
        "enabled": true,
        "order": 5
      },
      "clientsStatus": {
        "enabled": true,
        "order": 6
      },
      "projectsProgress": {
        "enabled": true,
        "order": 7
      },
      "activityTimeline": {
        "enabled": true,
        "order": 8
      },
      "alertsActions": {
        "enabled": true,
        "order": 9
      },
      "newsEngine": {
        "enabled": true,
        "order": 10
      }
    }
  },
  "backend/data/config/commands-config.json": {
    "_schema": {
      "version": "16.0.1",
      "lastUpdated": "2026-05-04T19:50:00Z"
    },
    "commands": {
      "/status": {
        "description": "Resumo inteligente do estado atual (não genérico)",
        "requiresAdmin": false,
        "responseType": "text",
        "aiGenerated": true,
        "cooldown": 0
      },
      "/tarefas": {
        "description": "Board de tarefas por projeto/pessoa",
        "requiresAdmin": false,
        "responseType": "text",
        "aiGenerated": false,
        "cooldown": 0
      },
      "/leads": {
        "description": "Pipeline de possíveis clientes",
        "requiresAdmin": false,
        "responseType": "text",
        "aiGenerated": false,
        "cooldown": 0
      },
      "/clientes": {
        "description": "Status de cada cliente ativo",
        "requiresAdmin": false,
        "responseType": "text",
        "aiGenerated": false,
        "cooldown": 0
      },
      "/links": {
        "description": "Links analisados com preview",
        "requiresAdmin": false,
        "responseType": "text",
        "aiGenerated": false,
        "cooldown": 0
      },
      "/news": {
        "description": "Notícias do dia com contexto",
        "requiresAdmin": false,
        "responseType": "text",
        "aiGenerated": false,
        "cooldown": 0
      },
      "/dashboard": {
        "description": "Envia screenshot do dashboard visual",
        "requiresAdmin": false,
        "responseType": "image",
        "aiGenerated": false,
        "cooldown": 0
      },
      "/dashboard-off": {
        "description": "Pausa envio automático de dashboard por 24h",
        "requiresAdmin": true,
        "responseType": "text",
        "aiGenerated": false,
        "cooldown": 0
      },
      "/dashboard-on": {
        "description": "Reativa envio automático de dashboard",
        "requiresAdmin": true,
        "responseType": "text",
        "aiGenerated": false,
        "cooldown": 0
      },
      "/dashboard-status": {
        "description": "Mostra status do envio de dashboard",
        "requiresAdmin": false,
        "responseType": "text",
        "aiGenerated": false,
        "cooldown": 0
      },
      "/extrair": {
        "description": "Força extração completa do histórico",
        "requiresAdmin": true,
        "responseType": "text",
        "aiGenerated": false,
        "cooldown": 300000
      },
      "/reclassificar": {
        "description": "Reclassifica todas as mensagens com novo schema",
        "requiresAdmin": true,
        "responseType": "text",
        "aiGenerated": false,
        "cooldown": 600000
      },
      "/projeto": {
        "description": "Detalhes de um projeto específico (uso: /projeto SANTAFE)",
        "requiresAdmin": false,
        "responseType": "text",
        "aiGenerated": false,
        "cooldown": 0,
        "requiresArgument": true
      },
      "/cliente": {
        "description": "Detalhes de um cliente específico (uso: /cliente Paulo)",
        "requiresAdmin": false,
        "responseType": "text",
        "aiGenerated": false,
        "cooldown": 0,
        "requiresArgument": true
      },
      "/ajuda": {
        "description": "Menu de comandos disponíveis",
        "requiresAdmin": false,
        "responseType": "text",
        "aiGenerated": false,
        "cooldown": 0
      },
      "/checkpoint": {
        "description": "Mostra status do checkpoint (mensagens processadas)",
        "requiresAdmin": false,
        "responseType": "text",
        "aiGenerated": false,
        "cooldown": 0
      },
      "/buffer": {
        "description": "Mostra conteúdo do buffer acumulativo",
        "requiresAdmin": true,
        "responseType": "text",
        "aiGenerated": false,
        "cooldown": 0
      }
    },
    "aliases": {
      "/s": "/status",
      "/t": "/tarefas",
      "/l": "/leads",
      "/c": "/clientes",
      "/d": "/dashboard",
      "/h": "/ajuda"
    }
  },
  "backend/data/runtime/luna-checkpoint.json": {
    "version": "16.0.1",
    "hashes": [],
    "lastScan": null,
    "totalProcessed": 0
  },
  "backend/data/runtime/luna-buffer.json": {
    "version": "16.0.1",
    "newTasks": [],
    "newIdeas": [],
    "newLinks": [],
    "newLeads": [],
    "news": [],
    "lastUpdate": null
  },
  "backend/data/runtime/luna-messages-enriched.json": {
    "version": "16.0.1",
    "messages": [],
    "total": 0,
    "lastEnriched": null
  },
  "backend/data/runtime/unknown-contacts.json": {
    "version": "16.0.1",
    "contacts": [],
    "total": 0
  },
  "backend/data/runtime/luna-threads.json": {
    "_schema": {
      "version": "16.0.1",
      "lastUpdated": "2026-05-04T19:50:00Z"
    },
    "threads": [],
    "threadTemplate": {
      "id": "thread_unico",
      "name": "Nome do tópico detectado",
      "createdAt": "2026-05-04T18:00:00Z",
      "updatedAt": "2026-05-04T19:00:00Z",
      "status": "active",
      "participants": [
        "nexo-abner-001",
        "nexo-enoque-001"
      ],
      "messageCount": 23,
      "classification": "tarefa|lead|discussao|bug|feature",
      "projectId": "SANTAFE-CONSTRUCCIONES",
      "priority": "P0",
      "summary": "Resumo da thread gerado por LLM",
      "keyDecisions": [
        "decisao-1",
        "decisao-2"
      ],
      "actionItems": [
        "task-1",
        "task-2"
      ],
      "sentiment": "positive|neutral|negative",
      "progress": 75,
      "estimatedCompletion": "2026-05-10"
    }
  },
  "backend/data/runtime/luna-entities.json": {
    "_schema": {
      "version": "16.0.1",
      "lastUpdated": "2026-05-04T19:50:00Z"
    },
    "entities": {
      "people": [],
      "organizations": [],
      "locations": [],
      "products": [],
      "technologies": [],
      "projects": [],
      "clients": [],
      "leads": []
    },
    "entityTemplate": {
      "id": "entity_unico",
      "type": "person|organization|location|product|technology|project|client|lead",
      "name": "Nome",
      "aliases": [],
      "mentions": 0,
      "firstSeen": "2026-05-04T19:00:00Z",
      "lastSeen": "2026-05-04T19:00:00Z",
      "relatedTo": [],
      "sentiment": 0.0,
      "context": {}
    }
  },
  "backend/data/runtime/nexo-news.json": {
    "_schema": {
      "version": "16.0.1",
      "lastUpdated": "2026-05-04T19:50:00Z"
    },
    "categories": [
      "industria-tech",
      "concorrencia",
      "oportunidade",
      "aprendizado",
      "pessoal",
      "nexo-internal"
    ],
    "news": [],
    "newsTemplate": {
      "id": "news_unico",
      "timestamp": "2026-05-04T19:00:00Z",
      "source": "whatsapp|email|site|github|external",
      "category": "industria-tech",
      "title": "Título gerado por LLM",
      "summary": "Resumo de 2 linhas",
      "content": "Conteúdo original ou link",
      "urls": [],
      "relevance": 0.8,
      "relevanceReason": "Por que é relevante para NEXO",
      "actionSuggested": "ler-depois|compartilhar|ignorar|agir-agora",
      "readBy": [],
      "status": "novo|lido|arquivado"
    }
  },
  "backend/data/runtime/luna-email-cache.json": {
    "_schema": {
      "version": "16.0.1",
      "lastUpdated": "2026-05-04T19:50:00Z"
    },
    "emails": [],
    "emailTemplate": {
      "id": "email_unico",
      "timestamp": "2026-05-04T19:00:00Z",
      "from": {
        "name": "string",
        "email": "string",
        "isClient": "boolean"
      },
      "to": [],
      "subject": "Assunto",
      "body": "Corpo do email",
      "bodyText": "Corpo limpo para NLP",
      "priority": "high|medium|low",
      "category": "cliente|lead|spam|newsletter|internal|form",
      "attachments": [],
      "links": [],
      "aiAnalysis": {
        "summary": "Resumo do email",
        "sentiment": "positive|neutral|negative",
        "intent": "string",
        "suggestedResponse": "Sugestão de resposta",
        "confidence": 0.85,
        "requiresHuman": true
      },
      "status": "novo|lido|respondido|arquivado|spam",
      "assignedTo": null,
      "deadline": null
    }
  },
  "backend/data/runtime/luna-form-leads.json": {
    "_schema": {
      "version": "16.0.1",
      "lastUpdated": "2026-05-04T19:50:00Z"
    },
    "submissions": [],
    "submissionTemplate": {
      "id": "form_unico",
      "timestamp": "2026-05-04T19:00:00Z",
      "source": "site-form|email-form|whatsapp-form",
      "formData": {
        "name": "string",
        "email": "string",
        "phone": "string",
        "company": "string",
        "service": "string",
        "budget": "string",
        "timeline": "string",
        "message": "string"
      },
      "leadScore": 0,
      "leadScoreBreakdown": {},
      "classification": "hot|warm|cold",
      "aiAnalysis": {
        "needs": [
          "web",
          "app",
          "seo",
          "faturacao"
        ],
        "suggestedServices": [],
        "estimatedValue": null,
        "confidence": 0.8,
        "researchDone": false,
        "researchResults": null,
        "suggestedResponse": "Texto explicativo para humano responder"
      },
      "status": "novo|qualificado|contactado|convertido|arquivado",
      "assignedTo": null,
      "clientId": null
    }
  },
  "backend/data/runtime/luna-knowledge-graph.json": {
    "_schema": {
      "version": "16.0.1",
      "lastUpdated": "2026-05-04T19:50:00Z"
    },
    "nodes": [],
    "edges": [],
    "nodeTypes": [
      "person",
      "project",
      "client",
      "lead",
      "technology",
      "company",
      "location"
    ],
    "edgeTypes": [
      "works-on",
      "owns",
      "manages",
      "created",
      "mentions",
      "depends-on",
      "blocked-by"
    ],
    "nodeTemplate": {
      "id": "node_unico",
      "type": "person|project|client|lead|technology|company|location",
      "label": "Nome",
      "properties": {},
      "weight": 1.0,
      "firstSeen": "2026-05-04T19:00:00Z",
      "lastUpdated": "2026-05-04T19:00:00Z"
    },
    "edgeTemplate": {
      "id": "edge_unico",
      "from": "node_id",
      "to": "node_id",
      "relation": "works-on|owns|manages|created|mentions|depends-on|blocked-by",
      "weight": 1.0,
      "since": "2026-05-04T19:00:00Z",
      "context": "Contexto da relação"
    }
  },
  "backend/data/runtime/luna-self-evolution.json": {
    "_schema": {
      "version": "16.0.1",
      "lastUpdated": "2026-05-04T19:50:00Z"
    },
    "evolutions": [],
    "evolutionTemplate": {
      "evolutionId": "evo_unico",
      "triggeredAt": "2026-05-04T19:00:00Z",
      "triggerReason": "accuracy_drop|new_pattern|user_feedback|scheduled",
      "changes": [
        {
          "field": "string",
          "oldValue": "any",
          "newValue": "any",
          "reason": "string"
        }
      ],
      "performanceBefore": 0.82,
      "performanceAfter": 0.91,
      "approvedBy": "auto|Abner|Elias|Enoque",
      "rollbackAvailable": true
    },
    "metrics": {
      "totalEvolutions": 0,
      "lastEvolution": null,
      "averagePerformanceGain": 0.0
    }
  },
  "backend/data/runtime/luna-predictions.json": {
    "_schema": {
      "version": "16.0.1",
      "lastUpdated": "2026-05-04T19:50:00Z"
    },
    "predictions": [],
    "predictionTypes": [
      "next-best-action",
      "churn-risk",
      "deadline-risk",
      "opportunity",
      "task-overload",
      "client-follow-up"
    ],
    "predictionTemplate": {
      "predictionId": "pred_unico",
      "generatedAt": "2026-05-04T19:00:00Z",
      "type": "next-best-action",
      "confidence": 0.85,
      "prediction": "Texto da previsão",
      "recommendedAction": "Ação recomendada",
      "impact": "high|medium|low",
      "autoExecute": false,
      "requiresApproval": true,
      "relatedTo": {
        "clientId": null,
        "projectId": null,
        "taskId": null
      },
      "status": "active|executed|dismissed|expired"
    }
  }
};

function ensureDir(dirPath) {
  const fullPath = path.join(BASE_PATH, dirPath);
  if (!fs.existsSync(fullPath)) {
    fs.mkdirSync(fullPath, { recursive: true });
    console.log(`✅ Criado: ${fullPath}`);
  } else {
    console.log(`⏭️  Já existe: ${fullPath}`);
  }
}

function writeJson(filePath, data) {
  const fullPath = path.join(BASE_PATH, filePath);
  const dir = path.dirname(fullPath);

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // Check if file exists and backup if needed
  if (fs.existsSync(fullPath)) {
    const backupPath = fullPath.replace('.json', `-backup-${Date.now()}.json`);
    fs.copyFileSync(fullPath, backupPath);
    console.log(`💾 Backup criado: ${backupPath}`);
  }

  fs.writeFileSync(fullPath, JSON.stringify(data, null, 2), 'utf8');
  console.log(`📝 Escrito: ${fullPath}`);
}

function generateStructure() {
  console.log('\n🚀 LUNA v16.0 — Gerando estrutura de schema...');
  console.log('📋 Revisão brutal aplicada: 13 correções inclusas\n');

  // Create directories
  structure.dirs.forEach(dir => ensureDir(dir));

  // Write all JSON files
  Object.entries(files).forEach(([filePath, data]) => {
    writeJson(filePath, data);
  });

  console.log('\n✨ Estrutura gerada com sucesso!');
  console.log(`📁 Local: ${BASE_PATH}`);
  console.log(`📊 Total de arquivos: ${Object.keys(files).length}`);
  console.log(`📂 Total de diretórios: ${structure.dirs.length}`);
  console.log('\n🎯 Próximo passo: Configure o luna-cto-agent-v16-0.cjs para ler destes schemas');
  console.log('\n📋 Arquivos gerados:');
  console.log('   📁 Schema (8): contacts-map, clients-registry, projects-registry, groups-config, schema-version, nlp-enrichment-schema, message-privacy-schema');
  console.log('   ⚙️  Config (3): integrations-config, luna-dashboard-config, commands-config');
  console.log('   💾 Runtime (12): checkpoint, buffer, messages, unknown-contacts, threads, entities, news, email-cache, form-leads, knowledge-graph, self-evolution, predictions');
}

// Run
generateStructure();
